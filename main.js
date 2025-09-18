const { app, BrowserWindow, ipcMain, clipboard } = require('electron');
const path = require('path');
const net = require('net');
const Store = require('electron-store');

// Persisted storage for clipboard history and settings
const store = new Store({ name: 'clipboard-history' });

// Headless flag and CLI server config
const isHeadless = process.argv.includes('--headless');
const PORT = 30303;

// Settings IPC
ipcMain.handle('get-settings', async () => {
  try {
    const settings = getSettings();
    return { ok: true, settings };
  } catch (err) {
    console.error('get-settings error:', err);
    return { ok: false, error: String(err) };
  }
});

ipcMain.handle('save-settings', async (_event, newSettings) => {
  try {
    const current = getSettings();
    const sanitized = {
      pollingMs: Math.max(200, Number(newSettings?.pollingMs) || current.pollingMs || 1500),
      maxItems: Math.max(1, Math.min(10000, Number(newSettings?.maxItems) || current.maxItems || 100))
    };
    const merged = setSettings(sanitized);
    // Restart polling if interval changed
    if (sanitized.pollingMs !== current.pollingMs) {
      startClipboardPolling(sanitized.pollingMs);
    }
    // Optionally, notify renderer of updated settings
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('settings-updated', merged);
    }
    return { ok: true, settings: merged };
  } catch (err) {
    console.error('save-settings error:', err);
    return { ok: false, error: String(err) };
  }
});

let mainWindow = null;
let lastClipboardText = '';
let clipboardInterval = null;

// History management (stored in electron-store)
function getHistory() {
  return store.get('history', []);
}

function setHistory(history) {
  store.set('history', Array.isArray(history) ? history : []);
  notifyRendererHistory();
  return getHistory();
}

function categorizeContent(content) {
  const trimmed = String(content || '').trim();
  if (!trimmed) return 'text';
  const urlRegex = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/i;
  if (urlRegex.test(trimmed)) return 'url';
  const codeKeywords = ['function', 'const', 'let', 'var', 'import', 'export', '=>', 'class', 'public', 'private'];
  const codeSymbols = /[{};\[\]()<>"]/;
  const wordCount = trimmed.split(/\s+/).length;
  if (wordCount < 50 && (codeSymbols.test(trimmed) || codeKeywords.some(kw => trimmed.includes(kw)))) return 'code';
  return 'text';
}

function addItem(content) {
  const text = String(content || '').trim();
  if (!text) return false;
  const current = getHistory();
  const existingIndex = current.findIndex(i => i.content === text);
  if (existingIndex !== -1) {
    const item = current[existingIndex];
    item.timestamp = Date.now();
    item.frequency = (item.frequency || 1) + 1;
    current.splice(existingIndex, 1);
    current.unshift(item);
  } else {
    current.unshift({
      id: `item-${Date.now()}-${Math.random()}`,
      content: text,
      type: categorizeContent(text),
      timestamp: Date.now(),
      frequency: 1,
    });
  }
  const maxItems = getSettings().maxItems || 100;
  const trimmed = current.slice(0, Math.max(1, maxItems));
  setHistory(trimmed);
  return true;
}

function clearHistory() {
  setHistory([]);
}

function notifyRendererHistory() {
  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('history-updated', getHistory());
    }
  } catch (err) {
    // non-fatal
  }
}

function getSettings() {
  return store.get('settings', { pollingMs: 1500, maxItems: 100 });
}

function setSettings(newSettings) {
  const current = getSettings();
  const merged = { ...current, ...newSettings };
  store.set('settings', merged);
  return merged;
}

function sendInitialData() {
  try {
    const history = getHistory();
    const settings = getSettings();
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('initial-data', { history, settings });
    }
  } catch (err) {
    // Swallow errors to avoid crashing the app on send
    console.error('Failed to send initial data:', err);
  }
}

