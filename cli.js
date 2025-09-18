#!/usr/bin/env node
const { program } = require('commander');
const net = require('net');
const { spawn } = require('child_process');
const path = require('path');

const PORT = 30303;
const HOST = '127.0.0.1';

function sendCommand(command) {
    return new Promise((resolve, reject) => {
        const client = new net.Socket();
        
        client.connect(PORT, HOST, () => {
            client.write(JSON.stringify(command));
        });

        let responseData = '';
        client.on('data', (data) => {
            responseData += data.toString();
        });

        client.on('close', () => {
            try {
                const response = JSON.parse(responseData);
                if (response.status === 'ok') {
                    resolve(response.payload);
                } else {
                    reject(new Error(response.message || 'Command failed'));
                }
            } catch (e) {
                 const errorMessage = `Failed to parse response from app. Is it running?\nRaw response: ${responseData}`;
                 reject(new Error(errorMessage));
            }
        });

        client.on('error', (err) => {
            if (err.code === 'ECONNREFUSED') {
                reject(new Error('Application not running. Please start it with `clipboard-history start`.'));
            } else {
                reject(err);
            }
        });
    });
}

async function isAppRunning() {
    try {
        await sendCommand({ action: 'status' });
        return true;
    } catch (e) {
        return false;
    }
}


program
    .name('clipboard-history')
    .description('CLI for Clipboard History Pro')
    .version('1.0.0');

program
    .command('start')
    .description('Start the application')
    .option('--headless', 'Start in the background without a visible window')
    .action(async (options) => {
        if (await isAppRunning()) {
            console.log('Application is already running.');
            return;
        }
        console.log('Starting application...');
        // Correctly get the path to the Electron executable
        const electronPath = require('electron');
        const appPath = path.join(__dirname, 'main.js');
        
        const args = [appPath];
        if (options.headless) {
            args.push('--headless');
        }
        
        const child = spawn(electronPath, args, {
            detached: true,
            stdio: 'ignore'
        });
        child.unref();
        console.log(`Application started ${options.headless ? 'in headless mode' : ''}. PID: ${child.pid}`);

        // Wait until ready: poll status for up to ~5 seconds
        const maxAttempts = 20;
        const delayMs = 250;
        const wait = (ms) => new Promise(res => setTimeout(res, ms));
        for (let i = 0; i < maxAttempts; i++) {
            try {
                await sendCommand({ action: 'status' });
                console.log('Application is ready.');
                return;
            } catch (_) {
                await wait(delayMs);
            }
        }
        console.warn('Application may not be ready yet. Try running `clipboard-history status` in a moment.');
    });

program
    .command('show')
    .description('Show the application window')
    .action(() => sendCommand({ action: 'show' }).then(() => console.log('Window shown.')));

program
    .command('hide')
    .description('Hide the application window')
    .action(() => sendCommand({ action: 'hide' }).then(() => console.log('Window hidden.')));
    
program
    .command('add <content>')
    .description('Add an item to the clipboard history')
    .action((content) => sendCommand({ action: 'add', payload: content }).then(() => console.log('Item added.')));

program
    .command('list')
    .description('List clipboard history items')
    .option('-f, --filter <type>', 'Filter by type (text, url, code)')
    .option('-l, --limit <number>', 'Limit number of results', '20')
    .action(async (options) => {
        const output = await sendCommand({ action: 'list', filter: options.filter, limit: options.limit });
        console.log(output);
    });

program
    .command('search <query>')
    .description('Search clipboard history')
    .action(async (query) => {
        const output = await sendCommand({ action: 'search', payload: query });
        console.log(output);
    });
    
program
    .command('clear')
    .description('Clear all items from clipboard history')
    .action(() => {
        const readline = require('readline').createInterface({ input: process.stdin, output: process.stdout });
        readline.question('Are you sure you want to clear the entire history? (y/N) ', answer => {
            if (answer.toLowerCase() === 'y') {
                sendCommand({ action: 'clear' }).then(() => console.log('History cleared.'));
            } else {
                console.log('Clear operation cancelled.');
            }
            readline.close();
        });
    });

program
    .command('status')
    .description('Check if the application is running')
    .action(async () => {
       try {
         const status = await sendCommand({ action: 'status' });
         console.log('Application is running.');
         console.log(`Total items in history: ${status.totalItems}`);
       } catch (e) {
         console.error(e.message);
       }
    });

program
    .command('stop')
    .description('Stop the running application')
    .action(async () => {
        try {
            await sendCommand({ action: 'stop' });
            console.log('Application stopping...');
        } catch (e) {
            console.error(e.message);
        }
    });

program.parseAsync(process.argv).catch(err => {
    console.error(`\x1b[31mError: ${err.message}\x1b[0m`);
    process.exit(1);
});