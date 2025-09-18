const { app, BrowserWindow, ipcMain, clipboard, nativeTheme } = require('electron');
const path = require('path');
const net = require('net');
const Store = require('electron-store');

const isDev = process.env.NODE_ENV !== 'production';
const isMac = process.platform === 'darwin';

const PORT = 30303; // Port for CLI communication
let mainWindow;

// --- Persisted Storage (electron-store) ---
const store = new Store({ name: 'clipboard-history' });
const DEFAULT_SETTINGS = { pollingMs: 1500, maxItems: 100 };

function getSettings() {
    return store.get('settings', DEFAULT_SETTINGS);
}

function setSettings(newSettings) {
    const current = getSettings();
    const merged = { ...current, ...newSettings };
    store.set('settings', merged);
    return merged;
}

function getHistory() {
    return store.get('history', []);
}

function setHistory(next) {
    const safe = Array.isArray(next) ? next : [];
    store.set('history', safe);
    notifyRenderer();
    return getHistory();
}

const categorizeContent = (content) => {
    const trimmedContent = content.trim();
    const urlRegex = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
    if (urlRegex.test(trimmedContent)) return 'url';
    const codeKeywords = ['function', 'const', 'let', 'var', 'import', 'export', '=>', 'class', 'public', 'private'];
    const codeSymbols = /[{};[\]()<>]/;
    const wordCount = trimmedContent.split(/\s+/).length;
    if (wordCount < 50 && (codeSymbols.test(trimmedContent) || codeKeywords.some(kw => trimmedContent.includes(kw)))) return 'code';
    return 'text';
};

function notifyRenderer() {
    if (mainWindow && !mainWindow.isDestroyed()) {
        try {
            mainWindow.webContents.send('history-updated', getHistory());
        } catch (e) {}
    }
}

function addItem(content) {
    if (!content || typeof content !== 'string' || content.trim() === '') return false;
    const items = getHistory();
    const existingItemIndex = items.findIndex(item => item.content === content);
    if (existingItemIndex !== -1) {
        const existingItem = items[existingItemIndex];
        existingItem.timestamp = Date.now();
        existingItem.frequency = (existingItem.frequency || 1) + 1;
        items.splice(existingItemIndex, 1);
        items.unshift(existingItem);
    } else {
        const newItem = {
            id: `item-${Date.now()}-${Math.random()}`,
            content,
            type: categorizeContent(content),
            timestamp: Date.now(),
            frequency: 1,
        };
        items.unshift(newItem);
    }
    const maxItems = getSettings().maxItems || DEFAULT_SETTINGS.maxItems;
    const trimmed = items.slice(0, Math.max(1, maxItems));
    setHistory(trimmed);
    return true;
}

function clearHistory() {
    setHistory([]);
}

// --- Formatting for CLI ---
function formatCliOutput(items, emptyMessage = 'No history items found.') {
    if (!items || items.length === 0) {
        return emptyMessage;
    }
    return items.map(item => {
        const timestamp = `[${new Date(item.timestamp).toLocaleString()}]`;
        const type = `[${item.type}]`;
        return `${timestamp} ${type}\n${item.content}`;
    }).join('\n\n');
}


