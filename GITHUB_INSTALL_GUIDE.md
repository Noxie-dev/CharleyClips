# Clipboard History Pro - GitHub Installation Guide

## Fresh Installation from GitHub

This guide walks you through installing and running Clipboard History Pro from a fresh GitHub clone.

### Prerequisites

- **Node.js** (version 16 or higher)
- **npm** (comes with Node.js)
- **Git** (for cloning the repository)

### Step 1: Clone the Repository

```bash
# Clone the repository
git clone https://github.com/your-username/clipboard-history-pro.git

# Navigate to the project directory
cd clipboard-history-pro
```

### Step 2: Install Dependencies

```bash
# Install main project dependencies
npm install

# Install React app dependencies
cd clipboard-pro
npm install
cd ..
```

### Step 3: Build the React App

```bash
# Build the React application
cd clipboard-pro
npm run build
cd ..
```

### Step 4: Set Up the CLI

```bash
# Make the CLI executable
chmod +x cli.js

# Test the CLI
node cli.js --help

# Optional: Install globally for easier access
npm install -g .
```

### Step 5: Start in Headless Mode

```bash
# Start the application in headless mode (no GUI window)
node cli.js start --headless

# Or if installed globally:
clipboard-history start --headless
```

### Step 6: Verify Installation

```bash
# Check if the application is running
node cli.js status

# Add a test item
node cli.js add "Hello from fresh install!"

# List items to verify it's working
node cli.js list
```

### Step 7: Test Clipboard Monitoring

The application automatically monitors your system clipboard when running. Try:

1. Copy some text to your clipboard (Cmd+C on Mac, Ctrl+C on Windows/Linux)
2. Check if it was captured: `node cli.js list --limit 1`

### Available CLI Commands

```bash
# Application control
node cli.js start [--headless]    # Start the application
node cli.js stop                  # Stop the application
node cli.js status                # Check if running

# Window management (GUI mode)
node cli.js show                  # Show the window
node cli.js hide                  # Hide the window

# History management
node cli.js add "content"         # Add item to history
node cli.js list [--limit N]      # List history items
node cli.js search "query"        # Search history
node cli.js clear                 # Clear all history

# Filtering
node cli.js list --filter text    # Show only text items
node cli.js list --filter url     # Show only URL items
node cli.js list --filter code    # Show only code items
```

### Automated Testing

Run the automated test to verify everything works:

```bash
# Make test script executable
chmod +x test-github-install.sh

# Run the test
./test-github-install.sh
```

This test will:
- Simulate a fresh GitHub installation
- Install all dependencies
- Build the React app
- Test headless mode
- Verify all CLI commands work
- Clean up automatically

### Troubleshooting

#### "Command not found" errors
- Make sure Node.js is installed: `node --version`
- Make sure you're in the project directory
- Make CLI executable: `chmod +x cli.js`

#### "Application not running" errors
- Start the app first: `node cli.js start --headless`
- Check if it's running: `node cli.js status`

#### Build errors
- Make sure you have the latest Node.js version
- Clear npm cache: `npm cache clean --force`
- Delete node_modules and reinstall: `rm -rf node_modules && npm install`

#### Port conflicts
- The app uses port 30303 for CLI communication
- If in use, stop any existing instances: `node cli.js stop`

### Production Deployment

For production use:

1. **Install globally**: `npm install -g .`
2. **Start as service**: Use your system's service manager (systemd, launchd, etc.)
3. **Auto-start**: Add to startup scripts
4. **Monitoring**: Set up health checks using `clipboard-history status`

### Example Production Setup (macOS)

Create a launch agent for auto-start:

```bash
# Create launch agent directory
mkdir -p ~/Library/LaunchAgents

# Create plist file
cat > ~/Library/LaunchAgents/com.clipboard-history.plist << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.clipboard-history</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/clipboard-history</string>
        <string>start</string>
        <string>--headless</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
</dict>
</plist>
EOF

# Load the service
launchctl load ~/Library/LaunchAgents/com.clipboard-history.plist
```

This will automatically start the clipboard manager in headless mode when you log in.
