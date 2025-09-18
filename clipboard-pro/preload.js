const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getHistory: () => ipcRenderer.invoke('get-history'),
  addItem: (content) => ipcRenderer.invoke('add-item', content),
  addFromClipboard: () => ipcRenderer.invoke('add-from-clipboard'),
  clearHistory: () => ipcRenderer.invoke('clear-history'),
  onHistoryUpdate: (callback) => {
    const handler = (event, history) => callback(history);
    ipcRenderer.on('history-updated', handler);
    // Return a function to remove the listener
    return () => {
      ipcRenderer.removeListener('history-updated', handler);
    };
  },
  // Settings APIs
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  onSettingsUpdated: (callback) => {
    const handler = (_event, newSettings) => callback(newSettings);
    ipcRenderer.on('settings-updated', handler);
    return () => ipcRenderer.removeListener('settings-updated', handler);
  }
});
