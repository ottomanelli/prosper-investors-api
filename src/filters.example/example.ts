// An example rule set. Copy this folder to src/filters and edit, one file per rule set:
//   cp -r src/filters.example src/filters
//
// Every file in src/filters is a rule set and must export these four functions. Each one
// gets the whole listing. Return true to allow the loan and false to reject it, or return
// a list of reasons for rejecting it (an empty list allows it). Reasons show up in
// logs/filters.txt, which makes it much easier to see why a loan was skipped.
import { convertFicoToAverage } from '../loanType'
import type { loan } from '../loanType'

export const checkPriorProsperLoans = (loan: loan) : boolean => {
    const {
        prior_prosper_loans_active,
        prior_prosper_loans,
        prior_prosper_loans_principal_borrowed,
        prior_prosper_loans_principal_outstanding,
        prior_prosper_loans_balance_outstanding,
        prior_prosper_loans_cycles_billed,
        prior_prosper_loans_ontime_payments,
        prior_prosper_loans_late_cycles,
        prior_prosper_loans_late_payments_one_month_plus,
        max_prior_prosper_loan,
        min_prior_prosper_loan,
        prior_prosper_loan_earliest_pay_off,
    } = loan

    return true
}

export const checkTransunionData = ({ credit_bureau_values_transunion_indexed: {
    credit_report_date,
    at02s_open_accounts,
    g041s_accounts_30_or_more_days_past_due_ever,
    g093s_number_of_public_records,
    g094s_number_of_public_record_bankruptcies, 
    g095s_months_since_most_recent_public_record,
    g102s_months_since_most_recent_inquiry,
    g218b_number_of_delinquent_accounts,
    g980s_inquiries_in_the_last_6_months,
    re20s_age_of_oldest_revolving_account_in_months,
    s207s_months_since_most_recent_public_record_bankruptcy,
    re33s_balance_owed_on_all_revolving_accounts,
    at57s_amount_delinquent,
    g099s_public_records_last_24_months,
    at20s_oldest_trade_open_date,
    at03s_current_credit_lines,
    re101s_revolving_balance,
    bc34s_bankcard_utilization,
    at01s_credit_lines,
    fico_score,
}}: loan) : boolean | string[] => {
    const reasons: string[] = []
    const averageFico = convertFicoToAverage(fico_score)
    // Handle your filters this way, add a reason for every requirement that isn't met
    if (averageFico < 650) reasons.push(`fico ${fico_score} is under 650`)

    return reasons
}

export const checkListingInfo = ({
    historical_return,
    historical_return_10th_pctl,
    historical_return_90th_pctl,
    co_borrower_application,
    listing_start_date,
    listing_number,
    investment_product_id,
    decision_bureau,
    listing_creation_date,
    listing_status,
    listing_status_reason,
    verification_stage,
    listing_amount,
    amount_funded,
    amount_remaining,
    percent_funded,
    partial_funding_indicator,
    funding_threshold,
    prosper_rating,
    lender_yield,
    borrower_rate,
    borrower_apr,
    listing_term,
    listing_monthly_payment,
    prosper_score,
    listing_category_id,
    listing_title,
    lender_indicator,
    amount_participation,
    investment_typeid,
    investment_type_description,
    last_updated_date,
    invested,
    biddable,
}: loan) : boolean => {
    return true;
}

export const checkBorrowerInfo = ({
    has_mortgage,
    estimated_monthly_housing_expense,
    member_key,
    income_range,
    income_range_description,
    stated_monthly_income,
    income_verifiable,
    dti_wprosper_loan,
    employment_status_description,
    occupation,
    borrower_state,
    months_employed,
}: loan) : boolean => {
    return true
}
