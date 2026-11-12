import dotenv from 'dotenv';
import path from 'path'

import ProsperApi from './prosper';
import { writeToLog } from './logging';
import {
    checkEnvVariables,
    checkLogFiles,
} from './setupChecks';

// Done this way so anything running the script can find the .env (for me it's cronjobs)
const envPath = path.resolve(__dirname, '..');
dotenv.config({ path: envPath + '/.env' });

const startDate = new Date();
const startTime = startDate.getTime();

console.log('Start Prosper API', { startTime });

const checkLoans = async ({ delay, maxTime }: { delay: number, maxTime: number }) => {
    const Prosper = new ProsperApi();
    const logInfo = (message: string) => {
        console.log(message)
        if (Prosper.enableLogging) writeToLog(message, 'info.txt')
    }

    // One line when a run starts and one when it ends, so info.txt shows every cron firing
    logInfo('Run started')

    try {
        await Prosper.login()
    } catch (e: any) {
        Prosper.logFailure(e?.message || e)
        logInfo('Run stopped: could not log in, see failures.txt')
        return
    }

    const searchFilterOrder = async () => {
        console.log(`\nRunning searchFilterOrder, waiting ${delay} seconds before starting...`)
        await new Promise(resolve => setTimeout(resolve, (delay * 1000)));

        try {
            Prosper.stats.polls++
            Prosper.reset()
            await Prosper.getAccountInfo()
            await Prosper.getListings()
            Prosper.filterAndSortListings()
            Prosper.setupLoansToOrder()
            await Prosper.orderLoans()
        } catch (e: any) {
            // A bad poll shouldn't end the run, the next one may be fine
            Prosper.logFailure(e?.stack || e)
        }

        const currentDate = new Date();
        const currentTime = currentDate.getTime();
        const timeElapsed = currentTime - startTime
        console.log(`Total time elapsed...${timeElapsed / 1000} seconds`)

        if (timeElapsed < maxTime) {
            searchFilterOrder()
        } else {
            logInfo(`Run finished: ${Prosper.runSummary()}`)
        }
    }

    searchFilterOrder()
}

(async function () {
    const envVariablesAreSet = checkEnvVariables()
    let logFilesAreSet = true

    if (process.env.ENABLE_LOGGING === 'TRUE') {
        console.log('log files are set')
        logFilesAreSet = await checkLogFiles()
    }

    if (envVariablesAreSet && logFilesAreSet) {
        console.log('All checks passed...running script...')
        checkLoans({
            delay: Number(process.env.DELAY_IN_SECONDS),
            maxTime: (Number(process.env.RUN_TIME_IN_MINUTES) * 60 * 1000)
        })
    }
})()
