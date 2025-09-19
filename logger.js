const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const LOG_DIR = path.join(app.getPath('userData'), 'logs');
const LOG_RETENTION_DAYS = 14; // Keep logs for 14 days

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

/**
 * Get the current date in YYYY-MM-DD format for daily log files
 */
function getCurrentDateString() {
    const now = new Date();
    return now.toISOString().split('T')[0];
}

/**
 * Get the path for today's log file
 */
function getTodaysLogFile() {
    const dateString = getCurrentDateString();
    return path.join(LOG_DIR, `app-${dateString}.log`);
}

/**
 * Format log message with timestamp and severity level
 */
function formatLogMessage(level, message, extra = '') {
    const timestamp = new Date().toISOString();
    const extraStr = extra ? ` | ${extra}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${extraStr}\n`;
}

/**
 * Write message to today's log file
 */
function writeToFile(message) {
    try {
        const logFile = getTodaysLogFile();
        fs.appendFileSync(logFile, message);
    } catch (error) {
        console.error('Failed to write to log file:', error);
    }
}

/**
 * Main logging function
 */
function log(level, message, extra) {
    const logMessage = formatLogMessage(level, message, extra);
    
    // Always log to console in development
    if (process.env.NODE_ENV !== 'production') {
        console.log(logMessage.trim());
    }
    
    // Write to daily log file
    writeToFile(logMessage);
}

/**
 * Clean up log files older than the retention period
 */
function cleanupOldLogs() {
    try {
        const cutoffDate = Date.now() - (LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000);
        const files = fs.readdirSync(LOG_DIR);
        
        let deletedCount = 0;
        files.forEach(file => {
            // Only process log files (app-YYYY-MM-DD.log format)
            if (file.match(/^app-\d{4}-\d{2}-\d{2}\.log$/)) {
                const filePath = path.join(LOG_DIR, file);
                try {
                    const stats = fs.statSync(filePath);
                    if (stats.mtime.getTime() < cutoffDate) {
                        fs.unlinkSync(filePath);
                        deletedCount++;
                    }
                } catch (fileError) {
                    console.error(`Failed to process log file ${file}:`, fileError);
                }
            }
        });
        
        if (deletedCount > 0) {
            log('info', `Cleaned up ${deletedCount} old log files (older than ${LOG_RETENTION_DAYS} days)`);
        }
    } catch (error) {
        console.error('Failed to cleanup old logs:', error);
    }
}

/**
 * Log installation/first run event
 */
function logInstallation() {
    log('info', 'INSTALLATION: Application first run detected - simulating successful installation log');
    log('info', `Application version: ${app.getVersion()}`);
    log('info', `Platform: ${process.platform} ${process.arch}`);
    log('info', `Electron version: ${process.versions.electron}`);
    log('info', `Node.js version: ${process.versions.node}`);
    log('info', `User data path: ${app.getPath('userData')}`);
}

module.exports = {
    // Standard logging methods
    info: (message, extra) => log('info', message, extra),
    error: (message, extra) => log('error', message, extra),
    warn: (message, extra) => log('warn', message, extra),
    debug: (message, extra) => log('debug', message, extra),
    usage: (message, extra) => log('usage', message, extra),
    
    // Utility methods
    cleanupOldLogs,
    logInstallation,
    
    // Get log directory for external access if needed
    getLogDir: () => LOG_DIR,
    getTodaysLogFile
};
