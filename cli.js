#!/usr/bin/env node
const { program } = require('commander');
const chalk = require('chalk');
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
    .version('1.0.0')
    .addHelpCommand(true)
    .showHelpAfterError(true)
    .addHelpText('after', `

Examples:
  $ charley start                   # Start the app with GUI
  $ charley start --headless        # Start in the background (no window)
  $ charley status                  # Check if the app is running
  $ charley show                    # Show the app window
  $ charley hide                    # Hide the app window
  $ charley add "Copied text"       # Add a new item into history
  $ charley list                    # List recent history items
  $ charley list --filter url       # List only URLs
  $ charley list --limit 5          # Limit results
  $ charley search "keyword"        # Search history
  $ charley clear                   # Clear entire history (with prompt)
  $ charley health                  # Show runtime health metrics
  $ charley config get              # Show entire configuration
  $ charley config set port 30444   # Update a configuration value
  $ CHARLEY_PORT=30444 charley status  # Use a custom port for this command

Hints:
  - Run 'charley help <command>' to see command-specific help and options.
  - The CLI talks to a background server over TCP (default port 30303).
  - You can change the port via the CHARLEY_PORT environment variable.
  - Current effective port: ${PORT}
`);

program
    .command('start')
    .alias('up')
    .description('Start the application')
    .option('--headless', 'Start in the background without a visible window')
    .action(async (options) => {
        if (await isAppRunning()) {
            console.log(chalk.yellow('Application is already running.'));
            return;
        }
        console.log(chalk.cyan('Starting application...'));
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
        console.log(chalk.green(`Application started ${options.headless ? 'in headless mode' : ''}. PID: ${child.pid}`));

        // Wait until ready: poll status for up to ~5 seconds
        const maxAttempts = 40; // up to ~10s
        const delayMs = 250;
        const wait = (ms) => new Promise(res => setTimeout(res, ms));
        for (let i = 0; i < maxAttempts; i++) {
            try {
                await sendCommand({ action: 'status' });
                console.log(chalk.green('Application is ready.'));
                return;
            } catch (_) {
                await wait(delayMs);
            }
        }
        console.warn(chalk.yellow('Application may not be ready yet. Try running `charley status` in a moment.'));
    })
    .addHelpText('after', `

Examples:
  $ charley start
  $ charley start --headless
  $ CHARLEY_PORT=30444 charley start --headless
`);

program
    .command('show')
    .alias('open')
    .description('Show the application window')
    .action(() => sendCommand({ action: 'show' }).then(() => console.log(chalk.green('Window shown.'))));

program
    .command('hide')
    .alias('close')
    .description('Hide the application window')
    .action(() => sendCommand({ action: 'hide' }).then(() => console.log(chalk.green('Window hidden.'))));
    
program
    .command('add <content>')
    .description('Add an item to the clipboard history')
    .action((content) => sendCommand({ action: 'add', payload: content }).then(() => console.log(chalk.green('Item added.'))))
    .addHelpText('after', `

Examples:
  $ charley add "Hello world"
  $ echo "from pipe" | xargs -0 -I {} charley add {}
`);

program
    .command('list')
    .alias('ls')
    .description('List clipboard history items')
    .option('-f, --filter <type>', 'Filter by type (text, url, code)')
    .option('-l, --limit <number>', 'Limit number of results', '20')
    .action(async (options) => {
        const output = await sendCommand({ action: 'list', filter: options.filter, limit: options.limit });
        console.log(output);
    })
    .addHelpText('after', `

Examples:
  $ charley list
  $ charley list --filter url
  $ charley list --limit 5
  $ charley list -f code -l 10
`);

program
    .command('search <query>')
    .alias('find')
    .description('Search clipboard history')
    .action(async (query) => {
        const output = await sendCommand({ action: 'search', payload: query });
        console.log(output);
    })
    .addHelpText('after', `

Examples:
  $ charley search "api key"
  $ charley find url
`);
    
program
    .command('clear')
    .alias('purge')
    .description('Clear all items from clipboard history')
    .action(() => {
        const readline = require('readline').createInterface({ input: process.stdin, output: process.stdout });
        readline.question('Are you sure you want to clear the entire history? (y/N) ', answer => {
            if (answer.toLowerCase() === 'y') {
                sendCommand({ action: 'clear' }).then(() => console.log(chalk.green('History cleared.')));
            } else {
                console.log(chalk.yellow('Clear operation cancelled.'));
            }
            readline.close();
        });
    });

program
    .command('status')
    .alias('st')
    .description('Check if the application is running')
    .action(async () => {
       try {
         const status = await sendCommand({ action: 'status' });
         console.log(chalk.green('Application is running.'));
         console.log(chalk.gray(`Total items in history: ${status.totalItems}`));
       } catch (e) {
         console.error(chalk.red(e.message));
       }
    })
    .addHelpText('after', `

Examples:
  $ charley status
  $ charley st
`);

program
    .command('stop')
    .alias('down')
    .description('Stop the running application')
    .action(async () => {
        try {
            await sendCommand({ action: 'stop' });
            console.log(chalk.yellow('Application stopping...'));
        } catch (e) {
            console.error(chalk.red(e.message));
        }
    })
    .addHelpText('after', `

Examples:
  $ charley stop
  $ charley down
`);

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

// Add examples footer for the config command group
configCmd.addHelpText('after', `

Examples:
  $ charley config get
  $ charley config get port
  $ charley config set port 30444
  $ charley config set enableLogging true
  $ charley config path
  $ charley config export
  $ charley config import '{"port":30444,"maxHistoryItems":200}'
`);

// Diagnostic: health command
program
    .command('health')
    .alias('hc')
    .description('Show health metrics from the running application')
    .action(async () => {
        try {
            const info = await sendCommand({ action: 'health' });
            console.log(chalk.cyan('Health check:'));
            console.log(chalk.gray(`- Uptime (s): ${Math.round(info.uptime)}`));
            console.log(chalk.gray(`- Clipboard polling active: ${info.clipboardActive ? 'yes' : 'no'}`));
            const mem = info.memory || {};
            if (mem.rss) {
                const mb = (bytes) => (bytes / (1024 * 1024)).toFixed(2);
                console.log(chalk.gray(`- Memory: rss=${mb(mem.rss)}MB heapTotal=${mb(mem.heapTotal)}MB heapUsed=${mb(mem.heapUsed)}MB`));
            }
        } catch (e) {
            console.error(chalk.red(e.message));
        }
    });

// Show help by default when no arguments are provided
if (process.argv.length <= 2) {
    program.outputHelp((txt) => chalk.bold(txt));
    process.exit(0);
}

program.parseAsync(process.argv).catch(err => {
    console.error(chalk.red(`Error: ${err.message}`));
    program.outputHelp((txt) => chalk.bold(txt));
    process.exit(1);
});