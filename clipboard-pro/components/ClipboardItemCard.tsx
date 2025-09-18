
import React, { useState, useCallback } from 'react';
import { ClipboardItem } from '../types';
import { TextIcon, CodeIcon, UrlIcon, CopyIcon, CheckIcon } from './icons';

interface ClipboardItemCardProps {
  item: ClipboardItem;
  isSelectMode: boolean;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
}

const TypeIcon: React.FC<{ type: ClipboardItem['type'] }> = ({ type }) => {
  const className = "h-5 w-5 text-theme-muted";
  switch (type) {
    case 'text': return <TextIcon className={className} />;
    case 'url': return <UrlIcon className={className} />;
    case 'code': return <CodeIcon className={className} />;
    default: return null;
  }
};

export const ClipboardItemCard: React.FC<ClipboardItemCardProps> = ({ item, isSelectMode, isSelected, onToggleSelect }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(item.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [item.content]);

  const handleCardClick = () => {
    if (isSelectMode) {
      onToggleSelect(item.id);
    } else {
      // Simulate click on copy button
      const mockEvent = { stopPropagation: () => {} } as React.MouseEvent;
      handleCopy(mockEvent);
    }
  };

  const timeAgo = new Date(item.timestamp).toLocaleString();

  return (
    <div 
      onClick={handleCardClick}
      className={`flex items-start gap-4 p-4 transition-colors duration-200 cursor-pointer ${isSelectMode ? '' : 'hover:bg-theme-surface'} ${isSelected ? 'bg-blue-900/50' : ''}`}
    >
      {isSelectMode && (
        <input 
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(item.id)}
          onClick={(e) => e.stopPropagation()}
          className="mt-1 h-5 w-5 rounded bg-theme-container border-theme text-theme-accent focus:ring-theme-accent"
        />
      )}
      <div className="flex-shrink-0 mt-1">
        <TypeIcon type={item.type} />
      </div>
      <div className="flex-grow min-w-0">
        <pre className="text-sm text-theme-primary whitespace-pre-wrap break-words font-sans">
          {item.content.length > 300 ? `${item.content.substring(0, 300)}...` : item.content}
        </pre>
        <div className="text-xs text-theme-muted mt-2">
          {timeAgo}
        </div>
      </div>
      {!isSelectMode && (
        <button 
          onClick={handleCopy}
          className="ml-4 p-2 rounded-full hover:bg-theme-surface transition-colors duration-200 flex-shrink-0"
          aria-label="Copy item"
        >
          {copied 
            ? <CheckIcon className="h-5 w-5 text-green-400" /> 
            : <CopyIcon className="h-5 w-5 text-theme-muted" />
          }
        </button>
      )}
    </div>
  );
};
