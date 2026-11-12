import fs from 'fs'
import path from 'path'

export const logsDirectory = path.resolve(__dirname, '../logs')
export const logFiles = ['failures.txt', 'success.txt', 'info.txt']

// Logging should never be the reason a run dies, so a failed write is only printed.
export const writeToLog = (message: string, filename: string) => {
    const logPath = path.join(logsDirectory, filename)
    const currentTime = new Date().toLocaleString("en-US", { timeZone: process.env.TIME_ZONE })

    try {
        fs.appendFileSync(logPath, `${message} - ${currentTime}\n`)
        console.log(`Logging to ${filename}.`)
    } catch (e) {
        console.log(`Could not write to ${filename}`, e)
    }
}

// Creates the log folder/file if missing. Once a file passes the limit it is moved to
// <name>.1 (replacing the previous <name>.1) and a fresh one is started, so each log
// takes at most about twice the limit on disk. A limit of 0 turns rotation off.
export const prepareLogFile = (filename: string, limitInMB: number) => {
    const logPath = path.join(logsDirectory, filename)

    fs.mkdirSync(logsDirectory, { recursive: true })

    if (!fs.existsSync(logPath)) {
        fs.writeFileSync(logPath, '')
        return
    }

    if (!limitInMB) return

    const fileSizeInMB = fs.statSync(logPath).size / (1024 * 1024)
    if (fileSizeInMB > limitInMB) {
        fs.renameSync(logPath, `${logPath}.1`)
        fs.writeFileSync(logPath, '')
        console.log(`Rotated ${filename} to ${filename}.1`)
    }
}
