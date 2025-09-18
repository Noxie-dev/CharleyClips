import { useState, useEffect, useCallback } from 'react';
import { ClipboardItem } from '../types';

export const useClipboardHistory = () => {
  const [history, setHistory] = useState<ClipboardItem[]>([]);
  const [storageUsage, setStorageUsage] = useState<string>('0 KB');
  const api = (window as any)?.electronAPI;

  useEffect(() => {
    // Initial fetch of history
    if (api?.getHistory) {
      api.getHistory().then((initialHistory: ClipboardItem[]) => {
        setHistory(initialHistory);
      }).catch(() => {
        // ignore; leave history empty in non-Electron contexts
      });
    }

    // Set up a listener for real-time updates from the main process
    let removeListener: (() => void) | undefined;
    if (api?.onHistoryUpdate) {
      removeListener = api.onHistoryUpdate((updatedHistory: ClipboardItem[]) => {
        setHistory(updatedHistory);
      });
    }

    // Cleanup listener on component unmount
    return () => {
      try { removeListener?.(); } catch {}
    };
  }, []);
  
  // Recalculate storage usage whenever history changes
  useEffect(() => {
    const serializedHistory = JSON.stringify(history);
    const usageInBytes = new Blob([serializedHistory]).size;
    const usageInKB = (usageInBytes / 1024).toFixed(2);
    setStorageUsage(`${usageInKB} KB`);
  }, [history]);

  const addItem = useCallback(async (content: string) => {
    if (!content || content.trim() === '') return;
    try {
      await api?.addItem?.(content);
    } catch {}
  }, [api]);
  
  const addFromClipboard = useCallback(async () => {
    try {
      await api?.addFromClipboard?.();
    } catch {}
  }, [api]);

  const clearHistory = useCallback(async () => {
    if (window.confirm('Are you sure you want to clear your entire clipboard history? This cannot be undone.')) {
      try {
        await api?.clearHistory?.();
      } catch {}
    }
  }, [api]);

  return { history, addItem, clearHistory, storageUsage, addFromClipboard };
};
