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
            this.availableBalance = accountJson.available_cash_balance
            this.maxLoansWeCanInvestIn = Math.floor(this.availableBalance / (Number(process.env.LOAN_INVESTMENT_AMOUNT) || 25))
        } catch (e) {
            console.log(e)
            if (this.enableLogging) writeToLog(`\n\n${JSON.stringify(e)}\n\n`, 'failures.txt')
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

            this.listings = listingsJson.result;
        } catch (e) {
            console.log(e)
            if (this.enableLogging) writeToLog(`\n\n${JSON.stringify(e)}\n\n`, 'failures.txt')
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

            if (this.enableLogging) writeToLog(infoMessage, 'info.txt')

            return
        }
        
        console.log('Placing order for...', this.order)
        const orderIdsString = JSON.stringify(this.order.bid_requests.map(l => l.listing_id))

        if (process.env.EMULATE_ORDER === 'TRUE') {
            for (let l in this.order.bid_requests) {
                this.listingsInvestedIn.push(this.order.bid_requests[l].listing_id)
            }

            console.log('investedIn', this.listingsInvestedIn)
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

            if (this.useAwsSNS) {
                await sendSMS(`Put in order for ${this.order.bid_requests.length} loan(s).`)
            }

            const json = await res.json();
            console.log('Order response', json)

            for (let l in this.order.bid_requests) {
                this.listingsInvestedIn.push(this.order.bid_requests[l].listing_id)
            }

            if (this.enableLogging) writeToLog(`Put in order for ${this.order.bid_requests.length} loan(s). - ${orderIdsString}`, 'success.txt')

        } catch (e) {
            console.log('Error placing order...', e)
            if (this.enableLogging) writeToLog(`\n\n${JSON.stringify(e)}\n\n`, 'failures.txt')
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
    }
}
