# Charley Clips

Charley Clips is a powerful, cross-platform clipboard manager built with Electron. It automatically tracks your clipboard history and provides both a desktop GUI and command-line interface for managing your copied content.

## Features

### 🖥️ Desktop Application
- **Automatic Clipboard Monitoring**: Continuously tracks clipboard changes in the background
- **Persistent History**: Stores up to 200 clipboard items with automatic duplicate detection
- **Smart Content Categorization**: Automatically categorizes content as text, URLs, or code
- **Clean GUI Interface**: Modern, responsive interface for browsing and managing history
- **Single Instance**: Prevents multiple app instances from running simultaneously

### 🔧 Command Line Interface
- **CLI Server**: Built-in TCP server (port 30303) for command-line interactions
- **Multiple Commands**: `show`, `hide`, `add`, `list`, `search`, `clear`, `status`
- **Content Filtering**: Filter history by content type (text, url, code)
- **Search Functionality**: Search through clipboard history from the terminal
- **Headless Mode**: Run without GUI using `--headless` flag

### 📊 Comprehensive Logging System
- **Daily Log Files**: Automatic daily log rotation (`app-YYYY-MM-DD.log`)
- **14-Day Retention**: Automatic cleanup of logs older than 14 days
- **Installation Tracking**: Logs first-run installation details
- **Usage Analytics**: Tracks CLI commands, GUI actions, and clipboard operations
- **Error Monitoring**: Comprehensive error logging for debugging
- **Log Categories**: INFO, USAGE, ERROR, WARN, DEBUG levels

## Prerequisites

Before you begin, ensure you have the following installed on your system:

- **[Node.js](https://nodejs.org/)**: Version 18.x or later is recommended.
- **[npm](https://www.npmjs.com/)**: Comes bundled with Node.js.
- **[Git](https://git-scm.com/)**: Required for cloning the repository.

## Installation Guide

Follow these steps to get Charley Clips up and running on your local machine.

1.  **Clone the Repository**

    Open your terminal, navigate to the directory where you want to store the project, and run the following command:

    ```bash
    git clone <repository-url>
    cd Charley-Clips
    ```

2.  **Install Dependencies**

    Install the required Node.js packages using npm:

    ```bash
    npm install
    ```

## Usage Guide

Charley Clips can be run in three different modes: GUI mode, production mode, or headless (CLI-only) mode.

### Running the Application

-   **Development Mode (with GUI)**:
    This is the recommended mode for development. It launches the desktop application with developer tools enabled.
    ```bash
    npm start
    ```

-   **Production Mode**:
    This command runs the application in production mode, which is optimized for performance.
    ```bash
    npm run start:prod
    ```

-   **Headless Mode (CLI Only)**:
    Run the application in the background without a graphical interface. The CLI will still be fully functional.
    ```bash
    npm run start:headless
    ```

### Using the Command Line Interface (CLI)

Once the application is running, you can use the `charley` command from a **new terminal window** to interact with it. The CLI communicates with the main application via a TCP server on port `30303`.

First, you need to link the command to make it available in your system's path:

```bash
npm link
```

Now, you can use the following commands:

```bash
# Check if the application is running
charley status

# Show the application window (if not in headless mode)
charley show

# Hide the application window
charley hide

# Add new content to the clipboard history
charley add "your new clipboard content"

# List all clipboard items
charley list

# List only items categorized as URLs
# Available filters: url, text, code
charley list --filter url

# Limit the number of results returned
charley list --limit 5

# Search for a specific keyword in your history
charley search "keyword"

# Clear the entire clipboard history
charley clear
```

### Advanced: Port Configuration

If port `30303` is in use on your machine, you can change the port without code changes using the `CHARLEY_PORT` environment variable. The main app and CLI both respect this variable.

Examples:

```bash
# Start the background app on a custom port (e.g., 30444)
CHARLEY_PORT=30444 charley start --headless

# Check status/health on that same port
CHARLEY_PORT=30444 charley status
CHARLEY_PORT=30444 charley health

# Low-level check (optional)
echo '{"action":"status"}' | CHARLEY_PORT=30444 nc 127.0.0.1 30444
```

Alternatively, you can persist the port in the app configuration file:

- macOS: `~/Library/Application Support/Charley Clips/config.json`
- Windows: `%APPDATA%/Charley Clips/config.json`
- Linux: `~/.config/Charley Clips/config.json`

Add or edit this field:

```json
{
  "port": 30444
}
```

Environment variables take precedence over the config file for convenience in temporary sessions.

### Configuration via CLI

You can view and modify configuration at runtime using `charley config` commands:

```bash
# Show the entire configuration or a single key
charley config get
charley config get port

# Set a config value (number, boolean, or string)
charley config set port 30444
charley config set enableLogging true

# Show the config file path
charley config path

# Export config as JSON
charley config export

# Import config from a JSON string (quotes required)
charley config import '{"port":30444,"maxHistoryItems":200}'
```

## Architecture

### Core Components
- **Main Process** (`main.js`): Electron main process handling app lifecycle
- **Renderer Process** (`index.html`, `styles.css`): GUI interface
- **CLI Server**: TCP server for command-line communication
- **Logger Module** (`logger.js`): Comprehensive logging system
- **Preload Script** (`preload.js`): Secure IPC communication bridge

### Data Management
- **History Storage**: JSON file in user data directory
- **Content Categorization**: Intelligent classification of clipboard content
- **Duplicate Detection**: Frequency-based duplicate handling
- **LRU Management**: Automatic cleanup when reaching 200 item limit

### Logging Architecture
- **Daily Rotation**: New log file created each day
- **Structured Logging**: Timestamped entries with severity levels
- **Automatic Cleanup**: Removes logs older than 14 days
- **Development Console**: Real-time logging in development mode

## File Structure

```
Charley-Clips/
├── main.js              # Electron main process
├── preload.js           # IPC bridge
├── index.html           # GUI interface
├── styles.css           # Application styling
├── logger.js            # Logging system
├── cli.js               # CLI client
├── test-cli.js          # CLI testing utilities
├── package.json         # Dependencies and scripts
└── README.md           # This file
```

## Technologies Used

- **Electron**: Cross-platform desktop application framework
- **Node.js**: JavaScript runtime for system interactions
- **TCP Sockets**: Client-server communication for CLI
- **JSON**: Data persistence and configuration
- **HTML/CSS**: Modern, responsive user interface

## Logs Location

Logs are stored in your system's user data directory:
- **macOS**: `~/Library/Application Support/Charley-Clips/logs/`
- **Windows**: `%APPDATA%/Charley-Clips/logs/`
- **Linux**: `~/.config/Charley-Clips/logs/`

## Development

```bash
# Run in development mode
NODE_ENV=development npm start

# Test CLI functionality
node test-cli.js

# View logs
tail -f "$(node -e "console.log(require('electron').app.getPath('userData'))")/logs/app-$(date +%Y-%m-%d).log"
```