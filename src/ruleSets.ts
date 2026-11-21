import fs from 'fs'
import path from 'path'

// A rule set is one file in src/filters. Several can sit side by side: every listing is
// checked against all of them and the results are logged, but only the active one buys.
export type ruleSet = {
    name: string,
    // Reasons to reject the listing, empty when it passes
    check: (loan: any) => string[],
}

const checkNames = ['checkPriorProsperLoans', 'checkTransunionData', 'checkListingInfo', 'checkBorrowerInfo']

// Each check function may return true/false or a list of reasons to reject
const buildRuleSet = (name: string, moduleExports: any) : ruleSet => {
    const missing = checkNames.filter(fn => typeof moduleExports?.[fn] !== 'function')
    if (missing.length) throw new Error(`Rule set "${name}" is missing ${missing.join(', ')}`)

    return {
        name,
        check: (loan: any) => {
            const reasons: string[] = []

            for (const fn of checkNames) {
                try {
                    const result = moduleExports[fn](loan)

                    if (Array.isArray(result)) reasons.push(...result.map(String))
                    else if (!result) reasons.push(`failed ${fn}`)
                } catch (e: any) {
                    // A rule that blows up on odd data rejects the loan instead of ending the poll
                    reasons.push(`${fn} threw: ${e?.message || e}`)
                }
            }

            return reasons
        },
    }
}

// Reads the compiled rule sets from the filters folder next to this file. Falls back to a
// single filter.js for setups from before rule sets existed.
export const loadRuleSets = (directory: string = __dirname) : ruleSet[] => {
    const filtersDirectory = path.join(directory, 'filters')

    if (fs.existsSync(filtersDirectory)) {
        return fs.readdirSync(filtersDirectory)
            .filter(file => file.endsWith('.js') && !file.startsWith('.') && !file.startsWith('_'))
            .sort()
            .map(file => buildRuleSet(path.basename(file, '.js'), require(path.join(filtersDirectory, file))))
    }

    const legacyFilter = path.join(directory, 'filter.js')
    if (fs.existsSync(legacyFilter)) return [buildRuleSet('filter', require(legacyFilter))]

    return []
}

// Only one rule set is allowed to buy. With several present it has to be named in
// ACTIVE_FILTER, guessing which one spends the money isn't safe.
export const pickActiveRuleSet = (ruleSets: ruleSet[], activeName: string | undefined) : ruleSet => {
    const names = ruleSets.map(r => r.name).join(', ')

    if (ruleSets.length === 0) throw new Error('No rule sets found. Copy src/filters.example to src/filters, edit it and build again.')

    if (!activeName) {
        if (ruleSets.length === 1) return ruleSets[0]
        throw new Error(`There are ${ruleSets.length} rule sets (${names}). Set ACTIVE_FILTER in .env to the one that should buy.`)
    }

    const active = ruleSets.find(r => r.name === activeName)
    if (!active) throw new Error(`ACTIVE_FILTER is "${activeName}" but the rule sets are: ${names}`)

    return active
}
