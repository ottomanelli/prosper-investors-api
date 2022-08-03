import type { loan } from './filter'
import { convertFicoToAverage } from './filter'

export const sortByFicoAndDtiAndListingId = (a: loan, b: loan) => {
    return convertFicoToAverage(b.credit_bureau_values_transunion_indexed.fico_score) - convertFicoToAverage(a.credit_bureau_values_transunion_indexed.fico_score)
        || a.dti_wprosper_loan - b.dti_wprosper_loan
        || a.listing_category_id - b.listing_category_id;
}
