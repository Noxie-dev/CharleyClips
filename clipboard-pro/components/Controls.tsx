
import React, { useState } from 'react';
import { FilterType } from '../types';
import { SearchIcon, TextIcon, CodeIcon, UrlIcon } from './icons';

interface ControlsProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  activeFilter: FilterType;
  setActiveFilter: (filter: FilterType) => void;
  onPasteFromClipboard: () => void;
  onAddItem: (content: string) => void;
}

const FilterButton: React.FC<{
  label: string;
  type: FilterType;
  activeFilter: FilterType;
  setActiveFilter: (filter: FilterType) => void;
  children: React.ReactNode;
}> = ({ label, type, activeFilter, setActiveFilter, children }) => {
  const isActive = activeFilter === type;
  return (
    <button
      onClick={() => setActiveFilter(type)}
      className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors duration-200 filter-btn ${
        isActive
          ? 'active bg-theme-accent text-white'
          : 'bg-theme-surface text-theme-muted hover:bg-theme-accent hover:text-theme-primary'
      }`}
    >
      {children}
      {label}
    </button>
  );
};

export const Controls: React.FC<ControlsProps> = ({ 
    searchTerm, 
    setSearchTerm, 
    activeFilter, 
    setActiveFilter,
    onPasteFromClipboard,
    onAddItem
}) => {
    const [pasteContent, setPasteContent] = useState('');

    const handleAddItem = () => {
        if(pasteContent.trim()){
            onAddItem(pasteContent);
            setPasteContent('');
        }
    }
  return (
    <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-2">
            <textarea 
                value={pasteContent}
                onChange={(e) => setPasteContent(e.target.value)}
                placeholder="Paste content here to add manually..."
                className="flex-grow bg-theme-container border border-theme rounded-lg p-3 focus:ring-2 focus:ring-theme-accent focus:outline-none transition-shadow text-sm resize-none text-theme-primary"
                rows={2}
            ></textarea>
            <div className="flex flex-col sm:flex-row gap-2">
                 <button 
                    onClick={handleAddItem}
                    className="w-full sm:w-auto bg-theme-accent text-white font-semibold px-5 py-2 rounded-lg hover:opacity-80 transition-colors duration-200 shadow-sm"
                >
                    Add Item
                </button>
                <button 
                    onClick={onPasteFromClipboard}
                    className="w-full sm:w-auto bg-theme-surface text-theme-primary font-semibold px-5 py-2 rounded-lg hover:bg-theme-accent transition-colors duration-200 shadow-sm"
                >
                    Paste from Clipboard
                </button>
            </div>
        </div>

      <div className="flex flex-col md:flex-row gap-4 justify-between">
        <div className="relative flex-grow">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <SearchIcon className="h-5 w-5 text-theme-muted" />
          </div>
          <input
            type="text"
            placeholder="Search history..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-theme-container border border-theme rounded-lg py-2 pl-10 pr-4 focus:ring-2 focus:ring-theme-accent focus:outline-none transition-shadow text-theme-primary"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <FilterButton label="All" type="all" activeFilter={activeFilter} setActiveFilter={setActiveFilter}>
             <span className="text-lg">.*</span>
          </FilterButton>
          <FilterButton label="Text" type="text" activeFilter={activeFilter} setActiveFilter={setActiveFilter}>
            <TextIcon className="h-5 w-5" />
          </FilterButton>
          <FilterButton label="URLs" type="url" activeFilter={activeFilter} setActiveFilter={setActiveFilter}>
            <UrlIcon className="h-5 w-5" />
          </FilterButton>
          <FilterButton label="Code" type="code" activeFilter={activeFilter} setActiveFilter={setActiveFilter}>
            <CodeIcon className="h-5 w-5" />
          </FilterButton>
        </div>
      </div>
    </div>
  );
};
