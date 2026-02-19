# 🧩 Nexus Gemini Indexer - Browser Extension

Companion extension for [Nexus AI Chat Importer](https://github.com/Superkikim/nexus-ai-chat-importer) to extract Gemini conversation metadata.

## 🎯 Purpose

Google Takeout exports Gemini conversations as individual activity entries **without conversation IDs**. This extension extracts the missing metadata from the Gemini web interface to enable proper conversation grouping in Obsidian.

## 📁 Structure

```
extension/
├── firefox/                          # Firefox extension (also works in Chrome)
│   ├── src/                         # Extension source code
│   ├── test-console-script.js       # 👈 START HERE - Test script
│   ├── manifest.json                # Extension manifest
│   ├── build.sh                     # Build script
│   ├── QUICK-START.md              # Quick start guide
│   ├── TESTING.md                  # Detailed testing instructions
│   └── README.md                   # Extension documentation
│
├── SUMMARY.md                       # 👈 READ THIS - Overview for developers
├── COMMANDS.md                      # Useful commands
├── INTEGRATION-WITH-PLUGIN.md       # How it integrates with Obsidian plugin
├── EXPECTED-OUTPUT-EXAMPLE.json     # Example output format
└── TEST-SCRIPT-COPY-PASTE.txt      # Instructions for console test
```

## 🚀 Quick Start

### Step 1: Test the Console Script (5 minutes)

Before installing the extension, test if the API detection works:

1. Open [gemini.google.com](https://gemini.google.com)
2. Press **F12** → **Console** tab
3. Open `firefox/test-console-script.js`
4. Copy **all** the content
5. Paste in console and press **Enter**
6. Scroll through conversations for 10 seconds
7. Check the results!

**See**: `firefox/QUICK-START.md` for detailed instructions

### Step 2: Analyze Results

If the script extracted conversations ✅:
- Proceed to install the extension
- The API approach works!

If no conversations extracted ❌:
- Share the API responses in a GitHub issue
- We'll adapt the parser or use DOM scraping

### Step 3: Install Extension (if test succeeded)

**Firefox**:
```bash
# 1. Open about:debugging#/runtime/this-firefox
# 2. Click "Load Temporary Add-on"
# 3. Select extension/firefox/manifest.json
```

**Chrome**:
```bash
# 1. Open chrome://extensions/
# 2. Enable "Developer mode"
# 3. Click "Load unpacked"
# 4. Select extension/firefox/ directory
```

### Step 4: Generate Index

1. Go to [gemini.google.com](https://gemini.google.com)
2. Click the extension icon
3. Click "Generate Index"
4. Save the downloaded `gemini_index.json`

### Step 5: Import in Obsidian

1. Export your Google Takeout (Gemini data)
2. Open Obsidian with Nexus AI Chat Importer
3. Import both:
   - The Takeout ZIP
   - The `gemini_index.json`
4. Conversations will be grouped! 🎉

## 📖 Documentation

- **[SUMMARY.md](SUMMARY.md)** - Overview and next steps
- **[firefox/QUICK-START.md](firefox/QUICK-START.md)** - Quick start guide
- **[firefox/TESTING.md](firefox/TESTING.md)** - Detailed testing instructions
- **[COMMANDS.md](COMMANDS.md)** - Useful commands
- **[INTEGRATION-WITH-PLUGIN.md](INTEGRATION-WITH-PLUGIN.md)** - Plugin integration details

## 🎯 What It Extracts

For each conversation:
- **Conversation ID** (from URL)
- **Title** (from Gemini UI)
- **Timestamp** (ISO 8601 format)
- **Prompt preview** (first 30 characters)

Example output:
```json
{
  "conversations": [
    {
      "conversationId": "abc123",
      "title": "My Conversation",
      "url": "https://gemini.google.com/app/abc123",
      "messages": [
        {
          "timestamp": "2025-01-14T10:30:00.000Z",
          "promptPreview": "How do I..."
        }
      ]
    }
  ]
}
```

## 🔧 Development

### Build
```bash
cd firefox
./build.sh
```

### Debug
```bash
# Content script logs: F12 on gemini.google.com
# Background logs: about:debugging → Inspect
# Popup logs: Right-click popup → Inspect
```

### Test
```bash
# Use the console script first!
# See firefox/test-console-script.js
```

## 🐛 Troubleshooting

**"No conversations found"**
- Make sure you're on gemini.google.com
- Scroll through conversations to trigger API calls
- Check Network tab for API responses

**Extension not working**
- Reload extension in about:debugging
- Refresh Gemini page
- Check console for errors

## 📄 License

GPL-3.0-or-later (same as parent project)

## 🔗 Links

- [Parent Project](https://github.com/Superkikim/nexus-ai-chat-importer)
- [Report Issues](https://github.com/Superkikim/nexus-ai-chat-importer/issues)

---

## ⚡ TL;DR

1. **Test**: Run `firefox/test-console-script.js` in browser console
2. **Install**: Load extension in Firefox/Chrome
3. **Extract**: Click "Generate Index" on gemini.google.com
4. **Import**: Use `gemini_index.json` with Takeout in Obsidian
5. **Enjoy**: Grouped conversations instead of scattered notes! 🎉

