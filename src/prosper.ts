import fetch from 'node-fetch';
import { writeToLog, writeRawToLog } from './logging'
import type { ruleSet } from './ruleSets'

import { sortByFicoAndDtiAndListingId } from './sort'
import { sendSMS } from './sns'

// Without a timeout a stalled connection can hang for minutes and eat most of a run.
// Read when called (not at import) so the values from .env are loaded first.
const requestTimeout = () => (Number(process.env.REQUEST_TIMEOUT_IN_SECONDS) || 10) * 1000
// Logging in and ordering get longer, giving up early on an order that is going through is worse than waiting
const slowRequestTimeout = () => Math.max(requestTimeout(), 30 * 1000)

// How many times one listing can be ordered in a run when Prosper doesn't answer the order call
const MAX_ORDER_ATTEMPTS = 2
// Orders are processed asynchronously, so give one a moment to show up before deciding it never arrived
const ORDER_CHECK_WAIT_MS = 5000

type unconfirmedOrder = {
    bidAmount: number,
    attempts: number,
    failedAt: number,
}

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
    // Listings whose order call errored or timed out, so we don't know if Prosper got the order
    unconfirmedOrders: Map<number, unconfirmedOrder> = new Map();
    runStartedAt: number = Date.now();

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

    // Every rule set is checked against every listing, only the active one decides what we buy
    ruleSets: ruleSet[];
    activeRuleSet: ruleSet;
    // Listings each rule set passed at any point in the run
    passedByRuleSet: Map<string, Set<number>> = new Map();
    // Which rule sets passed a listing the last time it was logged, so it's only logged again when that changes
    loggedComparisons: Map<number, string> = new Map();
    savedListingIds: Set<number> = new Set();

    constructor(ruleSets: ruleSet[], activeRuleSet: ruleSet) {
        this.ruleSets = ruleSets
        this.activeRuleSet = activeRuleSet
        ruleSets.forEach(r => this.passedByRuleSet.set(r.name, new Set()))
    }

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
        if (this.ruleSets.length > 1) {
            const counts = this.ruleSets.map(r => `${r.name} ${this.passedByRuleSet.get(r.name)?.size || 0}${r === this.activeRuleSet ? ' (buying)' : ''}`)
            parts.push(`listings passing each rule set: ${counts.join(', ')}`)
        }
        if (this.unconfirmedOrders.size) parts.push(`${this.unconfirmedOrders.size} order(s) could not be confirmed`)
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
            timeout: slowRequestTimeout(),
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
                timeout: requestTimeout(),
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
                timeout: requestTimeout(),
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

    // "2026-11-17 12:01:34 -0500" -> ms, or NaN if Prosper ever changes the format
    parseOrderDate = (orderDate: string) : number =>
        Date.parse(String(orderDate).replace(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) ([+-]\d{2})(\d{2})$/, '$1T$2$3:$4'))

    // After an order call fails we don't know if Prosper received it. Before ordering that
    // listing again, look for it in the orders placed during this run. Found means it went
    // through. Not found means it is safe to order again (up to MAX_ORDER_ATTEMPTS).
    // allowRetry is false for the last check of a run, when there is no poll left to retry in.
    resolveUnconfirmedOrders = async (allowRetry: boolean = true) => {
        if (this.unconfirmedOrders.size === 0) return

        let orders: any[]
        try {
            const res = await fetch('https://api.prosper.com/v1/orders/?limit=25', {
                headers: {
                    'Accept': 'application/json',
                    'Authorization': `bearer ${this.bearerToken}`,
                },
                timeout: requestTimeout(),
            });
            const json: any = await res.json();

            if (!Array.isArray(json.result)) {
                this.logFailure(`Orders response had no result list (HTTP ${res.status})`)
                return
            }
            orders = json.result
        } catch (e) {
            // Still unknown, check again on the next poll
            this.logFailure(e)
            return
        }

        // Only orders from this run count, an older order for the same listing is a different order.
        // A minute of slack covers the clocks not agreeing exactly.
        const ordersThisRun = orders.filter(o => !(this.parseOrderDate(o.order_date) < this.runStartedAt - 60 * 1000))

        for (const [listingId, unconfirmed] of Array.from(this.unconfirmedOrders)) {
            const bid = ordersThisRun
                .flatMap(o => Array.isArray(o.bid_requests) ? o.bid_requests : [])
                .find((b: any) => Number(b.listing_id) === listingId)

            if (bid) {
                this.unconfirmedOrders.delete(listingId)
                this.stats.ordersPlaced++
                this.stats.loansOrdered++
                console.log(`Order for ${listingId} did go through`, bid)
                if (this.enableLogging) writeToLog(`Put in order for 1 loan(s). - [${listingId}] - confirmed with Prosper after the order call failed (${bid.bid_status}/${bid.bid_result})`, 'success.txt')
                continue
            }

            if (Date.now() - unconfirmed.failedAt < ORDER_CHECK_WAIT_MS) continue

            if (!allowRetry) continue

            if (unconfirmed.attempts >= MAX_ORDER_ATTEMPTS) {
                // Stays in unconfirmedOrders so the run summary shows it, and in listingsInvestedIn so it isn't ordered again
                if (unconfirmed.attempts === MAX_ORDER_ATTEMPTS) {
                    unconfirmed.attempts++
                    if (this.enableLogging) writeToLog(`Order for [${listingId}] failed ${MAX_ORDER_ATTEMPTS} times and Prosper has no record of it. Giving up on it for this run.`, 'failures.txt')
                }
                continue
            }

            // Prosper has no order for it, so let the normal filter/order steps pick it up again
            console.log(`Prosper has no order for ${listingId}, it can be ordered again`)
            this.listingsInvestedIn = this.listingsInvestedIn.filter(id => id !== listingId)
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
                body: JSON.stringify(this.order),
                timeout: slowRequestTimeout(),
            });

            const body = await res.text();
            console.log('Order response', res.status, body)

            // Marked as tried either way so a rejected order isn't resent on every poll.
            // Prosper answered, so nothing about these listings is unconfirmed anymore.
            for (let l in this.order.bid_requests) {
                const listingId = this.order.bid_requests[l].listing_id
                if (!this.listingsInvestedIn.includes(listingId)) this.listingsInvestedIn.push(listingId)
                this.unconfirmedOrders.delete(listingId)
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

            // The order may have reached Prosper even though we got no answer. Hold these
            // listings back until resolveUnconfirmedOrders has checked, so we never buy a loan twice.
            for (let l in this.order.bid_requests) {
                const { listing_id: listingId, bid_amount: bidAmount } = this.order.bid_requests[l]
                const attempts = (this.unconfirmedOrders.get(listingId)?.attempts || 0) + 1

                this.unconfirmedOrders.set(listingId, { bidAmount, attempts, failedAt: Date.now() })
                if (!this.listingsInvestedIn.includes(listingId)) this.listingsInvestedIn.push(listingId)
            }
            if (this.enableLogging) writeToLog(`Order for ${orderIdsString} got no answer. Checking with Prosper whether it went through before trying again.`, 'failures.txt')
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

    // One line in filters.txt for a listing that passes at least one rule set, showing what
    // every rule set made of it. The full listing goes to filter-listings.jsonl once per run
    // so there is a record of what a loan looked like when it was (or wasn't) bought.
    logComparison = (loan: any, results: { name: string, reasons: string[] }[]) => {
        const passed = results.filter(r => r.reasons.length === 0).map(r => r.name)
        const listingId: number = loan.listing_number
        const signature = passed.join(',')

        passed.forEach(name => this.passedByRuleSet.get(name)?.add(listingId))

        if (passed.length === 0 || this.loggedComparisons.get(listingId) === signature) return
        this.loggedComparisons.set(listingId, signature)

        if (!this.enableLogging) return

        const percent = (n: any) => typeof n === 'number' ? `${Math.round(n * 10000) / 100}%` : '?'
        const details = [
            `[${listingId}]`,
            loan.prosper_rating,
            `yield ${percent(loan.lender_yield)}`,
            `${loan.listing_term}mo`,
            `$${loan.listing_amount}`,
            loan.listing_title,
            `FICO ${loan.credit_bureau_values_transunion_indexed?.fico_score}`,
            `DTI ${percent(loan.dti_wprosper_loan)}`,
        ].join(' ')
        const verdicts = results.map(r => {
            const label = r.name + (r.name === this.activeRuleSet.name ? ' (buying)' : '')
            return r.reasons.length === 0 ? `${label}: PASS` : `${label}: FAIL (${r.reasons.join('; ')})`
        })

        writeToLog(`${details} | ${verdicts.join(' | ')}`, 'filters.txt')

        if (!this.savedListingIds.has(listingId)) {
            this.savedListingIds.add(listingId)
            writeRawToLog(JSON.stringify({ seen: new Date().toISOString(), passed, listing: loan }), 'filter-listings.jsonl')
        }
    }

    filterAndSortListings = () => {
        const filteredLoans = this.listings.filter((loan: any) => {
            const results = this.ruleSets.map(r => ({ name: r.name, reasons: r.check(loan) }))
            this.logComparison(loan, results)

            let shouldInvest = results.find(r => r.name === this.activeRuleSet.name)?.reasons.length === 0

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
