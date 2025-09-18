
import React from 'react';

interface HeaderProps {
  totalItems: number;
  storageUsage: string;
  currentTheme?: 'granular' | 'africa';
  onThemeChange?: (theme: 'granular' | 'africa') => void;
}

export const Header: React.FC<HeaderProps> = ({ totalItems, storageUsage, currentTheme = 'granular', onThemeChange }) => {
  return (
    <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 py-4 border-b-2 border-theme">
      <div>
        <h1 className="text-3xl font-bold text-theme-primary">Clipboard History Pro</h1>
        <p className="text-theme-muted mt-1">Your personal clipboard manager.</p>
      </div>
      <div className="flex gap-4 text-right items-center">
        <div className="bg-theme-surface p-3 rounded-lg">
          <div className="text-xs text-theme-muted uppercase">Total Items</div>
          <div className="text-lg font-semibold text-theme-accent">{totalItems}</div>
        </div>
        <div className="bg-theme-surface p-3 rounded-lg">
          <div className="text-xs text-theme-muted uppercase">Storage Used</div>
          <div className="text-lg font-semibold text-theme-accent">{storageUsage}</div>
        </div>
        <div className="bg-theme-surface p-2 rounded-lg">
          <label className="text-xs text-theme-muted uppercase block mb-1">Theme</label>
          <select
            className="bg-theme-container border border-theme text-theme-primary text-sm rounded px-2 py-1"
            value={currentTheme}
            onChange={(e) => onThemeChange && onThemeChange(e.target.value as 'granular' | 'africa')}
          >
            <option value="granular">Granular Dark (Surbaburn Privilege)</option>
            <option value="africa">Africa Dark (Loadshedding)</option>
          </select>
        </div>
      </div>
    </header>
  );
};
