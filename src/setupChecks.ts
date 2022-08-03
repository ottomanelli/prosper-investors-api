import fs from 'fs'
import path from 'path'
import { sendSMS } from './sns'

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


// Checks for if the necessary log files exist.
// Also checks if the log files are larger than what we specified in MB, just added here as 
// I was logging a bunch and didn't realize how large the file was getting on my ec2
export const checkLogFiles = async () : Promise<boolean> => {
    const logsDirectory = path.resolve(__dirname, '../logs');
    const dirExists = fs.existsSync(logsDirectory)

    const USE_AWS_SNS = process.env.USE_AWS_SNS === 'TRUE'
    const logFileLimit = Number(process.env.LOG_FILE_SIZE_LIMIT_IN_MB)

    if (dirExists) {
        const failuresLogPath = path.resolve(__dirname, '../logs/failures.txt')
        const failuresLogExists = fs.existsSync(failuresLogPath);

        const successLogPath = path.resolve(__dirname, '../logs/success.txt')
        const successLogExists = fs.existsSync(successLogPath);

        const infoLogPath = path.resolve(__dirname, '../logs/info.txt')
        const infoLogExists = fs.existsSync(infoLogPath);

        if (!failuresLogExists) {
            console.log('Please create a failures.txt file in the logs folder in the root of the repo.')
            return false
        } else if (logFileLimit) {
            const infoLogSize = fs.statSync(failuresLogPath).size
            const fileSizeinMB = infoLogSize / (1024*1024)
            if (fileSizeinMB > Number(process.env.LOG_FILE_SIZE_LIMIT_IN_MB)) {
                const message = 'Your log file failures.txt is too large. Please increase your log file limit or delete old logs.'
                if (USE_AWS_SNS) await sendSMS(message)
                return false
            }
        }

        if (!successLogExists) {
            console.log('Please create a success.txt file in the logs folder in the root of the repo.')
            return false
        } else if (logFileLimit) {
            const infoLogSize = fs.statSync(successLogPath).size
            const fileSizeinMB = infoLogSize / (1024*1024)
            if (fileSizeinMB > Number(process.env.LOG_FILE_SIZE_LIMIT_IN_MB)) {
                const message = 'Your log file success.txt is too large. Please increase your log file limit or delete old logs.'
                if (USE_AWS_SNS) await sendSMS(message)
                return false
            }
        }

        if (!infoLogExists) {
            console.log('Please create a info.txt file in the logs folder in the root of the repo.')
            return false
        } else if (logFileLimit) {
            const infoLogSize = fs.statSync(infoLogPath).size
            const fileSizeinMB = infoLogSize / (1024*1024)
            if (fileSizeinMB > Number(process.env.LOG_FILE_SIZE_LIMIT_IN_MB)) {
                const message = 'Your log file info.txt is too large. Please increase your log file limit or delete old logs.'
                if (USE_AWS_SNS) await sendSMS(message)
                return false
            }
        }

    } else {
        console.log('Please create a logs folder in the root of the repo and add failures.txt, info.txt, and success.txt.')
        return false
    }

    return true
}
