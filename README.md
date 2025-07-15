# Nexus AI Chat Importer Plugin for Obsidian

![Version](https://img.shields.io/badge/version-1.1.0-blue)

## Overview

Import your AI chat conversations from ChatGPT exports into Obsidian as organized Markdown files. Conversations are imported with their attachments (images, documents) when present in the archive.

## ☕ Support My Work

If this plugin helps you, consider supporting its development:

[![Support me on Ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/nexusplugins)

**Suggested amounts:**

- **$5** - Fuel my coding sessions with caffeine ☕
- **$25** - Power my AI development tools 🤖
- **$75** - Supercharge my entire dev toolkit 🚀

*Your support helps me continue building useful tools and explore new ways of making your life easier.*

## Installation

1. Enable Community Plugins in Obsidian settings
2. Search for “Nexus AI Chat Importer” in the Community Plugins list
3. Install and enable the plugin

## Upgrade

When upgrading from previous versions, the plugin will automatically run necessary migrations. All your existing conversations remain functional, and new attachment features are available immediately.

## Configuration

Go to Settings > Nexus AI Chat Importer:

### Basic Settings

- **Conversations folder**: Where to store imported conversations
- **Add date prefix**: Add creation date to filenames (optional)
- **Date format**: YYYY-MM-DD or YYYYMMDD

### Attachment Settings

- **Import attachments**: Enable to import files when present in the archive
- **Attachment folder**: Where to store imported files
- **Handle missing attachments**: Create notes for files not included in exports

## Usage

### Export Your ChatGPT Data

1. Log in to ChatGPT
2. Go to Settings > Data controls
3. Click “Export data”
4. Download the ZIP file when ready

### Import into Obsidian

1. Click the import button in the ribbon (chat icon with +) or use Command Palette
2. Select your ChatGPT export ZIP file(s)
3. Files are processed automatically

### What Gets Imported

- **Conversations**: Each chat becomes a Markdown file organized by date (Year/Month)
- **Attachments**: Images, documents, and DALL-E generated content (if present in the archive)
- **Organization**: Files stored in `Attachments/chatgpt/images/` and `Attachments/chatgpt/documents/`

### Adding Attachments to Existing Notes

If you want to add attachments to conversations imported before v1.1.0:

1. Re-import the same ZIP file
2. Choose “Let’s do this” when prompted
3. Your notes will be recreated with attachment support

### Import Reports

After each import, a report is generated in `Reports/chatgpt/` showing:

- Number of conversations created/updated
- Attachment statistics (✅ found, ⚠️ partial, ❌ missing)
- Links to imported conversations
- **Missing files**: Some older conversations don’t include all attachments in exports

**Need help?**

- Report issues: [GitHub Issues](https://github.com/superkikim/nexus-ai-chat-importer/issues)
- Community discussion: [Obsidian Forum](https://forum.obsidian.md/t/plugin-nexus-ai-chat-importer-import-chatgpt-conversations-to-your-vault/71664/23)

## Important Notes

- **Storage**: Attachments increase vault size - consider excluding from cloud sync
- **Compatibility**: Works on desktop and iOS
- **Updates**: Existing conversations are updated with new messages without duplication

For detailed release information, see [Release Notes](RELEASE_NOTES.md).