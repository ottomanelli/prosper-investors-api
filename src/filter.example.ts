// Listings API - https://developers.prosper.com/docs/investor/listings-api/
// Transunion Credit Data - https://developers.prosper.com/docs/investor/listings-api/transunion-credit-data/

export const convertFicoToAverage = (fico: string) : number =>
    ((fico.split('-').map(s => Number(s)).reduce((mem, cur) => mem + cur, 0)) / 2)

export type loan = {
    prior_prosper_loans_active: number; // Total prior Prosper loans that are still active
    prior_prosper_loans: number; // Total prior Prosper loans
    prior_prosper_loans_principal_borrowed: number;  // Total Prosper loans principal borrowed
    prior_prosper_loans_principal_outstanding: number;  // Principal balance outstanding on Prosper Loans
    prior_prosper_loans_balance_outstanding: number;  // Total balance outstanding on Prosper loans
    prior_prosper_loans_cycles_billed: number;  // Total cycles billed on prior Prosper loans.
    prior_prosper_loans_ontime_payments: number, // Number of billing cycles where a timely payment was made on prior Prosper loans.
    prior_prosper_loans_late_cycles: number; // Number of billing cycles where a late payment was made on prior Prosper loans.
    prior_prosper_loans_late_payments_one_month_plus: number; // Number of billing cycles where a late payment by 1 or more months was made on prior Prosper loans.
    max_prior_prosper_loan: number; // Largest prior Prosper loan amount
    min_prior_prosper_loan: number; // Smallest prior Prosper loan amount.
    prior_prosper_loan_earliest_pay_off: number; // Cycle number of the fastest early payoff of a prior Prosper loan.
    credit_bureau_values_transunion_indexed: {
        credit_report_date: string; // Date the credit was run
        at02s_open_accounts: number; // The number of open accounts the borrower has.
        g041s_accounts_30_or_more_days_past_due_ever: number; // Number of trades 30 or more days past due ever
        g093s_number_of_public_records: number; // Number of public records
        g094s_number_of_public_record_bankruptcies: number; // Number of public record bankruptcies
        g095s_months_since_most_recent_public_record: number; // Months since most recent public record
        g102s_months_since_most_recent_inquiry: number; // Months since most recent inquiry
        g218b_number_of_delinquent_accounts: number; // Number of trades verified in the past 12 months that are currently 30 days or more past due
        g980s_inquiries_in_the_last_6_months: number; // Number of deduped inquiries in past 6 months
        re20s_age_of_oldest_revolving_account_in_months: number; // Months since oldest revolving trade opened
        s207s_months_since_most_recent_public_record_bankruptcy: number; // Months since most recent public record bankruptcy
        re33s_balance_owed_on_all_revolving_accounts: number; // Total balance of open revolving trades verified in past 12 months
        at57s_amount_delinquent: number; // Total past due amount of open trades verified in past 12 months
        g099s_public_records_last_24_months: number; // Number of public record bankruptcies in past 24 months
        at20s_oldest_trade_open_date: number; //	Months since oldest trade opened
        at03s_current_credit_lines: number; // Number of open trades currently satisfactory
        re101s_revolving_balance: number; // Total balance of all revolving trades verified in past 12 months
        bc34s_bankcard_utilization: number; // Utilization for open credit card trades verified in past 12 months (percentage)
        at01s_credit_lines: number; // Number of trades
        fico_score: string; // Binned FICO score of the borrower. To determine if the FICO score is from Experian or TransUnion for the listing, look for the value of the decision_bureau element. (I believe just TransUnion now). It's a range ie) 800-819
    },
    historical_return: number; // Average historical return for all loans within this Prosper rating expressed as a decimal.
    historical_return_10th_pctl: number; // Average historical return for all loans within this Prosper rating at the 10th percentile mark, expressed as a decimal.
    historical_return_90th_pctl: number; //Average historical return for all loans within this Prosper rating at the 90th percentile mark, expressed as a decimal.
    co_borrower_application: boolean; // An indication whether the listing is a co-borrower application.
    listing_start_date: string; // Listing Start Date - date format 'yyyy-MM-dd'
    listing_number: number; // Listing Number as found on the Prosper site
    investment_product_id: number; // 1 – Standard | 2 – Series 1
    decision_bureau: string; // The value of this element shows which credit bureau’s underwriting data was used to generate the terms within the listing. Experian || TransUnion
    listing_creation_date: string; // Listing Creation Datedate format ‘yyyy-MM-dd’
    listing_status: number; // Where the listing is within the Prosper Marketplace listings lifecycle:·
    listing_status_reason: string; // A textual description corresponding to the listing_status number described above.
    verification_stage: number; // A three-stage indicator of the progress on the loan, based on Prosper’s verification of the borrower’s information and documents submitted that are key to evaluating the loan. The further along in verification, the higher the verification stage and the more likely the loan will originate.
    listing_amount: number; // Loan amount requested by borrower.
    amount_funded: number; // Amount of the listing funded
    amount_remaining: number; // Amount remaining for funding.
    percent_funded: number; // Percent of the listing funded
    partial_funding_indicator: boolean; // If true, the borrower is approved for partial funding. Borrowers can choose to partially fund their listing if it is at least 70% funded at the end of the listing period. This field is not applicable when investment_typeid=2.
    funding_threshold: number; // Funding threshold to originate
    prosper_rating: string; // A proprietary rating developed by Prosper allowing you to analyze a listing’s level of risk.
    lender_yield: number; // The borrower’s interest rate less the investor servicing fee.
    borrower_rate: number; // The borrower’s interest rate on the Loan
    borrower_apr: number; // Borrower APR
    listing_term: number; // Months over which the loan amortizes. Values can be: 36 || 60
    listing_monthly_payment: number; // Monthly payment associated with the listing
    prosper_score: number; // A custom risk score built using historical Prosper data. The score ranges from 1 to 11, 11 having the lowest risk.
    listing_category_id: number; // Broad borrower-reported loan purpose expressed as an integer. This value will map to the listing_title value in your response.
    listing_title: string; // The title is determined by the type of loan selected by the borrower (Debt Consolidation, Home Improvement, Large Purchase, Household Expenses, Special Occassion, Vacation, Taxes, etc.)
    lender_indicator: number; // Borrower also has a investor Role. 0 = Holds borrower role only. 1 = Holds both borrower and investor roles.
    amount_participation: number; // Amount already invested by the authenticated user
    investment_typeid: number; // The type of loan offering: 1 – Fractional || 2 – Whole
    investment_type_description: string; // A string that corresponds to the listing’s investment_typeid.
    last_updated_date: string; // Last updated date for the listing.
    invested: boolean; // indicator if user has already invested in this particular loan
    biddable: boolean; // indicator if the user is able to invest in the loan
    has_mortgage: boolean; // An indication whether the borrower has an outstanding mortgage.
    estimated_monthly_housing_expense: number; // The estimated monthly housing expense for the borrower.
    member_key: string; // Borrower unique ID/Member key
    income_range: string; // You may specify values from 0 to 7.
    income_range_description: string; // A textual description corresponding to the income_range number described above.
    stated_monthly_income: number; // The borrower’s monthly income, as provided by the borrower.
    income_verifiable: boolean; // The borrower stated that they could verify their stated income.
    dti_wprosper_loan: number; // Debt to income ratio including the pro-forma monthly payment of the entire listing amount posted by the borrower.
    employment_status_description: string; // General employment status description (employed, self-employed, etc…)
    occupation: string; // Occupation Name
    borrower_state: string; // State, abbreviated.(CA, TX, MA, etc.)
    months_employed: number; // Length of employment in months.
}

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
}}: loan) : boolean => {
    let shouldInvest = true
    const averageFico = convertFicoToAverage(fico_score)
    // Handle your filters this way, if a requirement isn't met then return false
    if (averageFico < 650) return false

    return true
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
