const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    onInitialData: (callback) => ipcRenderer.on('initial-data', callback),
    onUpdateClipboard: (callback) => ipcRenderer.on('clipboard-update', callback),
    copyToClipboard: (text) => ipcRenderer.invoke('copy-to-clipboard', text),
    saveClipboardHistory: (history) => ipcRenderer.invoke('save-clipboard-history', history)
});
