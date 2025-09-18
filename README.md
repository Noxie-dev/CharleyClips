Clipboard History Pro
Clipboard History Pro is a powerful, local-first clipboard manager designed to help you keep a record of everything you copy. It provides a clean, searchable, and filterable interface to quickly find and reuse text, code snippets, URLs, and more.

Features
Persistent History: Automatically saves a history of copied items directly in your browser's local storage.

Intelligent Search: Instantly find items with a live-updating search bar that filters your history as you type.

Content Filtering: Categorize and filter items by type, including text, URLs, and code.

Multi-select and Copy: Activate "Select" mode to choose multiple items and copy their combined content to the clipboard with a single click.

Quick Copy: Easily copy any individual item back to your clipboard by simply clicking on it.

Real-time Stats: Monitor your total items and the storage space used right on the dashboard.

Clear History: A one-click option to clear your entire clipboard history.

Algorithms & Architecture
This application is built with a sophisticated, object-oriented architecture and incorporates several advanced algorithms to deliver a seamless and high-performance experience:

Trie (Prefix Tree): The search functionality is powered by a Trie, an extremely efficient data structure for prefix-based searching. This allows the application to find results instantly as you type, with a search time complexity independent of the total number of items.

LRU (Least Recently Used) Cache: The history is managed as a fixed-size LRU cache. This algorithm automatically removes the least recently used items when the limit is reached, ensuring the application remains fast and doesn't consume excessive memory.

Hashing: A custom hashing function is used to create a unique identifier for each clipboard item. This allows for extremely fast duplicate detection, preventing the history from being cluttered with redundant entries. Instead of saving a new copy, it simply updates the usage frequency of the existing item.

Advanced Relevance Sorting: Items are not just sorted by time. A weighted score is calculated for each item based on its usage frequency and recency. This ensures that the most relevant and most used items always appear at the top of the list.

How to Use
Paste Items: Click the Paste button to add the current content from your system clipboard to the history.

Search: Use the search bar to find specific entries. The list will update automatically.

Filter: Click the filter buttons (All, Text, URLs, Code) to narrow down your history.

Copy Single Item: Click on any item in the list to copy its content to your clipboard.

Copy Multiple Items: Click the Select button, check the boxes for the items you want, and then click Copy Selected.

Clear History: To start fresh, click the Clear button.

Technologies Used
HTML5: For the application structure.

Tailwind CSS: For all styling and responsive design.

JavaScript (ES6+): For all application logic.