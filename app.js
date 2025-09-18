// Section 1: Core Data Structures
class TrieNode {
    constructor() { this.children = {}; this.items = []; }
}
class Trie {
    constructor() { this.root = new TrieNode(); }
    insert(word, itemId) {
        let node = this.root;
        for (let char of word.toLowerCase()) {
            if (!node.children[char]) node.children[char] = new TrieNode();
            node = node.children[char];
            node.items.push(itemId);
        }
    }
    search(prefix) {
        let node = this.root;
        for (let char of prefix.toLowerCase()) {
            if (!node.children[char]) return [];
            node = node.children[char];
        }
        return [...new Set(node.items)];
    }
}
class LRUCache {
    constructor(capacity) { this.capacity = capacity; this.cache = new Map(); }
    get(key) {
        if (!this.cache.has(key)) return null;
        const value = this.cache.get(key);
        this.cache.delete(key); this.cache.set(key, value);
        return value;
    }
    put(key, value) {
        if (this.cache.has(key)) this.cache.delete(key);
        else if (this.cache.size >= this.capacity) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        this.cache.set(key, value);
    }
    getAll() { return Array.from(this.cache.values()).reverse(); }
    size() { return this.cache.size; }
}
class ContentClassifier {
    static classify(text) {
        const patterns = {
            url: /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/i,
            email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
            json: /^[\{\[].*[\}\]]$/s,
            code: /(function|const|let|var|class|import|export|if|for|while|return|=>)/,
            number: /^-?\d+\.?\d*$/
        };
        for (const [type, pattern] of Object.entries(patterns)) {
            if (pattern.test(text.trim())) return type;
        }
        return 'text';
    }
}
// Section 2: Main Application Class
class ClipboardManager {
    constructor() {
        this.settings = { maxItems: 100 };
        this.lruCache = new LRUCache(this.settings.maxItems);
        this.trie = new Trie();
        this.hashMap = new Map();
        this.currentFilter = 'all';
        this.searchQuery = '';
        this.isSelecting = false;
        this.selectedItems = new Set();
        // Viewer state
        this.viewer = { open: false, itemId: null, editing: false };
        this.init();
    }
    init() {
        // Load initial data from Electron main via preload bridge
        if (window.electronAPI && typeof window.electronAPI.onInitialData === 'function') {
            window.electronAPI.onInitialData((_event, payload) => {
                try {
                    const { history = [], settings = {} } = payload || {};
                    if (settings && typeof settings === 'object') {
                        this.applySettings(settings);
                    }
                    this.loadFromArray(history);
                    this.render();
                } catch (err) {
                    console.error('Failed handling initial-data:', err);
                }
            });
        } else {
            // Fallback for browser environment: keep existing localStorage behavior
            this.loadFromLocalStorage();
        }

        // Subscribe to clipboard updates from main process polling
        if (window.electronAPI && typeof window.electronAPI.onUpdateClipboard === 'function') {
            window.electronAPI.onUpdateClipboard((_event, payload) => {
                const text = payload && payload.text;
                if (typeof text === 'string' && text.length > 0) {
                    this.processItem(text);
                }
            });
        }
        // Listen for settings updates from main
        if (window.electronAPI && typeof window.electronAPI.onSettingsUpdated === 'function') {
            window.electronAPI.onSettingsUpdated((_event, newSettings) => {
                this.applySettings(newSettings);
                this.render();
            });
        }
        this.setupEventListeners();
        this.loadTheme(); // Load saved theme
        this.render();
        feather.replace(); // Initialize icons
    }
    applySettings(newSettings) {
        const prevMax = this.settings.maxItems;
        this.settings = { ...this.settings, ...newSettings };
        // Resize cache if maxItems changed
        if (typeof this.settings.maxItems === 'number' && this.settings.maxItems !== prevMax) {
            this.resizeCache(this.settings.maxItems);
        }
    }
    resizeCache(newCapacity) {
        const items = this.getFilteredAndSortedItems ? this.lruCache.getAll() : [];
        const trimmed = items.slice(0, Math.max(1, newCapacity));
        this.lruCache = new LRUCache(newCapacity);
        this.trie = new Trie();
        this.hashMap.clear();
        trimmed.forEach(item => {
            this.lruCache.put(item.id, item);
            const hash = this.hash(item.originalContent);
            this.hashMap.set(hash, item.id);
            this.trie.insert(item.originalContent, item.id);
        });
        this.persistHistory();
    }
    loadFromLocalStorage() {
        const savedItems = JSON.parse(localStorage.getItem('clipboardHistory') || '[]');
        this.loadFromArray(savedItems);
    }
    loadFromArray(itemsArray) {
        if (!Array.isArray(itemsArray)) return;
        // Reset structures
        this.lruCache = new LRUCache(this.settings.maxItems);
        this.trie = new Trie();
        this.hashMap.clear();
        itemsArray.forEach(item => {
            if (!item || typeof item.originalContent !== 'string') return;
            const hash = this.hash(item.originalContent);
            if (!this.hashMap.has(hash)) {
                // Ensure required fields
                const normalized = {
                    id: String(item.id ?? Date.now().toString()),
                    originalContent: item.originalContent,
                    type: item.type || ContentClassifier.classify(item.originalContent),
                    timestamp: item.timestamp || Date.now(),
                    lastUsed: item.lastUsed || item.timestamp || Date.now(),
                    frequency: item.frequency || 1,
                };
                this.lruCache.put(normalized.id, normalized);
                this.hashMap.set(hash, normalized.id);
                this.trie.insert(normalized.originalContent, normalized.id);
            }
        });

        // Viewer modal elements
        this.viewerModal = document.getElementById('viewerModal');
        this.viewerCloseBtn = document.getElementById('viewerCloseBtn');
        this.viewerReadOnly = document.getElementById('viewerReadOnly');
        this.viewerEditor = document.getElementById('viewerEditor');
        this.viewerEditBtn = document.getElementById('viewerEditBtn');
        this.viewerSaveBtn = document.getElementById('viewerSaveBtn');
        this.viewerRevertBtn = document.getElementById('viewerRevertBtn');
        this.viewerDeleteBtn = document.getElementById('viewerDeleteBtn');

        if (this.viewerCloseBtn) this.viewerCloseBtn.addEventListener('click', () => this.closeViewer());
        if (this.viewerModal) this.viewerModal.addEventListener('click', (e) => { if (e.target === this.viewerModal) this.closeViewer(); });
        if (this.viewerEditBtn) this.viewerEditBtn.addEventListener('click', () => this.enterViewerEdit());
        if (this.viewerSaveBtn) this.viewerSaveBtn.addEventListener('click', () => this.handleViewerSave());
        if (this.viewerRevertBtn) this.viewerRevertBtn.addEventListener('click', () => this.handleViewerRevert());
        if (this.viewerDeleteBtn) this.viewerDeleteBtn.addEventListener('click', () => this.handleViewerDelete());
        if (this.viewerEditor) this.viewerEditor.addEventListener('input', () => this.onViewerInput());
    }
    async persistHistory() {
        const historyArray = this.lruCache.getAll();
        if (window.electronAPI && typeof window.electronAPI.saveClipboardHistory === 'function') {
            try {
                await window.electronAPI.saveClipboardHistory(historyArray);
            } catch (e) {
                console.warn('Failed to persist via electron-store, falling back to localStorage', e);
                localStorage.setItem('clipboardHistory', JSON.stringify(historyArray));
            }
        } else {
            localStorage.setItem('clipboardHistory', JSON.stringify(historyArray));
        }
        this.updateStats();
    }