// --- Clipboard Monitoring ---
let lastClipboardContent = '';
let clipboardInterval = null;
function startClipboardPolling(pollingMs = DEFAULT_SETTINGS.pollingMs) {
    if (clipboardInterval) clearInterval(clipboardInterval);
    lastClipboardContent = clipboard.readText();
    clipboardInterval = setInterval(() => {
        try {
            const currentContent = clipboard.readText();
            if (currentContent && currentContent !== lastClipboardContent) {
                lastClipboardContent = currentContent;
                addItem(currentContent);
            }
        } catch (error) {
            console.error('Error reading clipboard:', error);
        }
    }, Math.max(500, Number(pollingMs) || DEFAULT_SETTINGS.pollingMs));
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
    
    // In dev, prefer Vite dev server for hot reload
    const DEV_SERVER_URL = 'http://localhost:5173';
    if (isDev) {
        mainWindow.loadURL(DEV_SERVER_URL).catch(() => {
            // Fallback to built assets if dev server not running
            const distIndex = path.join(__dirname, 'dist', 'index.html');
            try {
                const fs = require('fs');
                if (fs.existsSync(distIndex)) {
                    mainWindow.loadFile(distIndex);
                } else {
                    mainWindow.loadFile('index.html');
                }
            } catch {
                mainWindow.loadFile('index.html');
            }
        });
    } else {
        // Prefer built assets if available (Vite build outputs to dist)
        const distIndex = path.join(__dirname, 'dist', 'index.html');
        try {
            const fs = require('fs');
            if (fs.existsSync(distIndex)) {
                mainWindow.loadFile(distIndex);
            } else {
                mainWindow.loadFile('index.html');
            }
        } catch {
            mainWindow.loadFile('index.html');
        }
    }
    
    mainWindow.on('ready-to-show', () => {
        // Show window only if not started in headless mode
        const isHeadless = process.argv.includes('--headless');
        if (!isHeadless) {
             mainWindow.show();
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// --- IPC Handlers ---
function setupIpcHandlers() {
    ipcMain.handle('get-history', () => getHistory());
    ipcMain.handle('add-item', (event, content) => addItem(content));
    ipcMain.handle('add-from-clipboard', () => addItem(clipboard.readText()));
    ipcMain.handle('clear-history', () => clearHistory());
    // Settings handlers
    ipcMain.handle('get-settings', async () => {
        try {
            const settings = getSettings();
            return { ok: true, settings };
        } catch (err) {
            return { ok: false, error: String(err) };
        }
    });
    ipcMain.handle('save-settings', async (_event, newSettings) => {
        try {
            const current = getSettings();
            const sanitized = {
                pollingMs: Math.max(200, Number(newSettings?.pollingMs) || current.pollingMs || DEFAULT_SETTINGS.pollingMs),
                maxItems: Math.max(1, Math.min(10000, Number(newSettings?.maxItems) || current.maxItems || DEFAULT_SETTINGS.maxItems))
            };
            const merged = setSettings(sanitized);
            if (sanitized.pollingMs !== current.pollingMs) startClipboardPolling(sanitized.pollingMs);
            if (mainWindow && mainWindow.webContents) mainWindow.webContents.send('settings-updated', merged);
            return { ok: true, settings: merged };
        } catch (err) {
            return { ok: false, error: String(err) };
        }
    });
}

// --- CLI Server ---
function createCliServer() {
    const server = net.createServer(socket => {
        socket.on('data', data => {
            try {
                const command = JSON.parse(data.toString());
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
                        addItem(command.payload);
                        response = { status: 'ok' };
                        break;
                    case 'list': {
                        let items = [...getHistory()];
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
                         const query = String(command.payload || '').toLowerCase();
                         const results = getHistory().filter(i => String(i.content).toLowerCase().includes(query));
                         const emptyMessage = `No items found matching "${command.payload}".`;
                         response = { status: 'ok', payload: formatCliOutput(results, emptyMessage) };
                         break;
                    }
                    case 'clear':
                        clearHistory();
                        response = { status: 'ok' };
                        break;
                    case 'status':
                        response = { status: 'ok', payload: { totalItems: getHistory().length } };
                        break;
                    case 'stop':
                        response = { status: 'ok' };
                        socket.write(JSON.stringify(response));
                        socket.end();
                        setTimeout(() => app.quit(), 50);
                        return;
                }
                socket.write(JSON.stringify(response));
            } catch (e) {
                socket.write(JSON.stringify({ status: 'error', message: 'Invalid command format' }));
            } finally {
                socket.end();
            }
        });
    });

    server.on('error', (e) => {
        if (e.code === 'EADDRINUSE') {
            console.log('CLI server port in use. Another instance might be running.');
        }
    });

    server.listen(PORT, '127.0.0.1');
}

// --- App Lifecycle ---
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
            mainWindow.show();
        }
    });
    
    app.whenReady().then(() => {
        createMainWindow();
        setupIpcHandlers();
        createCliServer();
        const settings = getSettings();
        startClipboardPolling(settings.pollingMs);

        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) {
                createMainWindow();
            }
        });
    });
}

app.on('window-all-closed', () => {
    if (!isMac) {
        app.quit();
    }
});