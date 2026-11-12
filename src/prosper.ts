import fetch from 'node-fetch';
import { writeToLog } from './logging'
import {
    checkPriorProsperLoans,
    checkTransunionData,
    checkListingInfo,
    checkBorrowerInfo,
} from './filter'

import { sortByFicoAndDtiAndListingId } from './sort'
import { sendSMS } from './sns'

type loanRequest = {
    listing_id: number,
    bid_amount: number,
}

type order = {
    bid_requests: loanRequest[]
}

export default class ProsperAP {
    // Reset after each run
    receivedResults: number = 0;
    totalResults: number = 0;
    availableBalance: number = 0;
    filteredLoans: any[] = [];
    order: order = { bid_requests: [] };
    maxLoansWeCanInvestIn: number = 0;
    listings: any[] = [];
    useAwsSNS: boolean = process.env.USE_AWS_SNS === 'TRUE';
    enableLogging: boolean = process.env.ENABLE_LOGGING === 'TRUE';

    // persists through lifetime of class
    bearerToken: string = ''; //  espires after 1 hour
    // not used currently as I only ever have this run for 30 mins...maybe in the future I will run it longer
    refreshToken: string = ''; // expire after 10 hours, 
    listingsInvestedIn: number[] = [];

    // Totals for the whole run, written to info.txt as one line when the run ends
    stats = {
        polls: 0,
        errors: 0,
        ordersPlaced: 0,
        loansOrdered: 0,
        maxListings: 0,
        maxPassedFilter: 0,
        pollsShortOnCash: 0,
        lastBalance: null as number | null,
        newListingsFirstSeenAt: '',
    };
    seenListingIds: Set<number> | null = null;

    logFailure = (e: any) => {
        this.stats.errors++
        console.log(e)
        if (this.enableLogging) writeToLog(`\n\n${typeof e === 'string' ? e : JSON.stringify(e)}\n\n`, 'failures.txt')
    }

    // The time new listings show up mid-run tells us if the cron job starts at the right time
    trackNewListings = () => {
        const ids: number[] = this.listings.map((l: any) => l.listing_number)

        if (this.seenListingIds === null) {
            this.seenListingIds = new Set(ids)
            return
        }

        const seen = this.seenListingIds
        if (!this.stats.newListingsFirstSeenAt && ids.some(id => !seen.has(id))) {
            this.stats.newListingsFirstSeenAt = new Date().toLocaleTimeString("en-US", { timeZone: process.env.TIME_ZONE })
        }
        ids.forEach(id => seen.add(id))
    }

    runSummary = () : string => {
        const s = this.stats
        const parts = [
            `${s.polls} polls`,
            `${s.errors} error(s)`,
            `${s.ordersPlaced} order(s) for ${s.loansOrdered} loan(s)`,
            `most listings seen ${s.maxListings}`,
            `most passing filter ${s.maxPassedFilter}`,
            `cash ${s.lastBalance === null ? 'unknown' : '$' + s.lastBalance}`,
            `new listings first seen ${s.newListingsFirstSeenAt || 'never'}`,
        ]
        if (s.pollsShortOnCash) parts.push(`${s.pollsShortOnCash} poll(s) had loans to buy but not enough cash`)

        return parts.join(', ')
    }

    reset = () => {
        this.receivedResults = 0;
        this.totalResults = 0;
        this.availableBalance = 0;
        this.filteredLoans = [];
        this.order = { bid_requests: [] };
        this.maxLoansWeCanInvestIn = 0;
        this.listings = [];
    }

    login = async () => {
        const { PROSPER_CLIENT_ID, PROSPER_CLIENT_SECRED, PROSPER_USERNAME, PROSPER_PASSWORD } = process.env;
    
        const res = await fetch(`https://api.prosper.com/v1/security/oauth/token?grant_type=password&client_id=${PROSPER_CLIENT_ID}&client_secret=${PROSPER_CLIENT_SECRED}&username=${PROSPER_USERNAME}&password=${PROSPER_PASSWORD}`, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });
        const json: any = await res.json();

        if (!json.access_token) {
            throw new Error(`Login failed (HTTP ${res.status}): ${json.error_description || json.error || 'no access token returned'}`)
        }

