import { logFiles, prepareLogFile } from './logging'

export const checkEnvVariables = () : boolean => {
    const {
        PROSPER_CLIENT_ID,
        PROSPER_CLIENT_SECRED,
        PROSPER_USERNAME,
        PROSPER_PASSWORD,
        USE_AWS_SNS,
        AWS_REGION,
        AWS_TOPIC_ARN,
        EMULATE_ORDER,
        LOAN_INVESTMENT_AMOUNT,
        TIME_ZONE,
        ENABLE_LOGGING,
        LOG_FILE_SIZE_LIMIT_IN_MB,
        DELAY_IN_SECONDS,
        RUN_TIME_IN_MINUTES,
    } = process.env;

    if (!PROSPER_CLIENT_ID) {
        console.log('Please set PROSPER_CLIENT_ID in .env...stopping script.')
        return false
    }

    if (!PROSPER_CLIENT_SECRED) {
        console.log('Please set PROSPER_CLIENT_SECRED in .env...stopping script.')
        return false
    }

    if (!PROSPER_USERNAME) {
        console.log('Please set PROSPER_USERNAME in .env...stopping script.')
        return false
    }

    if (!PROSPER_PASSWORD) {
        console.log('Please set PROSPER_PASSWORD in .env...stopping script.')
        return false
    }

    if (!USE_AWS_SNS) {
        console.log('Please set USE_AWS_SNS in .env...stopping script.')
        return false
    }

    if (USE_AWS_SNS === 'TRUE') {
        if (!AWS_TOPIC_ARN) {
            console.log('Please set AWS_TOPIC_ARN in .env...stopping script.')
            return false
        }

        if (!AWS_REGION) {
            console.log('Please set AWS_REGION in .env...stopping script.')
            return false
        }
    }

    if (!EMULATE_ORDER) {
        console.log('Please set EMULATE_ORDER in .env...stopping script.')
        return false
    }

    if (!LOAN_INVESTMENT_AMOUNT) {
        console.log('Please set LOAN_INVESTMENT_AMOUNT in .env...stopping script.')
        return false
    }

    if (!TIME_ZONE) {
        console.log('Please set TIME_ZONE in .env...stopping script.')
        return false
    }

    if (!ENABLE_LOGGING) {
        console.log('Please set ENABLE_LOGGING in .env...stopping script.')
        return false
    }

    if (!LOG_FILE_SIZE_LIMIT_IN_MB) {
        console.log('Please set LOG_FILE_SIZE_LIMIT_IN_MB in .env...stopping script.')
        return false
    }

    if (!DELAY_IN_SECONDS) {
        console.log('Please set DELAY_IN_SECONDS in .env...stopping script.')
        return false
    }

    if (!RUN_TIME_IN_MINUTES) {
        console.log('Please set RUN_TIME_IN_MINUTES in .env...stopping script.')
        return false
    }

    return true
}


// Makes sure the log folder and files exist and rotates any that grew past
// LOG_FILE_SIZE_LIMIT_IN_MB. A log problem is reported but never stops a run.
export const checkLogFiles = async () : Promise<boolean> => {
    const logFileLimit = Number(process.env.LOG_FILE_SIZE_LIMIT_IN_MB)

    for (const filename of logFiles) {
        try {
            prepareLogFile(filename, logFileLimit)
        } catch (e) {
            console.log(`Could not prepare log file ${filename}`, e)
        }
    }

    return true
}
