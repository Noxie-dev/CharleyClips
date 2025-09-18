const { app, BrowserWindow, ipcMain, clipboard } = require('electron');
const path = require('path');
const Store = require('electron-store');

// Persisted storage for clipboard history and settings
const store = new Store({ name: 'clipboard-history' });

let mainWindow = null;
let lastClipboardText = '';
let clipboardInterval = null;

function sendInitialData() {
  try {
    const history = store.get('history', []);
    const settings = store.get('settings', { pollingMs: 1500 });
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
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (clipboardInterval) clearInterval(clipboardInterval);
  });

  // Load local index.html (works for both dev and packaged app)
  mainWindow.loadFile(path.join(__dirname, 'index.html'))
    .then(() => {
      sendInitialData();
      const settings = store.get('settings', { pollingMs: 1500 });
      startClipboardPolling(settings.pollingMs);
    })
    .catch((err) => {
      console.error('Failed to load index.html:', err);
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
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
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

ipcMain.handle('save-clipboard-history', async (_event, history) => {
  try {
    if (!Array.isArray(history)) throw new Error('history must be an array');
    store.set('history', history);
    return { ok: true };
  } catch (err) {
    console.error('save-clipboard-history error:', err);
    return { ok: false, error: String(err) };
  }
});