        this.bearerToken = json.access_token;
        this.refreshToken = json.refresh_token;
    }

    getAccountInfo = async () => {
        try {
            const res = await fetch('https://api.prosper.com/v1/accounts/prosper/', {
                headers: {
                    'Accept': 'application/json',
                    'Authorization': `bearer ${this.bearerToken}`,
                },
            });

            const accountJson: any = await res.json();
            if (typeof accountJson.available_cash_balance !== 'number') {
                this.logFailure(`Account info had no cash balance (HTTP ${res.status})`)
                return
            }

            this.availableBalance = accountJson.available_cash_balance
            this.stats.lastBalance = this.availableBalance
            this.maxLoansWeCanInvestIn = Math.floor(this.availableBalance / (Number(process.env.LOAN_INVESTMENT_AMOUNT) || 25))
        } catch (e) {
            this.logFailure(e)
        }
    }

    // TODO: Look through with offset incase listings are ever over 500
    getListings = async () => {
        try {
            const listingsRes = await fetch('https://api.prosper.com/listingsvc/v2/listings/?limit=500', {
                headers: {
                    'Accept': 'application/json',
                    'Authorization': `bearer ${this.bearerToken}`,
                    'timezone': 'America/New_York'
                },
            });

            const listingsJson: any = await listingsRes.json();

            if (!Array.isArray(listingsJson.result)) {
                this.logFailure(`Listings response had no result list (HTTP ${listingsRes.status})`)
                return
            }

            this.listings = listingsJson.result;
            this.stats.maxListings = Math.max(this.stats.maxListings, this.listings.length)
            this.trackNewListings()
        } catch (e) {
            this.logFailure(e)
        }
    }

    orderLoans =  async () => {
        if (this.order.bid_requests.length === 0) {
            const infoMessage = this.maxLoansWeCanInvestIn === 0 && this.filteredLoans.length === 0
                ? 'We have no money but there are no loans to invest in.'
                : this.maxLoansWeCanInvestIn === 0
                    ? 'We have loans to invest in but not enough money available.'
                    : 'Nothing good to invest in.'

            console.log(infoMessage)

            // Not written to info.txt on every poll anymore, the run summary covers it
            if (this.maxLoansWeCanInvestIn === 0 && this.filteredLoans.length > 0) this.stats.pollsShortOnCash++

            return
        }
        
        console.log('Placing order for...', this.order)
        const orderIdsString = JSON.stringify(this.order.bid_requests.map(l => l.listing_id))

        if (process.env.EMULATE_ORDER === 'TRUE') {
            for (let l in this.order.bid_requests) {
                this.listingsInvestedIn.push(this.order.bid_requests[l].listing_id)
            }

            console.log('investedIn', this.listingsInvestedIn)
            this.stats.ordersPlaced++
            this.stats.loansOrdered += this.order.bid_requests.length
            if (this.enableLogging) writeToLog(`Put in order for ${this.order.bid_requests.length} loan(s). - ${orderIdsString}`, 'success.txt')
            return
        }

        try {
            const res = await fetch(`https://api.prosper.com/v1/orders/`, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Authorization': `bearer ${this.bearerToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(this.order)
            });

            const body = await res.text();
            console.log('Order response', res.status, body)

            // Marked as tried either way so a rejected order isn't resent on every poll
            for (let l in this.order.bid_requests) {
                this.listingsInvestedIn.push(this.order.bid_requests[l].listing_id)
            }

            if (!res.ok) {
                this.logFailure(`Order for ${orderIdsString} was rejected (HTTP ${res.status}): ${body.slice(0, 500)}`)
                return
            }

            if (this.useAwsSNS) {
                await sendSMS(`Put in order for ${this.order.bid_requests.length} loan(s).`)
            }

            this.stats.ordersPlaced++
            this.stats.loansOrdered += this.order.bid_requests.length
            if (this.enableLogging) writeToLog(`Put in order for ${this.order.bid_requests.length} loan(s). - ${orderIdsString}`, 'success.txt')

        } catch (e) {
            console.log('Error placing order...')
            this.logFailure(e)
            if (this.useAwsSNS) {
                await sendSMS(`Error placing order...check failures.txt for error`)
                // We exit the script if there is an error to prevent looping through and hitting
                // the error again and again and we keep sending SMS texts which would be bad
                process.exit(1);
            }
        }
    }
    
    setupLoansToOrder = () => {
        if (this.maxLoansWeCanInvestIn === 0) {
            return
        }

        if (this.filteredLoans.length === 0) {
            return
        }

        const loansToOrder: any[] = []
        const maxLoop = Math.min(this.maxLoansWeCanInvestIn, this.filteredLoans.length)

        for (let i = 0; i < maxLoop; i++) {
            loansToOrder.push(this.filteredLoans[i])
        }

        const orders = loansToOrder.map((l: any) => ({
            listing_id: l.listing_number,
            bid_amount: (Number(process.env.LOAN_INVESTMENT_AMOUNT) || 25)
        }))

        this.order = {
            bid_requests: [...orders],
        }
    }

    filterAndSortListings = () => {
        const filteredLoans = this.listings.filter((loan: any) => {
            let shouldInvest = true;

            const priorProsperInfo = checkPriorProsperLoans(loan)
            const transunionInfo = checkTransunionData(loan)
            const listingInfo = checkListingInfo(loan)
            const borrowerInfo = checkBorrowerInfo(loan)

            // filter based on loan data
            if (!priorProsperInfo) shouldInvest = false
            if (!transunionInfo) shouldInvest = false
            if (!listingInfo) shouldInvest = false
            if (!borrowerInfo) shouldInvest = false

            // Prevent issues where the prosper API doesn't update
            // the loan listing data right away with what was invested in
            if (this.listingsInvestedIn.includes(loan.listing_number)) shouldInvest = false

            return shouldInvest
        })

        // Sorting is done as a way to rank ones that passed the filter to ensure they get
        // first dibs on investing when there are more loans than we have availble to invest.
        filteredLoans.sort(sortByFicoAndDtiAndListingId)
        this.filteredLoans = filteredLoans
        this.stats.maxPassedFilter = Math.max(this.stats.maxPassedFilter, filteredLoans.length)
    }
}
