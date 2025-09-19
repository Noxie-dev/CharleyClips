const { app, BrowserWindow, ipcMain, clipboard, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs');
const net = require('net');
const logger = require('./logger');
const config = require('./config');


const isDev = process.env.NODE_ENV !== 'production';
const isMac = process.platform === 'darwin';

// Port for CLI communication (env takes precedence). Will finalize after config.init().
let PORT = parseInt(process.env.CHARLEY_PORT || '', 10);
if (!Number.isInteger(PORT)) PORT = 30303;
let mainWindow;

// --- History Management ---
// NOTE: app.getPath('userData') should be accessed after app.whenReady()
let USER_DATA_PATH;
let HISTORY_FILE_PATH;
let FIRST_RUN_FILE_PATH;
let history = [];

const categorizeContent = (content) => {
    const trimmedContent = content.trim();
    const urlRegex = /^(https?:\/\/)([\da-z\.-]+)\.([a-z\.]{2,6})([\/ \w \.-]*)*\/?$/;
    if (urlRegex.test(trimmedContent)) return 'url';
    const codeKeywords = ['function', 'const', 'let', 'var', 'import', 'export', '=>', 'class', 'public', 'private'];
    const codeSymbols = /[{};[\]()<>]/;
    const wordCount = trimmedContent.split(/\s+/).length;
    if (wordCount < 50 && (codeSymbols.test(trimmedContent) || codeKeywords.some(kw => trimmedContent.includes(kw)))) return 'code';
    return 'text';
};

function loadHistory() {
    if (!fs.existsSync(HISTORY_FILE_PATH)) {
        return; // No history to load, start fresh
    }
    try {
        const data = fs.readFileSync(HISTORY_FILE_PATH, 'utf-8');
        history = JSON.parse(data); // This might fail if data is corrupted
    } catch (e) {
        logger.error('Failed to parse history.json. It might be corrupted.', e);
        const backupPath = `${HISTORY_FILE_PATH}.corrupted-${Date.now()}` ;
        logger.info(`Backing up corrupted history to ${backupPath}` );
        try {
            fs.renameSync(HISTORY_FILE_PATH, backupPath);
        } catch (backupError) {
            logger.error('Failed to create backup of corrupted history file.', backupError);
        }
        history = []; // Start fresh to avoid crashing
    }
}

function saveHistory() {
    try {
        fs.writeFileSync(HISTORY_FILE_PATH, JSON.stringify(history, null, 2));
    } catch (e) {
        logger.error('Failed to save history file.', e);
    }
}

function notifyRenderer() {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('history-updated', history);
    }
}

function addItem(content, source = 'unknown') {
    if (!content || typeof content !== 'string' || content.trim() === '') return false;
    
    logger.usage(`Attempting to add item from source: ${source}` );

    const existingItemIndex = history.findIndex(item => item.content === content);
    if (existingItemIndex !== -1) {
        const existingItem = history[existingItemIndex];
        existingItem.timestamp = Date.now();
        existingItem.frequency += 1;
        history.splice(existingItemIndex, 1);
        history.unshift(existingItem);
    } else {
        const newItem = {
            id: `item-${Date.now()}-${Math.random()}` ,
            content,
            type: categorizeContent(content),
            timestamp: Date.now(),
            frequency: 1,
        };
        history.unshift(newItem);
    }

    const maxItems = config.get('maxHistoryItems');
    if (history.length > maxItems) {
        history = history.slice(0, maxItems);
    }

    saveHistory();
    notifyRenderer();
    return true;
}

function clearHistory(source = 'unknown') {
    logger.usage(`History cleared from source: ${source}` );
    history = [];
    saveHistory();
    notifyRenderer();
}

// --- Formatting for CLI ---
function formatCliOutput(items, emptyMessage = 'No history items found.') {
    if (!items || items.length === 0) {
        return emptyMessage;
    }
    return items.map(item => {
        const timestamp = `[${new Date(item.timestamp).toLocaleString()}]` ;
        const type = `[${item.type}]` ;
        return `${timestamp} ${type}\n${item.content}` ;
    }).join('\n\n');
}

function getHistory() {
    return history;
}

function setHistory(newHistory) {
    history = newHistory;
    saveHistory();
    notifyRenderer();
}

// --- Clipboard Monitoring ---
let lastClipboardContent = '';
let clipboardInterval = null;
function startClipboardPolling() {
    lastClipboardContent = clipboard.readText();
    const pollingInterval = config.get('clipboardPollingIntervalMs');
    clipboardInterval = setInterval(() => {
        try {
            const currentContent = clipboard.readText();
            if (currentContent && currentContent !== lastClipboardContent) {
                lastClipboardContent = currentContent;
                addItem(currentContent, 'clipboard-polling');
            }
        } catch (error) {
            logger.error('Error reading clipboard during polling. Stopping polling to prevent spam.', error);
            if (clipboardInterval) {
                clearInterval(clipboardInterval);
                clipboardInterval = null;
            }
        }
    }, pollingInterval);
    logger.info(`Clipboard polling started with interval: ${pollingInterval}ms` );
}

