import { ClipboardItem } from './types';

export interface IElectronAPI {
  getHistory: () => Promise<ClipboardItem[]>;
  addItem: (content: string) => Promise<void>;
  addFromClipboard: () => Promise<void>;
  clearHistory: () => Promise<void>;
  onHistoryUpdate: (callback: (history: ClipboardItem[]) => void) => () => void;
  // Settings
  getSettings: () => Promise<{ ok: boolean; settings?: any; error?: string }>;
  saveSettings: (settings: any) => Promise<{ ok: boolean; settings?: any; error?: string }>;
  onSettingsUpdated: (callback: (settings: any) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}
