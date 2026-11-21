# Prosper Automated Investing
A script that allows the user to invest in loans based on a filter targeting all the various datapoints of a prosper loan. The filters must be set by the user as this does not come preset with any filters for investing in loans. This provides everything you need to automatically invest based off of predefined filters but does not make any recommendations with how to invest. It does not work right out of the box as it requires some initial setup to get going.

## Table of Contents
- [Installation](#installation)
- [Setup](#setup)
- [Usage](#usage)
- [Filters](#filters)
- [Sorting](#sorting)
- [Running](#running)
- [Misc](#misc)


## Installation
This project runs on Node 24 (see `.nvmrc` and `engines` in `package.json`). With nvm, run `nvm use` in the repo first.

As is for all node packages run `npm install` or `yarn` to install all necessary packages.


## Setup
The script keeps its log files in a `logs` folder in the root of the repo, and creates them on the first run if they are missing.
- failures.txt - API errors and rejected orders
- info.txt - one `Run started` line and one `Run finished` summary line per run, so you can see every time the script fired and what it found
- success.txt - orders that Prosper accepted
- filters.txt - one line for each listing that passed at least one rule set, showing what every rule set decided and why
- filter-listings.jsonl - the full listing data for those same listings, one JSON object per line

After the logs are setup you should create your rule sets by copying the example folder: `cp -r src/filters.example src/filters`. `src/filters` is ignored by git so your rules stay private. More information on filtering can be found in the [Filters](#filters) section.

Once the log and filter files are setup, next create a .env file in the root of the repository based off .env.example.

While looking at the .env file you may notice you can enable AWS SNS which would is handy if you would like to know
when you actually invest in a loan instead of having to check prosper yourself. It will also alert you when there is
an API failure in the app to you can check it out instead of leaving it running. If you don't want to setup SNS
then you can just set `USE_AWS_SNS` to FALSE. All the .env variables should be pretty self explanatory.

If you do choose to enable AWS SNS then you need to ensure you have your aws credentials set on your machine as seen below.

```
// ~/.aws/credentials
[default]
aws_access_key_id = <YOUR KEY ID HERE>
aws_secret_access_key = <YOUR ACCESS KEY HERE>
```

In addition you need to ensure you have SNS setup correctly. How to do that is not included in this README yet but may be in the future.
See here for more info - [AWS SNS](https://aws.amazon.com/sns/)

### .env variables
- `PROSPER_CLIENT_ID` - API ID you get when activating APIs on your prosper account 
- `PROSPER_CLIENT_SECRED` - API secret you get when activating APIs on your prosper account 
- `PROSPER_USERNAME` - Username you log into your prosper account with (email address)
- `PROSPER_PASSWORD` - Password you use to login to your prosper account

- `USE_AWS_SNS` - 'TRUE' or 'FALSE' indicating if you want to use AWS SNS service
- `AWS_REGION` - The region of your AWS SNS service
- `AWS_TOPIC_ARN` - The topic arn of your AWS SNS service

- `EMULATE_ORDER` - 'TRUE' or 'FALSE' if 'TRUE' you won't actually place orders, for testing purposes.
- `LOAN_INVESTMENT_AMOUNT` - The amount of money you want to invest in each loan. Minimum of 25 and must be in 25 increments
- `TIME_ZONE` - THe time zone you are in for logging timestamp purposes. ie) 'America/New_York'

- `ENABLE_LOGGING` - If 'TRUE' it would enable logging to the log files we specified earlier.
- `LOG_FILE_SIZE_LIMIT_IN_MB` - When a log file grows past this size it is moved to `<name>.1` (replacing the previous one) and a fresh file is started, so each log takes at most about twice this much disk. The script never stops because of log size. If set to 0 the logs are never rotated.

- `DELAY_IN_SECONDS` - How long we wait to recheck listings.
- `RUN_TIME_IN_MINUTES` - How long the script will be running for.
- `REQUEST_TIMEOUT_IN_SECONDS` - Optional, defaults to 10. How long to wait on a Prosper API call before giving up and moving on to the next check. Logging in and placing an order always wait at least 30 seconds.

## Usage
The purpose of this script is to make automatically investing in Prosper Loans a breeze. The benefit of using this API script instead of the automated investing offered on the Prosper website is you can more fine tunely set your filters for invested. 

For example on the website you can specify fico score range but with this filter you can specify fico score range but also change your range around depending on their debt to income ratio. So if someone has a very low DTI then maybe you will allow a fico score of 700+ instead of 760.

Another benefit is that the API scripts get first dibs at new loans when they are dropped allowing you to invest in the best loans before they are gone. 


## Filters
The way the filtering works for the loans is fairly simple. We are essentially just running a Array.filter() on the list of loans retrieved from prosper. When analyzing the loans with filter they are broken up into 4 categories just for easier management, you can refer to any loan key in any of the functions regardless of what their purpose is.

- checkPriorProsperLoans
- checkTransunionData
- checkListingInfo
- checkBorrowerInfo

The way it is currently setup there is no preset filtering besides one example within `checkTransunionData`. Each function returns either a boolean (should we invest or not) or a list of reasons for rejecting the loan, where an empty list means it passes. Returning reasons is worth the small effort: they are written to `logs/filters.txt` so you can see exactly why a loan was skipped.

### Rule sets
Every `.ts` file in `src/filters` is a rule set, named after the file. You can keep several side by side, for example the rules you used last year next to the ones you use now. On every run each listing is checked against all of them, but only one rule set places orders.

- With one rule set, that one buys.
- With more than one, set `ACTIVE_FILTER` in `.env` to the file name (without `.ts`) of the one that should buy. The script refuses to run until you do, it will not guess which rules spend your money.

The other rule sets never buy anything. They are there so you can compare:

- `logs/filters.txt` gets a line for every listing that passed at least one rule set, e.g. `[123] AA yield 7.9% 60mo ... | old-rules: PASS | new-rules (buying): FAIL (at02s_open_accounts=24)`
- the `Run finished` line in `logs/info.txt` shows how many listings passed each rule set during the run

This makes it easy to see what a rule change is costing or saving you before and after you switch to it. A file name starting with `_` is ignored, which is a handy way to park a rule set.

## Sorting
Sorting should be done after filtering to prioritize the remaining loans that are left. Sorting is not really necessary but if you have a bunch of loans that pass the filtering stage then it's good to prioritize which ones you want to invest in if you don't have enough money to invest in them all. Sorting is just running an Array.sort(), you can see an example usecase in `src/sort.ts` where it is sorting based on average fico score and debt to income ration w/ prosper loan.

## Running
> ⚠️ If it is your first time running the script after changing filters it'd be a safe bet to run with `EMULATE_ORDER=TRUE` to ensure your filters are setup as anticipated.

Once everything is setup you are ready to run the script! If you run this with no filters then you will invest in every loan in $25 incriments until you run out of cash so make sure they're setup correctly.

### For Development Purposes
To run the script for development/testing purposes simply run
`npm run dev` or `yarn dev`. That will compile the TS files into the dist folder and then will run `dist/index.js.`

### For Production
So when the script starts it will run until the time limit specified by `RUN_TIME_IN_MINUTES` is reached. It is not setup to run indefinitely as that seems a bit excessive since loans are released at specific times. The way I have this setup to run is I build the package and then use a cronjob to run `dist/index.js`.

Here's an example of my `crontab -l` on a machine whose clock is set to Eastern time, running Node 24. Each run starts two minutes before new loans are added (see [Misc](#misc)). Cron uses the machine's time zone, so shift the hours if yours isn't Eastern.
```
58 11,17 * * 1-5 cd /home/me/prosper-investors-api && /usr/bin/node dist/index.js
58 14 * * 0,6 cd /home/me/prosper-investors-api && /usr/bin/node dist/index.js
```

## Misc
This script makes use of [Prosper's](https://www.prosper.com/) API.

New Loans are added to the website:
- Monday - Friday - 12pm and 6pm ET
- Saturday & Sunday - 3pm ET

For more info on the Prosper API checkout their [docs](https://developers.prosper.com/docs/). 