// --- Main Window Creation ---
function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        minWidth: 600,
        minHeight: 400,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
        show: false,
        backgroundColor: '#0D1117'
    });
    
    mainWindow.loadFile('index.html');
    
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
        logger.error(`Failed to load renderer process (UI): ${errorDescription}` , `Error Code: ${errorCode}` );
    });
    
    mainWindow.on('ready-to-show', () => {
        const isHeadless = process.argv.includes('--headless');
        if (!isHeadless) {
             mainWindow.show();
        }
        
        // Send initial data to renderer
        mainWindow.webContents.send('initial-data', {
            history: history,
            settings: { maxItems: config.get('maxHistoryItems'), theme: 'granular' }
        });
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// --- IPC Handlers ---
function setupIpcHandlers() {
    ipcMain.handle('get-history', () => history);
    ipcMain.handle('add-item', (event, content) => addItem(content, 'gui'));
    ipcMain.handle('add-from-clipboard', () => addItem(clipboard.readText(), 'gui-paste-button'));
    ipcMain.handle('clear-history', () => clearHistory('gui'));
    
    // Clipboard access handlers for the web interface
    ipcMain.handle('read-clipboard', () => {
        try {
            const text = clipboard.readText();
            logger.usage('Clipboard read via GUI paste button');
            return { ok: true, text };
        } catch (error) {
            logger.error('Failed to read clipboard via IPC', error.message);
            return { ok: false, error: error.message };
        }
    });
    
    ipcMain.handle('copy-to-clipboard', (event, text) => {
        try {
            clipboard.writeText(text);
            logger.usage('Content copied to clipboard via GUI');
            return { ok: true };
        } catch (error) {
            logger.error('Failed to copy to clipboard via IPC', error.message);
            return { ok: false, error: error.message };
        }
    });
    
    // Settings handlers
    ipcMain.handle('get-settings', () => {
        try {
            // Return basic settings - you can expand this later
            return {
                ok: true,
                settings: {
                    maxItems: config.get('maxHistoryItems'),
                    theme: 'granular'
                }
            };
        } catch (error) {
            logger.error('Failed to get settings via IPC', error.message);
            return { ok: false, error: error.message };
        }
    });
    
    ipcMain.handle('save-settings', (event, settings) => {
        try {
            logger.usage('Settings updated via GUI', JSON.stringify(settings));
            // Here you could save settings to a file if needed
            return { ok: true };
        } catch (error) {
            logger.error('Failed to save settings via IPC', error.message);
            return { ok: false, error: error.message };
        }
    });
    
    ipcMain.handle('save-clipboard-history', (event, historyData) => {
        try {
            // Update the main process history with the GUI data
            history = historyData || [];
            saveHistory();
            logger.usage('History synchronized from GUI');
            return { ok: true };
        } catch (error) {
            logger.error('Failed to save clipboard history via IPC', error.message);
            return { ok: false, error: error.message };
        }
    });
}

// --- CLI Server ---
function createCliServer() {
    const server = net.createServer(socket => {
        socket.on('data', data => {
            try {
                const command = JSON.parse(data.toString());
                logger.usage(`CLI command received: ${command.action}` );
                let response = { status: 'error', message: 'Unknown command' };

                switch (command.action) {
                    case 'show':
                        mainWindow?.show();
                        response = { status: 'ok' };
                        break;
                    case 'hide':
                        mainWindow?.hide();
                        response = { status: 'ok' };
                        break;
                    case 'add':
                        addItem(command.payload, 'cli-add');
                        response = { status: 'ok' };
                        break;
                    case 'list': {
                        let items = [...history];
                        if (command.filter) {
                            items = items.filter(i => i.type === command.filter);
                        }
                        if (command.limit) {
                            items = items.slice(0, parseInt(command.limit, 10));
                        }
                        response = { status: 'ok', payload: formatCliOutput(items) };
                        break;
                    }
                    case 'search': {
                         const query = command.payload.toLowerCase();
                         const results = history.filter(i => i.content.toLowerCase().includes(query));
                         const emptyMessage = `No items found matching "${command.payload}".` ;
                         response = { status: 'ok', payload: formatCliOutput(results, emptyMessage) };
                         break;
                    }
                    case 'clear':
                        clearHistory('cli');
                        response = { status: 'ok' };
                        break;
                    case 'status':
                        response = { status: 'ok', payload: { totalItems: history.length } };
                        break;
                    case 'stop':
                        logger.usage('Application stop requested via CLI');
                        response = { status: 'ok' };
                        socket.write(JSON.stringify(response));
                        socket.end();
                        // Gracefully quit the application
                        setTimeout(() => {
                            app.quit();
                        }, 100);
                        return;
                    case 'health':
                        response = {
                            status: 'ok',
                            payload: {
                                uptime: process.uptime(),
                                memory: process.memoryUsage(),
                                clipboardActive: !!clipboardInterval
                            }
                        };
                        break;
                    case 'config_get': {
                        try {
                            const key = command.key;
                            const value = key ? config.get(key) : config.get();
                            response = { status: 'ok', payload: value };
                        } catch (e) {
                            response = { status: 'error', message: e.message };
                        }
                        break;
                    }
                    case 'config_set': {
                        try {
                            const { key, value } = command;
                            if (!key) {
                                response = { status: 'error', message: 'Missing key for config_set' };
                                break;
                            }
                            // best-effort type coercion
                            let v = value;
                            if (typeof v === 'string') {
                                if (v === 'true' || v === 'false') v = (v === 'true');
                                else if (!Number.isNaN(Number(v)) && v.trim() !== '') v = Number(v);
                            }
                            const updated = config.set(key, v);
                            response = { status: 'ok', payload: { [key]: updated } };
                        } catch (e) {
                            response = { status: 'error', message: e.message };
                        }
                        break;
                    }
                    case 'config_path': {
                        try {
                            response = { status: 'ok', payload: { path: config.getPath() } };
                        } catch (e) {
                            response = { status: 'error', message: e.message };
                        }
                        break;
                    }
                    case 'config_export': {
                        try {
                            response = { status: 'ok', payload: config.export() };
                        } catch (e) {
                            response = { status: 'error', message: e.message };
                        }
                        break;
                    }
                    case 'config_import': {
                        try {
                            const incoming = command.payload;
                            if (!incoming || typeof incoming !== 'object') {
                                response = { status: 'error', message: 'payload must be an object' };
                                break;
                            }
                            const cfg = config.import(incoming);
                            response = { status: 'ok', payload: cfg };
                        } catch (e) {
                            response = { status: 'error', message: e.message };
                        }
                        break;
                    }
                }
                socket.write(JSON.stringify(response));
            } catch (e) {
                logger.error('Invalid CLI command format.', e);
                socket.write(JSON.stringify({ status: 'error', message: 'Invalid command format' }));
            } finally {
                socket.end();
            }
        });
    });

    server.on('error', (e) => {
        if (e.code === 'EADDRINUSE') {
            logger.error('CLI server port is already in use.', e);
        } else {
            logger.error('CLI server error.', e);
        }
    });

    server.listen(PORT, '127.0.0.1', () => {
        logger.info(`CLI server listening on port ${PORT}` );
    });
}

// --- App Lifecycle ---
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    logger.info('Another instance is already running. Quitting.');
    app.quit();
} else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        logger.info('Second instance detected, focusing main window.');
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
            mainWindow.show();
        }
    });
    
    app.whenReady().then(() => {
        logger.cleanupOldLogs();
        logger.info('Application starting...');

        // Initialize configuration now that the app is ready
        try {
            if (typeof config.init === 'function') {
                config.init();
            }
        } catch (e) {
            logger.error('Failed to initialize configuration.', e);
        }

        // Finalize PORT using config unless overridden by env
        if (!process.env.CHARLEY_PORT) {
            const cfgPort = parseInt(String(config.get('port')), 10);
            if (Number.isInteger(cfgPort)) PORT = cfgPort;
        }

        // Initialize userData-dependent paths after app is ready
        USER_DATA_PATH = app.getPath('userData');
        HISTORY_FILE_PATH = path.join(USER_DATA_PATH, 'history.json');
        FIRST_RUN_FILE_PATH = path.join(USER_DATA_PATH, '.firstrun');

        // First run check (installation log proxy)
        if (!fs.existsSync(FIRST_RUN_FILE_PATH)) {
            logger.logInstallation();
            fs.writeFileSync(FIRST_RUN_FILE_PATH, new Date().toISOString());
        }

        loadHistory();
        createMainWindow();
        setupIpcHandlers();
        createCliServer();
        startClipboardPolling();

        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) {
                createMainWindow();
            }
        });
    });
}

app.on('window-all-closed', () => {
    logger.info('All windows closed.');
    if (!isMac) {
        logger.info('Application quitting.');
        app.quit();
    }
});

app.on('before-quit', () => {
    logger.info('Application is preparing to quit.');
});

// --- Graceful Shutdown ---
const gracefulShutdown = (signal) => {
    logger.info(`Received ${signal}. Shutting down gracefully.` );
    app.quit();
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

