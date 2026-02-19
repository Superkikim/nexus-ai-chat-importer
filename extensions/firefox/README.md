# Nexus Gemini Indexer - Firefox Extension

Companion extension for [Nexus AI Chat Importer](https://github.com/Superkikim/nexus-ai-chat-importer) to extract Gemini conversation metadata.

## 🎯 Purpose

Google Takeout exports Gemini conversations as individual activity entries without conversation IDs. This extension extracts the missing metadata from the Gemini web interface to enable proper conversation grouping in Obsidian.

## 📦 What it extracts

For each conversation:
- **Conversation ID** (from URL)
- **Title** (from Gemini UI)
- **Timestamp** (ISO 8601 format)
- **Prompt preview** (first 30 characters of each message)

## 🧪 Testing (Console Script)

Before installing the extension, test the API detection:

1. Open [gemini.google.com](https://gemini.google.com)
2. Open DevTools (F12) → Console tab
3. Copy-paste the content of `test-console-script.js`
4. Press Enter
5. Scroll through conversations or click on different chats
6. After 10 seconds, check the console output

The script will show:
- All captured API calls
- Extracted conversation data
- JSON output ready for the plugin

## 🚀 Installation (Development)

### Firefox

1. Open Firefox
2. Navigate to `about:debugging#/runtime/this-firefox`
3. Click "Load Temporary Add-on"
4. Select the `manifest.json` file from this directory
5. The extension is now loaded (temporary - will be removed on browser restart)

### Chrome (for testing)

1. Open Chrome
2. Navigate to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select this directory
6. The extension is now loaded

## 📖 Usage

1. Install the extension
2. Open [gemini.google.com](https://gemini.google.com)
3. Click the extension icon in your browser toolbar
4. Click "Test API Detection" to verify it works
5. Click "Generate Index" to extract all conversations
6. Save the downloaded `gemini_index.json` file
7. Import it along with your Google Takeout in Obsidian

## 🔧 Development

### File Structure

```
extension/firefox/
├── manifest.json           # Extension manifest
├── src/
│   ├── popup.html         # Extension popup UI
│   ├── popup.css          # Popup styles
│   ├── popup.js           # Popup logic
│   ├── content-script.js  # Runs on gemini.google.com
│   └── background.js      # Background service
├── icons/                 # Extension icons (TODO)
├── test-console-script.js # Standalone test script
└── README.md             # This file
```

### TODO

- [ ] Add extension icons (16x16, 48x48, 128x128)
- [ ] Finalize API response parsing (depends on test results)
- [ ] Add progress indicator for large conversation lists
- [ ] Handle pagination/infinite scroll
- [ ] Add error handling for rate limiting
- [ ] Create Chrome-compatible version

## 🐛 Debugging

### Enable verbose logging

Open DevTools on the Gemini page and check:
- Console tab: Content script logs
- Network tab: API calls to `gemini.google.com`

### Common issues

**"No conversations found"**
- Make sure you're on a Gemini conversation page
- Try scrolling through the sidebar to trigger API calls
- Check the Network tab for API responses

**"Extension not working"**
- Reload the extension in `about:debugging`
- Refresh the Gemini page
- Check browser console for errors

## 📄 License

GPL-3.0-or-later (same as parent project)

## 🔗 Links

- [Parent Project](https://github.com/Superkikim/nexus-ai-chat-importer)
- [Report Issues](https://github.com/Superkikim/nexus-ai-chat-importer/issues)