function startClipboardPolling(pollingMs = 1500) {
  if (clipboardInterval) clearInterval(clipboardInterval);
  clipboardInterval = setInterval(() => {
    try {
      const text = clipboard.readText();
      if (typeof text === 'string' && text.length > 0 && text !== lastClipboardText) {
        lastClipboardText = text;
        // Update history centrally
        addItem(text);
        // Also notify renderer of clipboard update for UI responsiveness
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('clipboard-update', { text, ts: Date.now() });
        }
      }
    } catch (err) {
      // Non-fatal
      console.warn('Clipboard polling error:', err);
    }
  }, Math.max(500, pollingMs | 0));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'clipboard-pro', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });

  mainWindow.on('ready-to-show', () => {
    if (!isHeadless) {
      mainWindow.show();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (clipboardInterval) clearInterval(clipboardInterval);
  });

  // Load React app from clipboard-pro/dist
  console.log('Loading React app from clipboard-pro/dist');
  mainWindow.loadFile(path.join(__dirname, 'clipboard-pro', 'dist', 'index.html'))
    .then(() => {
      console.log('Successfully loaded React app');
      sendInitialData();
      const settings = getSettings();
      startClipboardPolling(settings.pollingMs);
    })
    .catch((err) => {
      console.error('Failed to load React app:', err);
      console.log('Falling back to local index.html');
      mainWindow.loadFile(path.join(__dirname, 'index.html'))
        .then(() => {
          sendInitialData();
          const settings = getSettings();
          startClipboardPolling(settings.pollingMs);
        });
    });
}

// Ensure single instance
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

app.whenReady().then(() => {
  if (!isHeadless) {
    createWindow();
  } else {
    // In headless mode still start clipboard polling and serve CLI
    const settings = getSettings();
    startClipboardPolling(settings.pollingMs);
  }
  // Always start CLI server
  createCliServer();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      if (!isHeadless) createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // Quit on all platforms except macOS where it's common to stay active
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers
ipcMain.handle('copy-to-clipboard', async (_event, text) => {
  try {
    clipboard.writeText(String(text ?? ''));
    return { ok: true };
  } catch (err) {
    console.error('copy-to-clipboard error:', err);
    return { ok: false, error: String(err) };
  }
});

ipcMain.handle('read-clipboard', async () => {
  try {
    const text = clipboard.readText();
    return { ok: true, text };
  } catch (err) {
    console.error('read-clipboard error:', err);
    return { ok: false, error: String(err) };
  }
});

ipcMain.handle('save-clipboard-history', async (_event, history) => {
  try {
    if (!Array.isArray(history)) throw new Error('history must be an array');
    setHistory(history);
    return { ok: true };
  } catch (err) {
    console.error('save-clipboard-history error:', err);
    return { ok: false, error: String(err) };
  }
});

// Additional IPC handlers for history management
ipcMain.handle('get-history', async () => {
  try {
    return { ok: true, history: getHistory() };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

ipcMain.handle('add-item', async (_event, content) => {
  try {
    const added = addItem(content);
    return { ok: added };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

ipcMain.handle('add-from-clipboard', async () => {
  try {
    return { ok: addItem(clipboard.readText()) };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

ipcMain.handle('clear-history', async () => {
  try {
    clearHistory();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

// CLI Server for headless/CLI control
function formatCliOutput(items, emptyMessage = 'No history items found.') {
  if (!items || items.length === 0) return emptyMessage;
  return items
    .map(item => {
      const ts = `[${new Date(item.timestamp).toLocaleString()}]`;
      const type = `[${item.type}]`;
      return `${ts} ${type}\n${item.content}`;
    })
    .join('\n\n');
}

function createCliServer() {
  const server = net.createServer(socket => {
    let buffer = '';
    socket.on('data', chunk => {
      buffer += chunk.toString();
    });
    socket.on('end', () => {
      try {
        const command = JSON.parse(buffer);
        let response = { status: 'error', message: 'Unknown command' };
        switch (command.action) {
          case 'show':
            if (!mainWindow && !isHeadless) createWindow();
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
            if (command.filter) items = items.filter(i => i.type === command.filter);
            if (command.limit) items = items.slice(0, parseInt(command.limit, 10));
            response = { status: 'ok', payload: formatCliOutput(items) };
            break;
          }
          case 'search': {
            const q = String(command.payload || '').toLowerCase();
            const results = getHistory().filter(i => String(i.content).toLowerCase().includes(q));
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
            // Delay quit to flush socket
            setTimeout(() => app.quit(), 50);
            return; // early exit to avoid double write
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
    if (e && e.code === 'EADDRINUSE') {
      console.log('CLI server port in use. Another instance might be running.');
    } else {
      console.error('CLI server error:', e);
    }
  });

  server.listen(PORT, '127.0.0.1');
}

