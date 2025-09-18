# Codebase Index - Charley-Clips

## Project Overview
**Clipboard History Pro** is an Electron-based desktop application that provides a sophisticated clipboard manager with advanced search and filtering capabilities. The application uses local storage and Firebase integration for data persistence.

## Project Structure

```
/Users/director/Documents/Charley-Clips/
├── README.md                 # Project documentation and feature overview
├── package.json             # Node.js dependencies and scripts
├── package-lock.json        # Dependency lock file
├── index.html              # Main HTML structure and Firebase setup
├── app.js                  # Core application logic and data structures
├── styles.css              # CSS styling and responsive design
├── preload.js              # Electron preload script for IPC
├── main.js                 # Electron main process (window, IPC, clipboard polling)
└── node_modules/           # Node.js dependencies directory
```

## File Descriptions

### Core Application Files

#### `index.html` (3,946 bytes)
- **Purpose**: Main HTML structure and Firebase initialization
- **Key Features**:
  - Firebase SDK imports and configuration
  - User authentication setup (anonymous sign-in)
  - UI structure with header, controls, filters, and clipboard list
  - Feather Icons integration for UI elements
- **Dependencies**: Firebase v11.6.1, Feather Icons, styles.css, app.js

#### `app.js` (13,305 bytes)
- **Purpose**: Core application logic and advanced data structures
- **Key Components**:
  - **TrieNode & Trie Classes**: Prefix tree for efficient search functionality
  - **LRUCache Class**: Least Recently Used cache for history management
  - **ContentClassifier Class**: Intelligent content type detection (URL, email, JSON, code, numbers)
  - **ClipboardManager Class**: Main application controller
- **Algorithms Implemented**:
  - Trie-based search with O(m) complexity where m is query length
  - LRU cache for memory-efficient history management
  - Custom hashing for duplicate detection
  - Weighted relevance scoring based on usage frequency and recency

#### `styles.css` (6,486 bytes)
- **Purpose**: Complete styling and responsive design
- **Features**:
  - Dark theme with custom color palette
  - Responsive grid layouts
  - Button states and animations
  - Toast notification styling
  - Mobile-first responsive design

#### `preload.js` (443 bytes)
- **Purpose**: Electron preload script for secure IPC communication
- **Exposed APIs**:
  - `onInitialData`: Listen for initial data from main process
  - `onUpdateClipboard`: Listen for clipboard updates
  - `copyToClipboard`: Copy text to system clipboard
  - `saveClipboardHistory`: Save history data

### Configuration Files

#### `package.json` (213 bytes)
- **Project Name**: clipboard-history-app
- **Version**: 1.0.0
- **Main Entry**: main.js
- **Dependencies**:
  - `electron`: ^38.1.2 (Desktop app framework)
  - `electron-store`: ^8.1.0 (Data persistence)
- **Scripts**: `start: electron .`

#### `README.md` (2,992 bytes)
- **Purpose**: Comprehensive project documentation
- **Sections**:
  - Feature overview
  - Architecture and algorithms explanation
  - Usage instructions
  - Technology stack

### Electron Main Process

#### `main.js` (~129 lines)
- **Purpose**: Electron main process entry point
- **Responsibilities**:
  - Create `BrowserWindow` and load `index.html`
  - Wire `preload.js` with `contextIsolation: true`
  - IPC handlers: `copy-to-clipboard`, `save-clipboard-history`
  - Send `initial-data` (history and settings via `electron-store`)
  - Clipboard polling to broadcast `clipboard-update`
  - Single-instance lock and macOS lifecycle handling

## Architecture Overview

### Data Structures
1. **Trie (Prefix Tree)**: Enables instant search with prefix matching
2. **LRU Cache**: Manages clipboard history with automatic cleanup
3. **Content Classification**: Intelligent categorization of clipboard content

### Key Features
- **Real-time Search**: Trie-based instant search as you type
- **Smart Filtering**: Content type detection and filtering
- **Multi-select Operations**: Batch operations on clipboard items
- **Persistence**: Local storage with Firebase backup
- **Responsive Design**: Mobile-friendly interface

### Technology Stack
- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Desktop Framework**: Electron
- **Database**: Firebase Firestore
- **Authentication**: Firebase Anonymous Auth
- **Styling**: Custom CSS with responsive design
- **Icons**: Feather Icons

## Development Status
- ✅ Core functionality implemented
- ✅ Advanced search and filtering
- ✅ UI/UX complete
- ✅ Firebase integration
- ✅ Main Electron process (main.js) implemented
- ✅ Preload script for IPC ready

## Entry Points
- **Web Version**: Open `index.html` in browser
- **Electron App**: Run `npm start`

## Dependencies
- Node.js and npm
- Electron ^38.1.2
- Firebase account for cloud features
- Modern web browser for web version

---
*Generated on: 2025-09-18T13:40:40+02:00*
*Total Files Analyzed: 9*
*Total Lines of Code: ~400+ (excluding dependencies)*
