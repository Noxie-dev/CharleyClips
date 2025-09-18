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
        this.init();
    }
    init() {
        this.loadFromStorage();
        this.setupEventListeners();
        this.render();
        feather.replace(); // Initialize icons
    }
    loadFromStorage() {
        const savedItems = JSON.parse(localStorage.getItem('clipboardHistory') || '[]');
        savedItems.forEach(item => {
            const hash = this.hash(item.originalContent);
            if (!this.hashMap.has(hash)) {
                this.lruCache.put(item.id, item);
                this.hashMap.set(hash, item.id);
                this.trie.insert(item.originalContent, item.id);
            }
        });
    }
    saveToStorage() {
        localStorage.setItem('clipboardHistory', JSON.stringify(this.lruCache.getAll()));
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
            const text = await navigator.clipboard.readText();
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
        this.saveToStorage();
        this.render();
    }
    setupEventListeners() {
        document.getElementById('pasteBtn').addEventListener('click', () => this.addItemFromPaste());
        document.getElementById('clearBtn').addEventListener('click', () => this.clearHistory());
        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.searchQuery = e.target.value;
            this.render();
        });
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
    }
    clearHistory() {
        localStorage.removeItem('clipboardHistory');
        this.lruCache = new LRUCache(this.settings.maxItems);
        this.trie = new Trie();
        this.hashMap.clear();
        this.isSelecting = false;
        this.selectedItems.clear();
        this.render();
    }
    copySelected() {
        const selectedContent = [...this.selectedItems].map(id => {
            const item = this.lruCache.get(id);
            return item ? item.originalContent : '';
        }).join('\n\n');
        navigator.clipboard.writeText(selectedContent);
        this.showToast('Copied selected items to clipboard!');
        this.isSelecting = false;
        this.selectedItems.clear();
        this.render();
    }
    getFilteredAndSortedItems() {
        let items = this.lruCache.getAll();
        
        // Apply search
        if (this.searchQuery) {
            const searchIds = this.trie.search(this.searchQuery);
            items = items.filter(item => searchIds.includes(item.id));
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
        return items;
    }
    render() {
        const container = document.getElementById('clipboardList');
        const items = this.getFilteredAndSortedItems();
        if (items.length === 0) {
            container.innerHTML = `<div class="no-items-message">
                <i data-feather="clipboard" class="icon"></i>
                <h3>No items found</h3>
                <p>Paste something to get started!</p>
            </div>`;
            feather.replace();
            this.updateStats();
            return;
        }
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
                </div>
                <pre class="item-content">${this.escapeHtml(item.originalContent)}</pre>
            </div>
            `;
        }).join('');
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
                    const item = this.lruCache.get(id); // Use get to mark as recently used
                    if (item) {
                        navigator.clipboard.writeText(item.originalContent);
                        item.lastUsed = Date.now();
                        item.frequency++;
                        this.lruCache.put(id, item); // Update item in cache
                        this.saveToStorage();
                        this.showToast('Copied to clipboard!');
                        this.render(); // Re-render to show updated frequency and order
                    }
                }
            });
        });
        
        this.updateStats();
        this.updateCopySelectedBtnState();
    }
    
    updateStats() {
        const totalItems = this.lruCache.size();
        const storageUsed = (localStorage.getItem('clipboardHistory') || '').length;
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
    escapeHtml(unsafe) {
        return unsafe
             .replace(/&/g, "&amp;")
             .replace(/</g, "&lt;")
             .replace(/>/g, "&gt;")
             .replace(/"/g, "&quot;")
             .replace(/'/g, "&#039;");
    }
}
// Section 3: DOM Initialization
document.addEventListener('DOMContentLoaded', () => {
    new ClipboardManager();
});
