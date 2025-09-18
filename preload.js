const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    onInitialData: (callback) => ipcRenderer.on('initial-data', callback),
    onUpdateClipboard: (callback) => ipcRenderer.on('clipboard-update', callback),
    onSettingsUpdated: (callback) => ipcRenderer.on('settings-updated', callback),
    copyToClipboard: (text) => ipcRenderer.invoke('copy-to-clipboard', text),
    readClipboard: () => ipcRenderer.invoke('read-clipboard'),
    saveClipboardHistory: (history) => ipcRenderer.invoke('save-clipboard-history', history),
    getSettings: () => ipcRenderer.invoke('get-settings'),
    saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings)
});