    hash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash |= 0; // Convert to 32bit integer
        }
        return hash;
    }
    async addItemFromPaste() {
        try {
            let text = '';
            if (window.electronAPI && typeof window.electronAPI.readClipboard === 'function') {
                const res = await window.electronAPI.readClipboard();
                if (res && res.ok) text = res.text || '';
                else throw new Error(res && res.error ? res.error : 'readClipboard failed');
            } else if (navigator.clipboard && navigator.clipboard.readText) {
                text = await navigator.clipboard.readText();
            }
            if (!text) return;
            this.processItem(text);
        } catch (err) {
            console.error('Failed to read clipboard contents: ', err);
            this.showToast('Failed to read clipboard. Please grant permission.', true);
        }
    }

    processItem(text) {
        const itemHash = this.hash(text);
        if (this.hashMap.has(itemHash)) {
            const existingId = this.hashMap.get(itemHash);
            const existingItem = this.lruCache.get(existingId); // .get() also marks as recently used
            if (existingItem) {
                existingItem.frequency = (existingItem.frequency || 1) + 1;
                existingItem.lastUsed = Date.now();
                this.lruCache.put(existingId, existingItem);
                this.showToast('Item already exists. Frequency updated.');
            }
        } else {
            const newItem = {
                id: Date.now().toString(),
                originalContent: text,
                type: ContentClassifier.classify(text),
                timestamp: Date.now(),
                lastUsed: Date.now(),
                frequency: 1
            };
            this.lruCache.put(newItem.id, newItem);
            this.hashMap.set(itemHash, newItem.id);
            this.trie.insert(newItem.originalContent, newItem.id);
            this.showToast('Item added to history.');
        }
        this.persistHistory();
        this.render();
    }

    setupEventListeners() {
        // Add item from manual input
        const addItemBtn = document.getElementById('addItemBtn');
        const pasteTextarea = document.getElementById('pasteTextarea');
        if (addItemBtn) {
            addItemBtn.addEventListener('click', () => {
                const content = pasteTextarea?.value?.trim();
                if (content) {
                    this.processItem(content);
                    pasteTextarea.value = '';
                }
            });
        }
        
        // Paste from clipboard
        document.getElementById('pasteBtn').addEventListener('click', () => this.addItemFromPaste());
        
        // Clear history
        document.getElementById('clearBtn').addEventListener('click', () => this.clearHistory());
        
        // Theme switching
        const themeSelect = document.getElementById('themeSelect');
        if (themeSelect) {
            themeSelect.addEventListener('change', (e) => {
                this.setTheme(e.target.value);
            });
        }
        const searchInput = document.getElementById('searchInput');
        const searchMeta = document.getElementById('searchMeta');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                clearTimeout(this._searchDebounceTimer);
                const val = e.target.value || '';
                this._searchDebounceTimer = setTimeout(() => {
                    this.searchQuery = val;
                    this.render();
                }, 150);
            });
        }
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelector('.filter-btn.active').classList.remove('active');
                e.target.classList.add('active');
                this.currentFilter = e.target.dataset.filter;
                this.render();
            });
        });
        document.getElementById('selectBtn').addEventListener('click', () => {
            this.isSelecting = !this.isSelecting;
            this.selectedItems.clear();
            document.getElementById('copySelectedBtn').classList.add('hidden');
            this.render();
        });
        document.getElementById('copySelectedBtn').addEventListener('click', () => this.copySelected());
        // Settings UI
        const settingsBtn = document.getElementById('settingsBtn');
        const settingsModal = document.getElementById('settingsModal');
        const settingsSaveBtn = document.getElementById('settingsSaveBtn');
        const settingsCancelBtn = document.getElementById('settingsCancelBtn');
        const settingsCloseBtn = document.getElementById('settingsCloseBtn');
        const maxItemsInput = document.getElementById('maxItemsInput');
        const pollingMsInput = document.getElementById('pollingMsInput');
        const settingsError = document.getElementById('settingsError');

        const openModal = () => {
            if (!settingsModal) return;
            // populate current settings
            if (maxItemsInput) maxItemsInput.value = this.settings.maxItems ?? 100;
            if (pollingMsInput) pollingMsInput.value = this.settings.pollingMs ?? 1500;
            if (settingsError) settingsError.classList.add('hidden');
            settingsModal.classList.remove('hidden');
            // Ensure feather icons render inside the modal (in case they weren't processed yet)
            if (typeof feather !== 'undefined' && feather.replace) {
                try { feather.replace(); } catch (_) {}
            }
        };
        const closeModal = () => {
            if (!settingsModal) return;
            settingsModal.classList.add('hidden');
        };
        if (settingsBtn) settingsBtn.addEventListener('click', openModal);
        if (settingsCancelBtn) settingsCancelBtn.addEventListener('click', (e) => { e.preventDefault?.(); closeModal(); });
        if (settingsCloseBtn) settingsCloseBtn.addEventListener('click', (e) => { e.preventDefault?.(); closeModal(); });
        if (settingsModal) settingsModal.addEventListener('click', (e) => {
            if (e.target === settingsModal) closeModal();
        });
        if (settingsSaveBtn) settingsSaveBtn.addEventListener('click', async () => {
            const maxItems = Number(maxItemsInput?.value ?? this.settings.maxItems);
            const pollingMs = Number(pollingMsInput?.value ?? this.settings.pollingMs ?? 1500);
            const errors = [];
            if (!Number.isFinite(maxItems) || maxItems < 1 || maxItems > 10000) errors.push('Max items must be between 1 and 10000.');
            if (!Number.isFinite(pollingMs) || pollingMs < 200) errors.push('Polling interval must be at least 200ms.');
            if (errors.length) {
                if (settingsError) {
                    settingsError.textContent = errors.join(' ');
                    settingsError.classList.remove('hidden');
                }
                return;
            }
            // Save via Electron
            if (window.electronAPI && typeof window.electronAPI.saveSettings === 'function') {
                const res = await window.electronAPI.saveSettings({ maxItems, pollingMs });
                if (!res || !res.ok) {
                    if (settingsError) {
                        settingsError.textContent = `Failed to save settings: ${res && res.error ? res.error : 'Unknown error'}`;
                        settingsError.classList.remove('hidden');
                    }
                    return;
                }
                // Apply locally as well (renderer-side adjustments; main will also broadcast)
                this.applySettings(res.settings || { maxItems, pollingMs });
                this.render();
            } else {
                // Fallback: apply locally only
                this.applySettings({ maxItems, pollingMs });
                this.render();
            }
            closeModal();
        });

        // Global keyboard shortcuts
        const isModalOpen = () => (settingsModal && !settingsModal.classList.contains('hidden')) || (this.viewerModal && !this.viewerModal.classList.contains('hidden'));
        const clamp = (val, min, max) => Math.max(min, Math.min(max, val));
        document.addEventListener('keydown', (e) => {
            // ESC closes whichever modal is open
            if (e.key === 'Escape' && isModalOpen()) {
                e.preventDefault();
                if (this.viewerModal && !this.viewerModal.classList.contains('hidden')) {
                    this.closeViewer();
                } else {
                    closeModal();
                }
                return;
            }
            // Ctrl/Cmd + F focuses search
            if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'f') {
                e.preventDefault();
                searchInput?.focus();
                return;
            }
            // Ctrl/Cmd + P opens settings
            if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'p') {
                e.preventDefault();
                openModal();
                // focus first input
                maxItemsInput?.focus();
                return;
            }
            // Ctrl/Cmd + S saves settings if modal is open
            if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 's') {
                if (settingsModal && !settingsModal.classList.contains('hidden')) {
                    e.preventDefault();
                    settingsSaveBtn?.click();
                }
                // Save in viewer edit mode
                if (this.viewer && this.viewer.editing) {
                    e.preventDefault();
                    this.handleViewerSave();
                }
                return;
            }
            // Arrow Up/Down to increment/decrement numeric inputs when focused
            const active = document.activeElement;
            if (active && (active === maxItemsInput || active === pollingMsInput)) {
                const step = Number(active.step || 1) || 1;
                const min = Number(active.min || '');
                const max = Number(active.max || '');
                if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    const next = (Number(active.value || 0) || 0) + step;
                    active.value = String(isNaN(max) ? next : clamp(next, isNaN(min) ? -Infinity : min, max));
                } else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    const next = (Number(active.value || 0) || 0) - step;
                    active.value = String(isNaN(min) ? next : clamp(next, min, isNaN(max) ? Infinity : max));
                }
            }
        });
    }

    clearHistory() {
        this.lruCache = new LRUCache(this.settings.maxItems);
        this.trie = new Trie();
        this.hashMap.clear();
        this.isSelecting = false;
        this.selectedItems.clear();
        // Persist empty history to Electron store (and localStorage fallback)
        this.persistHistory();
        this.render();
    }

    copySelected() {
        const selectedContent = [...this.selectedItems].map(id => {
            const item = this.lruCache.get(id);
            return item ? item.originalContent : '';
        }).join('\n\n');
        if (window.electronAPI && typeof window.electronAPI.copyToClipboard === 'function') {
            window.electronAPI.copyToClipboard(selectedContent);
        } else if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(selectedContent);
        }
        this.showToast('Copied selected items to clipboard!');
        this.isSelecting = false;
        this.selectedItems.clear();
        this.render();
    }

    getFilteredAndSortedItems() {
        let items = this.lruCache.getAll();

        // Apply search (Trie prefix OR substring match)
        if (this.searchQuery) {
            const q = this.searchQuery.toLowerCase();
            const searchIds = new Set(this.trie.search(q));
            items = items.filter(item => searchIds.has(item.id) || (item.originalContent || '').toLowerCase().includes(q));
        }
        // Apply filter
        if (this.currentFilter !== 'all') {
            items = items.filter(item => item.type === this.currentFilter);
        }
        // Apply advanced sort
        items.sort((a, b) => {
            const scoreA = (a.frequency || 1) * 0.3 + (a.lastUsed / Date.now()) * 0.7;
            const scoreB = (b.frequency || 1) * 0.3 + (b.lastUsed / Date.now()) * 0.7;
            return scoreB - scoreA;
        });
        // Update search meta
        try {
            const searchMeta = document.getElementById('searchMeta');
            if (searchMeta) {
                if (this.searchQuery) searchMeta.textContent = `${items.length} result${items.length === 1 ? '' : 's'}`;
                else searchMeta.textContent = '';
            }
        } catch {}
        return items;
    }

    render() {
        const container = document.getElementById('clipboardList');
        const items = this.getFilteredAndSortedItems();
        if (items.length === 0) {
            container.innerHTML = `<div class="no-items-message">
                <i data-feather="alert-triangle" class="icon"></i>
                <h3>Your history is empty</h3>
                <p>Items you copy will appear here. Try adding an item from your clipboard.</p>
            </div>`;
            feather.replace();
            this.updateStats();
            return;
        }
        const q = (this.searchQuery || '').trim();
        container.innerHTML = items.map(item => {
            const timeAgo = this.formatTimeAgo(item.timestamp);
            const isSelected = this.selectedItems.has(item.id);
            const selectedClass = isSelected ? 'selected' : '';
            const checkboxHtml = this.isSelecting ?
                `<input type="checkbox" class="item-checkbox" data-id="${item.id}" ${isSelected ? 'checked' : ''}>`
                : '';

            return `
            <div class="clipboard-item ${selectedClass}" data-id="${item.id}">
                ${checkboxHtml}
                <div class="item-header ${this.isSelecting ? 'with-checkbox' : ''}">
                    <span class="item-type item-type-${item.type}">${item.type.toUpperCase()}</span>
                    <div class="item-meta">
                        <div>${timeAgo}</div>
                        <div>Used ${item.frequency}x</div>
                    </div>
                    <div class="item-actions">
                        <button class="btn btn-ghost btn-view" data-id="${item.id}"><i data-feather="eye" class="btn-icon"></i><span>View</span></button>
                    </div>
                </div>
                <pre class="item-content">${this.escapeAndHighlight(item.originalContent, q)}</pre>
            </div>
            `;
        }).join('');
        // Render feather icons inside newly created elements
        if (typeof feather !== 'undefined' && feather.replace) {
            try { feather.replace(); } catch (_) {}
        }
        // Add event listeners for new items
        container.querySelectorAll('.clipboard-item').forEach(el => {
            el.addEventListener('click', (event) => {
                const id = el.dataset.id;
                if (this.isSelecting) {
                    if (this.selectedItems.has(id)) {
                        this.selectedItems.delete(id);
                    } else {
                        this.selectedItems.add(id);
                    }
                    this.render(); // Re-render to update the visual state
                } else {
                    // If the click is on the View button, don't copy to clipboard
                    const target = event.target.closest?.('.btn-view');
                    if (target) return; 
                    const item = this.lruCache.get(id); // Use get to mark as recently used
                    if (item) {
                        if (window.electronAPI && typeof window.electronAPI.copyToClipboard === 'function') {
                            window.electronAPI.copyToClipboard(item.originalContent);
                        } else if (navigator.clipboard && navigator.clipboard.writeText) {
                            navigator.clipboard.writeText(item.originalContent);
                        }
                        item.lastUsed = Date.now();
                        item.frequency++;
                        this.lruCache.put(id, item); // Update item in cache
                        this.persistHistory();
                        this.showToast('Copied to clipboard!');
                        this.render(); // Re-render to show updated frequency and order
                    }
                }
            });
        });
        // View buttons
        container.querySelectorAll('.btn-view').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.getAttribute('data-id');
                this.openViewer(id);
            });
        });

        this.updateStats();
        this.updateCopySelectedBtnState();
    }

    // Rebuild search/hash indexes after edits/deletes
    rebuildIndexes() {
        const items = this.lruCache.getAll();
        this.trie = new Trie();
        this.hashMap.clear();
        items.forEach(item => {
            this.trie.insert(item.originalContent, item.id);
            this.hashMap.set(this.hash(item.originalContent), item.id);
        });
    }

    // ===== Viewer modal logic =====
    openViewer(id) {
        const item = this.lruCache.get(id);
        if (!item) return;
        this.viewer = { open: true, itemId: id, editing: false };
        if (this.viewerReadOnly) this.viewerReadOnly.textContent = item.originalContent || '';
        if (this.viewerEditor) {
            this.viewerEditor.value = item.originalContent || '';
            this.viewerEditor.classList.add('hidden');
            this.viewerEditor.readOnly = false;
        }
        if (this.viewerSaveBtn) this.viewerSaveBtn.disabled = true;
        if (this.viewerRevertBtn) this.viewerRevertBtn.classList.add('hidden');
        if (this.viewerModal) this.viewerModal.classList.remove('hidden');
        if (typeof feather !== 'undefined' && feather.replace) {
            try { feather.replace(); } catch (_) {}
        }
        // Block copy/cut/paste when not editing
        this.installViewerClipboardBlockers();
    }

    closeViewer() {
        this.viewer = { open: false, itemId: null, editing: false };
        if (this.viewerModal) this.viewerModal.classList.add('hidden');
        this.removeViewerClipboardBlockers();
    }

    enterViewerEdit() {
        if (!this.viewer || !this.viewer.open) return;
        this.viewer.editing = true;
        if (this.viewerReadOnly) this.viewerReadOnly.classList.add('hidden');
        if (this.viewerEditor) {
            this.viewerEditor.classList.remove('hidden');
            this.viewerEditor.focus();
            this.viewerEditor.setSelectionRange(0, 0);
        }
        if (this.viewerSaveBtn) this.viewerSaveBtn.disabled = true;
        if (this.viewerRevertBtn) this.viewerRevertBtn.classList.remove('hidden');
        // Allow clipboard in edit mode
        this.removeViewerClipboardBlockers();
    }

    onViewerInput() {
        if (!this.viewer || !this.viewer.open) return;
        if (this.viewerSaveBtn) this.viewerSaveBtn.disabled = false;
    }

    handleViewerSave() {
        if (!this.viewer || !this.viewer.open || !this.viewer.editing) return;
        const id = this.viewer.itemId;
        const item = this.lruCache.get(id);
        if (!item) return;
        const newText = this.viewerEditor ? String(this.viewerEditor.value || '') : item.originalContent;
        const prevText = item.originalContent;
        if (newText === prevText) {
            // Nothing changed
            this.exitViewerEdit(false);
            return;
        }
        // Backup original on first modification
        if (!item.originalBackup) item.originalBackup = prevText;
        // Update content
        item.originalContent = newText;
        item.lastUsed = Date.now();
        this.lruCache.put(id, item);
        // Rebuild indexes due to content change and persist
        this.rebuildIndexes();
        this.persistHistory();
        this.exitViewerEdit(true);
        this.render();
        this.showToast('Item saved.');
    }

    handleViewerRevert() {
        if (!this.viewer || !this.viewer.open) return;
        const id = this.viewer.itemId;
        const item = this.lruCache.get(id);
        if (!item) return;
        if (item.originalBackup) {
            item.originalContent = item.originalBackup;
            delete item.originalBackup;
            this.lruCache.put(id, item);
            this.rebuildIndexes();
            this.persistHistory();
            // Reset editor to original
            if (this.viewerEditor) this.viewerEditor.value = item.originalContent;
            if (this.viewerReadOnly) this.viewerReadOnly.textContent = item.originalContent;
            this.showToast('Reverted to original.');
        } else if (this.viewerEditor) {
            // If no backup (edit session before save), just reset editor value
            const current = item.originalContent || '';
            this.viewerEditor.value = current;
        }
        // Keep editing state but disable Save until user changes again
        if (this.viewerSaveBtn) this.viewerSaveBtn.disabled = true;
    }

    handleViewerDelete() {
        if (!this.viewer || !this.viewer.open) return;
        const id = this.viewer.itemId;
        // Remove from cache by rebuilding without this id
        const remaining = this.lruCache.getAll().filter(x => x.id !== id);
        this.lruCache = new LRUCache(this.settings.maxItems);
        remaining.forEach(x => this.lruCache.put(x.id, x));
        this.rebuildIndexes();
        this.persistHistory();
        this.closeViewer();
        this.render();
        this.showToast('Item deleted.');
    }

    exitViewerEdit(updated) {
        this.viewer.editing = false;
        const item = this.lruCache.get(this.viewer.itemId);
        if (this.viewerReadOnly && item) {
            this.viewerReadOnly.textContent = item.originalContent || '';
            this.viewerReadOnly.classList.remove('hidden');
        }
        if (this.viewerEditor) this.viewerEditor.classList.add('hidden');
        if (this.viewerSaveBtn) this.viewerSaveBtn.disabled = true;
        if (this.viewerRevertBtn) this.viewerRevertBtn.classList.add('hidden');
        // Block clipboard ops again in read-only
        this.installViewerClipboardBlockers();
    }

    installViewerClipboardBlockers() {
        // Prevent copy/cut/paste when viewer open and not editing
        this._viewerClipboardHandler = (e) => {
            if (this.viewer && this.viewer.open && !this.viewer.editing) {
                e.preventDefault();
            }
        };
        ['copy','cut','paste'].forEach(type => document.addEventListener(type, this._viewerClipboardHandler, { capture: true }));
    }

    removeViewerClipboardBlockers() {
        if (this._viewerClipboardHandler) {
            ['copy','cut','paste'].forEach(type => document.removeEventListener(type, this._viewerClipboardHandler, { capture: true }));
            this._viewerClipboardHandler = null;
        }
    }

    updateStats() {
        const totalItems = this.lruCache.size();
        const storageUsed = JSON.stringify(this.lruCache.getAll()).length;
        document.getElementById('totalItems').textContent = totalItems;
        document.getElementById('storageUsed').textContent = (storageUsed / 1024).toFixed(2) + ' KB';
    }

    updateCopySelectedBtnState() {
        const copySelectedBtn = document.getElementById('copySelectedBtn');
        if (this.isSelecting && this.selectedItems.size > 0) {
            copySelectedBtn.classList.remove('hidden-btn');
        } else {
            copySelectedBtn.classList.add('hidden-btn');
        }
    }
    
    getTypeColors(type) {
        // This method is now obsolete as styling is handled by CSS classes.
        // It's still here to avoid breaking the application, but it is no longer used.
        const colors = {
            url: { bgColor: 'bg-blue-500', textColor: 'text-white' },
            email: { bgColor: 'bg-green-500', textColor: 'text-white' },
            code: { bgColor: 'bg-yellow-500', textColor: 'text-black' },
            json: { bgColor: 'bg-pink-500', textColor: 'text-white' },
            number: { bgColor: 'bg-teal-500', textColor: 'text-white' },
            text: { bgColor: 'bg-gray-500', textColor: 'text-white' }
        };
        return colors[type] || colors.text;
    }
    formatTimeAgo(timestamp) {
        const now = new Date();
        const seconds = Math.floor((now - new Date(timestamp)) / 1000);
        let interval = seconds / 31536000;
        if (interval > 1) return Math.floor(interval) + " years ago";
        interval = seconds / 2592000;
        if (interval > 1) return Math.floor(interval) + " months ago";
        interval = seconds / 86400;
        if (interval > 1) return Math.floor(interval) + " days ago";
        interval = seconds / 3600;
        if (interval > 1) return Math.floor(interval) + " hours ago";
        interval = seconds / 60;
        if (interval > 1) return Math.floor(interval) + " minutes ago";
        return "just now";
    }
    showToast(message, isError = false) {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        if(isError) {
            toast.classList.add('error');
        } else {
            toast.classList.remove('error');
        }
        toast.classList.add('active');
        setTimeout(() => {
            toast.classList.remove('active');
        }, 3000);
    }
    
    setTheme(theme) {
        if (theme === 'africa') {
            document.documentElement.setAttribute('data-theme', 'africa');
        } else {
            document.documentElement.removeAttribute('data-theme');
        }
        
        // Save theme preference
        if (window.electronAPI && typeof window.electronAPI.saveSettings === 'function') {
            window.electronAPI.saveSettings({ theme: theme });
        } else {
            localStorage.setItem('theme', theme);
        }
    }
    
    loadTheme() {
        // Load saved theme preference
        let savedTheme = 'granular'; // default
        
        if (window.electronAPI && typeof window.electronAPI.getSettings === 'function') {
            window.electronAPI.getSettings().then(result => {
                if (result && result.ok && result.settings && result.settings.theme) {
                    this.setTheme(result.settings.theme);
                    const themeSelect = document.getElementById('themeSelect');
                    if (themeSelect) themeSelect.value = result.settings.theme;
                }
            });
        } else {
            savedTheme = localStorage.getItem('theme') || 'granular';
            this.setTheme(savedTheme);
            const themeSelect = document.getElementById('themeSelect');
            if (themeSelect) themeSelect.value = savedTheme;
        }
    }
    
    escapeHtml(unsafe) {
        return unsafe
             .replace(/&/g, "&amp;")
             .replace(/</g, "&lt;")
             .replace(/>/g, "&gt;")
             .replace(/"/g, "&quot;")
             .replace(/'/g, "&#039;");
    }
    escapeAndHighlight(text, query) {
        if (!text) return '';
        const escaped = this.escapeHtml(String(text));
        if (!query) return escaped;
        try {
            const q = String(query).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const re = new RegExp(q, 'gi');
            return escaped.replace(re, (m) => `<mark class="hl">${m}</mark>`);
        } catch {
            return escaped;
        }
    }
}
// Section 3: DOM Initialization
document.addEventListener('DOMContentLoaded', () => {
    new ClipboardManager();
});
