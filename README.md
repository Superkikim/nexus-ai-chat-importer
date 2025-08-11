# Nexus AI Chat Importer

[![Version](https://img.shields.io/badge/version-1.2.0-blue)](https://github.com/Superkikim/nexus-ai-chat-importer/releases/tag/1.2.0)
[![GitHub release (latest by date)](https://img.shields.io/github/v/release/superkikim/nexus-ai-chat-importer)](https://github.com/Superkikim/nexus-ai-chat-importer/releases/latest)
[![GitHub all releases](https://img.shields.io/github/downloads/superkikim/nexus-ai-chat-importer/total)](https://github.com/Superkikim/nexus-ai-chat-importer/releases)

## Overview

Import your AI chat conversations from **ChatGPT** and **Claude** exports into Obsidian as beautifully formatted Markdown files with colored message boxes, attachment support, and Claude artifact versioning.

## ☕ Support My Work

If this plugin makes your life easier, consider supporting its development:

[![Support me on Ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/nexusplugins)

**Suggested amounts:**
- **$5** - Buy me a coffee ☕
- **$25** - Power my AI development tools 🤖
- **$75** - Supercharge my entire dev toolkit 🚀

## ✨ Key Features

- 💬 **ChatGPT & Claude Support**: Import conversations from both platforms
- 🎨 **Colored Message Boxes**: Beautiful, organized conversation layout
- 📎 **Attachment Handling**: Images, documents, and DALL-E creations
- 🎨 **Claude Artifact Versioning**: Separate files for each artifact modification
- ⏱️ **Progress Tracking**: Real-time feedback during large imports
- 📁 **Smart Organization**: Conversations organized by provider, year, and month

## 📥 Installation

**Community Plugins** → **Browse** → Search "Nexus" → **Install**

**Note**: Upgrades will automatically reformat and reorganize existing conversations.

## ⚙️ Settings

- **Date Format**: Add a date suffix and select your preferred presentation (with or without dashes)
- **Archive Folder**: Where conversations are stored
- **Attachment Folder**: Where images/files are saved
- **Import Attachments**: Enable/disable attachment extraction
- **Skip Missing Attachments**: Continue import if files are missing

## 💡 Recommendations

- Exclude the Nexus attachment folder from sync
- Use Reading View for better user experience

## 📤 Get Export Files

**ChatGPT**: Settings → Data Controls → Export data  
**Claude**: Settings → Privacy → Export data

## 📥 Import in Obsidian

Click the chat+ icon, or **Ctrl+P** → Type "Nexus" → Select "Select zip file to process"

Select ChatGPT or Claude. You can select multiple files - they'll be processed chronologically.

**Be patient**: Large archives may take time and impact Obsidian performance during indexing.

## 📁 File Organization

### Conversations
- **ChatGPT**: `Archive Folder/chatgpt/YYYY/MM/conversation-title.md`
- **Claude**: `Archive Folder/claude/YYYY/MM/conversation-title.md`

### Attachments
- **Images/Files**: `Attachment Folder/provider/YYYY/MM/`
- **Claude Artifacts**: `Attachment Folder/claude/artifacts/conversation_id/artifact_v1.md`

### Reports
- **Import Reports**: `Archive Folder/Reports/provider/import-report.md`

## 🔄 Reimporting

You can safely reimport the same ZIP file to:
- Add new conversations from updated exports
- Upgrade old conversations with new features
- Fix any import issues

The plugin automatically detects existing conversations and handles updates intelligently.

## ⚠️ Important Notes

### Claude Projects
Currently, Claude exports don't include project association data. This limitation has been reported to Anthropic. Individual conversations are imported regardless of their project association.

### Performance
- Large archives (1000+ conversations) may take several minutes to process
- Obsidian may become temporarily unresponsive during indexing
- Consider importing in smaller batches if you experience issues

## 🐛 Troubleshooting

### Import Stuck or Slow
- Check the progress dialog for current status
- Large archives with many attachments take longer
- Restart Obsidian if the process seems frozen

### Missing Attachments
- Enable "Import Attachments" in settings
- Check that your export includes the attachments folder
- Some older exports may not contain all referenced files

### Formatting Issues
- Use Reading View for the best experience
- Ensure your Obsidian theme supports callouts
- Check that the plugin is up to date

## 📝 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🔗 Links

- **GitHub**: [Repository](https://github.com/Superkikim/nexus-ai-chat-importer)
- **Issues**: [Report bugs](https://github.com/Superkikim/nexus-ai-chat-importer/issues)
- **Releases**: [Version history](https://github.com/Superkikim/nexus-ai-chat-importer/releases)
