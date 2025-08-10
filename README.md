# Nexus AI Chat Importer Plugin for Obsidian

[![Version](https://img.shields.io/badge/version-1.2.0-blue)](https://github.com/Superkikim/nexus-ai-chat-importer/releases/tag/1.2.0)
[![GitHub release (latest by date)](https://img.shields.io/github/v/release/superkikim/nexus-ai-chat-importer)](https://github.com/Superkikim/nexus-ai-chat-importer/releases/latest)
[![GitHub all releases](https://img.shields.io/github/downloads/superkikim/nexus-ai-chat-importer/total)](https://github.com/Superkikim/nexus-ai-chat-importer/releases)
[![GitHub](https://img.shields.io/github/license/superkikim/nexus-ai-chat-importer)](https://github.com/Superkikim/nexus-ai-chat-importer/blob/master/LICENSE)
[![Obsidian Plugin](https://img.shields.io/badge/Obsidian-Plugin-purple)](https://obsidian.md/)
[![Platform](https://img.shields.io/badge/Platform-Desktop%20%7C%20Mobile-blue)](https://obsidian.md/)

## Overview

Import your AI chat conversations from **ChatGPT** and **Claude** exports into Obsidian as beautifully formatted Markdown files. Features modern callout-based UI, complete attachment support, and Claude artifact versioning for a professional note-taking experience.

## ☕ Support My Work

I spend about $100/month for A.I. services, not counting my time and other expenses. If this plugin makes your life easier, consider supporting its development:

[![Support me on Ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/nexusplugins)

**Suggested amounts:**

- **$5** - Fuel my coding sessions with caffeine ☕
- **$25** - Power my AI development tools 🤖
- **$75** - Supercharge my entire dev toolkit 🚀

*Your support helps me continue building useful tools and explore new ways of making your life easier.*

## Features

- **Multi-Provider Support**: Import from ChatGPT and Claude exports
- **Smart Organization**: Conversations organized by provider, year, and month
- **Attachment Handling**: Extracts and saves images, documents, and DALL-E creations
- **Claude Artifact Versioning**: Each artifact modification creates a new version file (v1, v2, v3...)
- **Update-Safe Imports**: Re-import conversations to add new messages without duplication
- **Comprehensive Reports**: Detailed import summaries with statistics and links
- **Flexible Settings**: Customize folder structure, date formats, and import behavior
- **Cross-Platform**: Works on desktop and mobile Obsidian

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

### Export Your Data

#### ChatGPT
1. Log in to ChatGPT
2. Go to Settings > Data controls
3. Click “Export data”
4. Download the ZIP file when ready

#### Claude
1. Log in to Claude
2. Go to Settings > Export data
3. Download your conversation archive

⚠️ **Note on Claude Projects**: Currently, Claude exports don't include project association data for conversations. This limitation has been reported to Anthropic. Until they provide a solution, project-based organization is not supported. Individual conversations are imported regardless of their project association.

### Import into Obsidian

1. Click the import button in the ribbon (chat icon with +) or use Command Palette
2. Select your ChatGPT or Claude export ZIP file(s)
3. Files are processed automatically
4. Review the import report for detailed results and any issues
5. **Switch to Reading View** for optimal display of conversations with beautiful callouts

### ⚠️ **Important Performance Considerations**

#### **Large Archives Impact**
- **Processing Time**: Archives with hundreds or thousands of conversations can take several minutes to process
- **System Resources**: Large imports may temporarily impact your computer's performance and memory usage
- **Obsidian Indexing**: After import, Obsidian will need time to index all new files, which may slow down search and linking

#### **Best Practices for Archive Management**

🔒 **Archive Safety**
- **Keep your exported archives secure** even after successful import - they serve as your backup
- **Store archives in a safe location** separate from your Obsidian vault for redundancy

📦 **Regular Maintenance**
- **Export conversations regularly** (monthly/quarterly) rather than waiting for massive archives
- **Delete old conversations** from the web apps after successful export to keep future archives manageable
- **Smaller, frequent imports** are faster and less resource-intensive than large, infrequent ones

💡 **Pro Tips**
- **Close other applications** during large imports to free up system resources
- **Import during off-hours** when you don't need to actively use Obsidian
- **Monitor the import report** for any failed conversations that may need manual attention

### 🎨 **Optimal Display Experience**

#### **Reading View Recommended**
- **Beautiful callouts**: Conversations display with color-coded callouts for users, assistants, attachments, and artifacts
- **Clean formatting**: Proper spacing and visual hierarchy optimized for reading
- **Interactive elements**: All links and embedded content work seamlessly

#### **Editor View Considerations**
- **Functional but basic**: All content is accessible but callouts appear as raw markdown
- **Editing friendly**: Easy to modify conversation content when needed
- **Reduced visual appeal**: Less colorful and structured than Reading View

💡 **Recommendation**: Use **Reading View** (Ctrl/Cmd + E) for the best conversation browsing experience!

### What Gets Imported

- **Conversations**: Each chat becomes a Markdown file organized by date (Year/Month)
- **Attachments**: Images, documents, and DALL-E generated content (if present in the archive)
- **Claude Artifacts**: Code, documents, and other artifacts saved as individual versioned files
- **Organization**: Files stored in provider-specific folders (`Attachments/chatgpt/`, `Attachments/claude/`)

### Adding Attachments to Existing Notes

If you want to add attachments to conversations imported before v1.1.0:

1. Re-import the same ZIP file
2. Choose “Let’s do this” when prompted
3. Your notes will be recreated with attachment support

### Import Reports

After each import, a report is generated in `Reports/{provider}/` showing:

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