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
As is for all node packages run `npm install` or `yarn` to install all necessary packages.


## Setup
Next is to ensure you have your log folder/files setup. To do that create a folder `logs` in the root repository of the repo
and add the files.
- failures.txt
- info.txt
- success.txt

Once your log files are all setup create a .env file in the root of the repository based off .env.example.

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
- `LOG_FILE_SIZE_LIMIT_IN_MB` - Prevents the script from running if the log files are larger than we set the limit to. If set to 0 then we ignore this check.

- `DELAY_IN_SECONDS` - How long we wait to recheck listings.
- `RUN_TIME_IN_MINUTES` - How long the script will be running for.

For info on the Prosper API checkout their [docs](https://developers.prosper.com/docs/). 

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

The way it is currently setup there is no preset filtering besides one example within `checkTransunionData`. Each of the functions must return a boolean which would determine if we should invest in the loan or not.

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

Here's an example of my `cronjob -l` running on my AWS ec2.
```
0 16,22 * * 1-5 ~/.nvm/versions/node/v16.0.0/bin/node /home/ec2-user/prosper-api/dist/index.js
0 19 * * 0,6 ~/.nvm/versions/node/v16.0.0/bin/node /home/ec2-user/prosper-api/dist/index.js
```

## Misc
This script makes use of [Prosper's](https://www.prosper.com/) API.

New Loans are added to the website:
- Monday - Friday - 12pm and 6pm ET
- Saturday & Sunday - 3pm ET
