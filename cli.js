#!/usr/bin/env node
const { program } = require('commander');
const net = require('net');
const { spawn } = require('child_process');
const path = require('path');

const PORT = (function() {
    const envPort = parseInt(process.env.CHARLEY_PORT || '', 10);
    return Number.isInteger(envPort) ? envPort : 30303;
})();
const HOST = '127.0.0.1';

function sendCommand(command) {
    return new Promise((resolve, reject) => {
        const client = new net.Socket();

        // General timeout for the entire operation
        const operationTimeout = setTimeout(() => {
            client.destroy(); // Clean up the socket
            reject(new Error('Operation timed out. The main application may be unresponsive.'));
        }, 8000); // 8-second timeout for the whole process

        client.connect(PORT, HOST, () => {
            client.write(JSON.stringify(command));
        });

        let responseData = '';
        client.on('data', (data) => {
            responseData += data.toString();
        });

        client.on('close', () => {
            clearTimeout(operationTimeout); // Success, clear the timeout
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
            clearTimeout(operationTimeout); // Error, clear the timeout
            if (err.code === 'ECONNREFUSED') {
                reject(new Error('Application not running. Please start it with `npm start` (GUI) or `charley start` (background).'));
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
    .name('charley')
    .description('Charley Clips CLI')
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
        const maxAttempts = 40; // up to ~10s
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
        console.warn('Application may not be ready yet. Try running `charley status` in a moment.');
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

// Config subcommands
const configCmd = program.command('config').description('Manage Charley Clips configuration');

configCmd
    .command('get [key]')
    .description('Get entire config or a single key')
    .action(async (key) => {
        try {
            const payload = { action: 'config_get' };
            if (key) payload.key = key;
            const value = await sendCommand(payload);
            console.log(typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value));
        } catch (e) {
            console.error(e.message);
        }
    });

configCmd
    .command('set <key> <value>')
    .description('Set a config value (number, boolean, or string)')
    .action(async (key, value) => {
        try {
            const result = await sendCommand({ action: 'config_set', key, value });
            console.log(JSON.stringify(result, null, 2));
        } catch (e) {
            console.error(e.message);
        }
    });

configCmd
    .command('path')
    .description('Show the path to the config file')
    .action(async () => {
        try {
            const info = await sendCommand({ action: 'config_path' });
            console.log(info.path || info);
        } catch (e) {
            console.error(e.message);
        }
    });

configCmd
    .command('export')
    .description('Print the current configuration as JSON')
    .action(async () => {
        try {
            const cfg = await sendCommand({ action: 'config_export' });
            console.log(JSON.stringify(cfg, null, 2));
        } catch (e) {
            console.error(e.message);
        }
    });

configCmd
    .command('import <json>')
    .description('Import configuration from a JSON string')
    .action(async (jsonStr) => {
        try {
            const obj = JSON.parse(jsonStr);
            const cfg = await sendCommand({ action: 'config_import', payload: obj });
            console.log(JSON.stringify(cfg, null, 2));
        } catch (e) {
            console.error('Invalid JSON or import failed:', e.message);
        }
    });

// Diagnostic: health command
program
    .command('health')
    .description('Show health metrics from the running application')
    .action(async () => {
        try {
            const info = await sendCommand({ action: 'health' });
            console.log('Health check:');
            console.log(`- Uptime (s): ${Math.round(info.uptime)}`);
            console.log(`- Clipboard polling active: ${info.clipboardActive ? 'yes' : 'no'}`);
            const mem = info.memory || {};
            if (mem.rss) {
                const mb = (bytes) => (bytes / (1024 * 1024)).toFixed(2);
                console.log(`- Memory: rss=${mb(mem.rss)}MB heapTotal=${mb(mem.heapTotal)}MB heapUsed=${mb(mem.heapUsed)}MB`);
            }
        } catch (e) {
            console.error(e.message);
        }
    });

program.parseAsync(process.argv).catch(err => {
    console.error(`\x1b[31mError: ${err.message}\x1b[0m`);
    process.exit(1);
});