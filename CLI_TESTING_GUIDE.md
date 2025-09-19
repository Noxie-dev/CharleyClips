# Clipboard History Pro - CLI and Headless Testing Guide

## Prerequisites

Before testing the CLI and headless features, ensure you have the following installed:

1. **Node.js** (version 16 or higher)
2. **npm** (comes with Node.js)

## Step 1: Quick Setup (Recommended)

For a quick automated setup, run the setup script:

```bash
# Make setup script executable
chmod +x setup-cli.sh

# Run automated setup
./setup-cli.sh
```

This will install all dependencies, build the React app, and set up the CLI.

## Step 1 (Alternative): Manual Installation

If you prefer to install manually, run these commands in the project root directory:

```bash
# Install main project dependencies
npm install

# Install React app dependencies
cd clipboard-pro
npm install
cd ..
```

## Step 2: Build the React App

The Electron app loads the React app from the `clipboard-pro/dist` directory, so we need to build it first:

```bash
cd clipboard-pro
npm run build
cd ..
```

## Step 3: Test CLI Installation

### Option A: Install Globally (Recommended)
```bash
# Install the CLI globally
npm install -g .

# Test global installation
clipboard-history --help
```

### Option B: Use Local CLI
```bash
# Make CLI executable
chmod +x cli.js

# Test local CLI
node cli.js --help
```

Expected output:
```
Usage: clipboard-history [options] [command]

CLI for Clipboard History Pro

Options:
  -V, --version   display version number
  -h, --help      display help for command

Commands:
  start [options] Start the application
  show            Show the application window
  hide            Hide the application window
  add <content>   Add an item to the clipboard history
  list [options]  List clipboard history items
  search <query>  Search clipboard history
  clear           Clear all items from clipboard history
  status          Check if the application is running
  stop            Stop the running application
  help [command]  display help for command
```

## Step 4: Test Headless Mode

### Start in Headless Mode
```bash
# Using global CLI
clipboard-history start --headless

# OR using local CLI
node cli.js start --headless
```

Expected output:
```
Starting application...
Application started in headless mode. PID: [process_id]
Application is ready.
```

### Verify Headless Mode is Running
```bash
clipboard-history status
```

Expected output:
```
Application is running.
Total items in history: 0
```

## Step 5: Test CLI Commands

### Add Items to History
```bash
# Add a text item
clipboard-history add "Hello, this is a test item"

# Add a URL
clipboard-history add "https://github.com/example/repo"

# Add some code
clipboard-history add "function test() { return 'hello'; }"
```

Expected output for each:
```
Item added.
```

### List History Items
```bash
# List all items
clipboard-history list

# List with limit
clipboard-history list --limit 5

# Filter by type
clipboard-history list --filter text
clipboard-history list --filter url
clipboard-history list --filter code
```

Expected output format:
```
[12/19/2024, 12:39:16 PM] [text]
Hello, this is a test item

[12/19/2024, 12:39:20 PM] [url]
https://github.com/example/repo

[12/19/2024, 12:39:25 PM] [code]
function test() { return 'hello'; }
```

### Search History
```bash
# Search for specific content
clipboard-history search "test"
clipboard-history search "github"
clipboard-history search "function"
```

Expected output:
```
[12/19/2024, 12:39:16 PM] [text]
Hello, this is a test item

[12/19/2024, 12:39:25 PM] [code]
function test() { return 'hello'; }
```

### Check Status
```bash
clipboard-history status
```

Expected output:
```
Application is running.
Total items in history: 3
```

## Step 6: Test Window Management (GUI Mode)

### Start with GUI
```bash
# Stop headless mode first
clipboard-history stop

# Start with GUI
clipboard-history start
```

### Hide/Show Window
```bash
# Hide the window
clipboard-history hide

# Show the window
clipboard-history show
```

## Step 7: Test Clipboard Monitoring

When the app is running (headless or GUI), it automatically monitors your system clipboard:

1. Copy some text to your clipboard (Cmd+C)
2. Check if it was added: `clipboard-history list --limit 1`
3. The most recent item should be what you just copied

## Step 8: Test Cleanup

### Clear History
```bash
clipboard-history clear
```

You'll be prompted for confirmation:
```
Are you sure you want to clear the entire history? (y/N)
```

Type `y` and press Enter.

### Stop Application
```bash
clipboard-history stop
```

Expected output:
```
Application stopping...
```

## Step 9: Run Automated Test Scripts

The project includes multiple test scripts:

### Quick Test (Recommended)
```bash
# Make test script executable
chmod +x quick-test.sh

# Run quick test
./quick-test.sh
```

### Comprehensive Test
```bash
node test-cli.js
```

This script will:
1. Start the app in headless mode
2. Test all CLI commands
3. Verify responses
4. Clean up automatically

Expected output:
```
🧪 Testing Charley Clips CLI and Headless Implementation

1. Starting Electron app in headless mode...
   ✅ Electron process started with PID: [pid]

2. Testing CLI server connection...
   ✅ CLI server is running and responsive
   📊 Status response: { totalItems: 0 }

3. Testing CLI commands...
   📝 Testing add command...
   ✅ Add command response: { status: 'ok' }
   
   📋 Testing list command...
   ✅ List command response: { status: 'ok', payload: '[timestamp] [text]\nTest clipboard item from CLI test' }
   
   🔍 Testing search command...
   ✅ Search command response: { status: 'ok', payload: '[timestamp] [text]\nTest clipboard item from CLI test' }
   
   📊 Testing status command...
   ✅ Final status response: { status: 'ok', payload: { totalItems: 1 } }

🎉 All tests passed! CLI and headless mode are working correctly.

4. Cleaning up...
   ✅ Electron process terminated
```

## Troubleshooting

### Common Issues

1. **"Application not running" error**
   - Make sure you started the app with `clipboard-history start` or `clipboard-history start --headless`
   - Check if another instance is running: `clipboard-history status`

2. **"Command not found: clipboard-history"**
   - Install globally: `npm install -g .`
   - Or use local CLI: `node cli.js [command]`

3. **"Failed to load React app" error**
   - Build the React app: `cd clipboard-pro && npm run build`
   - Check if `clipboard-pro/dist` contains built files

4. **Port 30303 in use**
   - Another instance might be running
   - Stop it with: `clipboard-history stop`
   - Or kill the process manually

5. **Permission denied**
   - Make CLI executable: `chmod +x cli.js`
   - On macOS, you might need to allow the app in Security & Privacy settings

### Logs and Debugging

- The app logs to the console when running in development mode
- Check the Electron app's console for detailed error messages
- Use `clipboard-history status` to verify the app is responding

## Expected File Structure After Setup

```
Charley-Clips/
├── cli.js (executable)
├── main.js
├── package.json
├── node_modules/ (populated)
├── clipboard-pro/
│   ├── dist/ (built React app)
│   │   ├── index.html
│   │   └── assets/ (JS/CSS files)
│   ├── node_modules/ (populated)
│   └── package.json
└── test-cli.js
```

This guide covers the complete testing workflow from installation to operation of both CLI and headless features.
