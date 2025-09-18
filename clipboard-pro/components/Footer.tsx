
import React from 'react';

interface FooterProps {
  isSelectMode: boolean;
  selectionCount: number;
  onToggleSelectMode: () => void;
  onCopySelected: () => void;
  onClearHistory: () => void;
  hasHistory: boolean;
}

export const Footer: React.FC<FooterProps> = ({ 
  isSelectMode,
  selectionCount,
  onToggleSelectMode,
  onCopySelected,
  onClearHistory,
  hasHistory
}) => {
  return (
    <footer className="flex flex-col sm:flex-row justify-between items-center gap-4 py-4 border-t-2 border-theme">
      <div className="flex gap-2">
        {hasHistory && (
          <button
            onClick={onToggleSelectMode}
            className={`px-4 py-2 rounded-lg font-semibold transition-colors duration-200 ${
              isSelectMode ? 'bg-gray-600 text-white hover:bg-gray-500' : 'bg-theme-surface text-theme-primary hover:bg-theme-accent'
            }`}
          >
            {isSelectMode ? 'Cancel Selection' : 'Select Items'}
          </button>
        )}
        {isSelectMode && (
          <button
            onClick={onCopySelected}
            disabled={selectionCount === 0}
            className="px-4 py-2 rounded-lg font-semibold bg-theme-accent text-white transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-80"
          >
            Copy Selected ({selectionCount})
          </button>
        )}
      </div>
      {hasHistory && (
        <button
          onClick={onClearHistory}
          className="px-4 py-2 rounded-lg font-semibold bg-theme-danger text-white hover:opacity-80 transition-colors duration-200"
        >
          Clear History
        </button>
      )}
    </footer>
  );
};
