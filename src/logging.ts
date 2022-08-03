import fs from 'fs'
import path from 'path'

export const writeToLog = (message: string, filename: string) => {
    const logPath = path.resolve(__dirname, `../logs/${filename}`)
    
    var currentTime = new Date().toLocaleString("en-US", { timeZone: process.env.TIME_ZONE })
    fs.appendFile(logPath, `${message} - ${currentTime}\n`, (err) => {
        if (err) throw err
        console.log(`Logging to ${filename}.`)
    });
}
