
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useClipboardHistory } from './hooks/useClipboardHistory';
import { Header } from './components/Header';
import { Controls } from './components/Controls';
import { HistoryList } from './components/HistoryList';
import { Footer } from './components/Footer';
import { ClipboardItem, FilterType } from './types';

const App: React.FC = () => {
  const { 
    history, 
    addItem, 
    clearHistory, 
    storageUsage, 
    addFromClipboard 
  } = useClipboardHistory();
  const [theme, setTheme] = useState<'granular' | 'africa' | undefined>(undefined);

  // Apply selected theme by setting data-theme attribute
  const applyTheme = useCallback((t: 'granular' | 'africa') => {
    try {
      if (t === 'africa') {
        document.documentElement.setAttribute('data-theme', 'africa');
      } else {
        document.documentElement.removeAttribute('data-theme');
      }
      setTheme(t);
    } catch (_) {}
  }, []);

  // On mount: load settings, prompt once if no theme is selected
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (window.electronAPI?.getSettings) {
          const res = await window.electronAPI.getSettings();
          const current = (res && res.ok && res.settings) ? res.settings : {};
          const currentTheme = current.theme as ('granular' | 'africa' | undefined);
          if (currentTheme === 'granular' || currentTheme === 'africa') {
            if (!mounted) return;
            applyTheme(currentTheme);
          } else {
            // First run theme prompt
            const useAfrica = window.confirm(
              'Choose your theme:\nOK = Africa Dark (Loadshedding)\nCancel = Granular Dark (Surbaburn Privilege)'
            );
            const chosen: 'granular' | 'africa' = useAfrica ? 'africa' : 'granular';
            if (!mounted) return;
            applyTheme(chosen);
            // Persist selection
            if (window.electronAPI?.saveSettings) {
              await window.electronAPI.saveSettings({ theme: chosen });
            }
          }
        } else {
          // Fallback: default to granular
          applyTheme('granular');
        }
      } catch (_) {
        applyTheme('granular');
      }
    })();
    return () => { mounted = false; };
  }, [applyTheme]);
  
  const handleThemeChange = useCallback(async (next: 'granular' | 'africa') => {
    applyTheme(next);
    try {
      await window.electronAPI?.saveSettings?.({ theme: next });
    } catch (_) {}
  }, [applyTheme]);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  
  const filteredHistory = useMemo(() => {
    return history
      .filter((item) => {
        if (activeFilter === 'all') return true;
        return item.type === activeFilter;
      })
      .filter((item) => 
        item.content.toLowerCase().includes(searchTerm.toLowerCase())
      );
  }, [history, activeFilter, searchTerm]);

  const toggleSelectMode = useCallback(() => {
    setIsSelectMode(prev => !prev);
    setSelectedItems(new Set());
  }, []);

  const handleToggleSelectItem = useCallback((id: string) => {
    setSelectedItems(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(id)) {
        newSelected.delete(id);
      } else {
        newSelected.add(id);
      }
      return newSelected;
    });
  }, []);

  const handleCopySelected = useCallback(async () => {
    const selectedContent = history
      .filter(item => selectedItems.has(item.id))
      .map(item => item.content)
      .join('\n');

    if (selectedContent) {
      await navigator.clipboard.writeText(selectedContent);
      alert('Selected items copied to clipboard!');
      toggleSelectMode();
    }
  }, [history, selectedItems, toggleSelectMode]);
  
  return (
    <div className="min-h-screen font-sans flex flex-col items-center p-4 sm:p-6 md:p-8">
      <div className="w-full max-w-4xl mx-auto flex flex-col gap-6">
        <Header 
          totalItems={history.length} 
          storageUsage={storageUsage} 
          currentTheme={theme ?? 'granular'}
          onThemeChange={handleThemeChange}
        />
        
        <Controls
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          activeFilter={activeFilter}
          setActiveFilter={setActiveFilter}
          onPasteFromClipboard={addFromClipboard}
          onAddItem={addItem}
        />

        <main className="bg-theme-container border border-theme rounded-lg shadow-lg">
          <HistoryList 
            items={filteredHistory}
            isSelectMode={isSelectMode}
            selectedItems={selectedItems}
            onToggleSelectItem={handleToggleSelectItem}
          />
        </main>

        <Footer
          isSelectMode={isSelectMode}
          selectionCount={selectedItems.size}
          onToggleSelectMode={toggleSelectMode}
          onCopySelected={handleCopySelected}
          onClearHistory={clearHistory}
          hasHistory={history.length > 0}
        />
      </div>
    </div>
  );
};

export default App;
