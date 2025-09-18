
import React from 'react';
import { ClipboardItem } from '../types';
import { ClipboardItemCard } from './ClipboardItemCard';
import { EmptyStateIcon } from './icons';

interface HistoryListProps {
  items: ClipboardItem[];
  isSelectMode: boolean;
  selectedItems: Set<string>;
  onToggleSelectItem: (id: string) => void;
}

export const HistoryList: React.FC<HistoryListProps> = ({ items, isSelectMode, selectedItems, onToggleSelectItem }) => {
  if (items.length === 0) {
    return (
      <div className="text-center py-16 px-6">
        <EmptyStateIcon className="mx-auto h-16 w-16 text-theme-muted" />
        <h3 className="mt-4 text-lg font-medium text-theme-primary">Your history is empty</h3>
        <p className="mt-1 text-sm text-theme-muted">
          Items you copy will appear here. Try adding an item from your clipboard.
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-theme">
      {items.map((item) => (
        <ClipboardItemCard
          key={item.id}
          item={item}
          isSelectMode={isSelectMode}
          isSelected={selectedItems.has(item.id)}
          onToggleSelect={onToggleSelectItem}
        />
      ))}
    </div>
  );
};
