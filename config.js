const fs = require('fs');
const path = require('path');
const { app } = require('electron');

let CONFIG_FILE = null; // initialized in init()

const DEFAULT_CONFIG = {
    maxHistoryItems: 100,
    clipboardPollingIntervalMs: 1500,
    port: 30303,
    autoStart: false,
    theme: 'granular',
    enableLogging: true,
    logLevel: 'info'
};

let config = { ...DEFAULT_CONFIG };
let initialized = false;

function loadConfig() {
    try {
        if (CONFIG_FILE && fs.existsSync(CONFIG_FILE)) {
            const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
            const loadedConfig = JSON.parse(data);
            config = { ...DEFAULT_CONFIG, ...loadedConfig };
        }
    } catch (error) {
        console.error('Failed to load config, using defaults:', error);
        config = { ...DEFAULT_CONFIG };
    }
}

function saveConfig() {
    try {
        if (!CONFIG_FILE) return; // not ready yet
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    } catch (error) {
        console.error('Failed to save config:', error);
    }
}

function validateConfig(newConfig) {
    const validated = {};
    
    // Validate maxHistoryItems
    if (typeof newConfig.maxHistoryItems === 'number' && 
        newConfig.maxHistoryItems >= 1 && 
        newConfig.maxHistoryItems <= 10000) {
        validated.maxHistoryItems = Math.floor(newConfig.maxHistoryItems);
    }
    
    // Validate clipboardPollingIntervalMs
    if (typeof newConfig.clipboardPollingIntervalMs === 'number' && 
        newConfig.clipboardPollingIntervalMs >= 200 && 
        newConfig.clipboardPollingIntervalMs <= 10000) {
        validated.clipboardPollingIntervalMs = Math.floor(newConfig.clipboardPollingIntervalMs);
    }
    
    // Validate boolean fields
    if (typeof newConfig.autoStart === 'boolean') {
        validated.autoStart = newConfig.autoStart;
    }
    
    if (typeof newConfig.enableLogging === 'boolean') {
        validated.enableLogging = newConfig.enableLogging;
    }
    
    // Validate theme
    if (typeof newConfig.theme === 'string' && 
        ['granular', 'africa'].includes(newConfig.theme)) {
        validated.theme = newConfig.theme;
    }
    
    // Validate logLevel
    if (typeof newConfig.logLevel === 'string' && 
        ['debug', 'info', 'warn', 'error'].includes(newConfig.logLevel)) {
        validated.logLevel = newConfig.logLevel;
    }
    
    // Validate port (allow typical user-space ports)
    if (typeof newConfig.port === 'number') {
        const p = Math.floor(newConfig.port);
        if (p >= 1024 && p <= 65535) {
            validated.port = p;
        }
    }

    return validated;
}

function init() {
    if (initialized) return;
    // Ensure Electron app is ready before resolving userData path
    if (!app.isReady()) {
        throw new Error('config.init() must be called after app.whenReady()');
    }
    CONFIG_FILE = path.join(app.getPath('userData'), 'config.json');
    loadConfig();
    initialized = true;
}

module.exports = {
    init,
    get: (key) => {
        if (key) {
            return config[key];
        }
        return { ...config };
    },
    
    set: (key, value) => {
        if (typeof key === 'object') {
            // Bulk update
            const validated = validateConfig(key);
            config = { ...config, ...validated };
        } else {
            // Single key update
            const validated = validateConfig({ [key]: value });
            if (validated[key] !== undefined) {
                config[key] = validated[key];
            }
        }
        saveConfig();
        return config[key];
    },
    
    reset: () => {
        config = { ...DEFAULT_CONFIG };
        saveConfig();
        return config;
    },
    
    getPath: () => CONFIG_FILE,
    
    // Export current config for CLI
    export: () => ({ ...config }),
    
    // Import config from object
    import: (newConfig) => {
        const validated = validateConfig(newConfig);
        config = { ...DEFAULT_CONFIG, ...validated };
        saveConfig();
        return config;
    }
};
