import dotenv from 'dotenv';
import path from 'path'

import ProsperApi from './prosper';
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
    await Prosper.login()

    const searchFilterOrder = async () => {
        console.log(`\nRunning searchFilterOrder, waiting ${delay} seconds before starting...`)
        await new Promise(resolve => setTimeout(resolve, (delay * 1000)));

        Prosper.reset()
        await Prosper.getAccountInfo()
        await Prosper.getListings()
        Prosper.filterAndSortListings()
        Prosper.setupLoansToOrder()
        await Prosper.orderLoans()

        const currentDate = new Date();
        const currentTime = currentDate.getTime();
        const timeElapsed = currentTime - startTime
        console.log(`Total time elapsed...${timeElapsed / 1000} seconds`)

        if (timeElapsed < maxTime) {
            searchFilterOrder()
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
