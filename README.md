# Nexus AI Chat Importer

[![Version](https://img.shields.io/badge/version-1.3.0-blue)](https://github.com/Superkikim/nexus-ai-chat-importer/releases/tag/1.3.0) [![GitHub release (latest by date)](https://img.shields.io/github/v/release/superkikim/nexus-ai-chat-importer)](https://github.com/Superkikim/nexus-ai-chat-importer/releases/latest) [![GitHub all releases](https://img.shields.io/github/downloads/superkikim/nexus-ai-chat-importer/total)](https://github.com/Superkikim/nexus-ai-chat-importer/releases)

## Table of Contents

- [Overview](#overview)
- [☕ Support My Work](#-support-my-work)
- [✨ Key Features](#-key-features)
- [📥 Installation](#-installation)
- [🚀 Quick Start](#-quick-start)
- [⚙️ Settings](#️-settings)
- [💡 Best Practices](#-best-practices)
- [📁 File Organization](#-file-organization)
- [🎨 Visual Features](#-visual-features)
- [🔄 Selective Import](#-selective-import)
- [📎 Attachment Handling](#-attachment-handling)
- [📊 Import Reports](#-import-reports)
- [🔄 Reimporting & Updates](#-reimporting--updates)
- [⚠️ Important Notes](#️-important-notes)
- [🐛 Troubleshooting](#-troubleshooting)
- [📝 License](#-license)
- [🙏 Credits](#-credits)
- [🔗 Links](#-links)

## Overview

Import your AI chat conversations from **ChatGPT** and **Claude** exports into Obsidian as beautifully formatted Markdown files. Choose exactly which conversations to import, enjoy enhanced visual presentation with custom callouts, and benefit from comprehensive attachment support including DALL-E images and Claude artifact versioning.

## ☕ Support My Work

**This plugin is free and always will be.** I build it in my free time, dedicating hundreds of hours to development, bug fixes, and new features.

**If you find it valuable, please consider supporting its development:**

[![Support me on Ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/nexusplugins)

**Why support?**
- 🚀 **Faster development** - More time for features and improvements
- 🐛 **Better support** - Quicker bug fixes and responses
- 💡 **New features** - Your suggestions become reality
- ❤️ **Motivation** - Shows that my work is appreciated

**Suggested amounts:**
- **$5** - Buy me a coffee ☕ (Thank you!)
- **$25** - Power my AI development tools 🤖 (Amazing!)
- **$75** - Supercharge my entire dev toolkit 🚀 (You're a hero!)

> **Reality check**: In the first month, I received only 2 donations totaling $10. Meanwhile, the plugin has been downloaded thousands of times. If you use it regularly, please consider contributing. Even $5 makes a difference! 🙏

## ✨ Key Features

- 🎯 **Selective Import**: Choose exactly which conversations to import with interactive preview
- 💬 **Multi-Provider Support**: Full support for ChatGPT and Claude conversations
- 🎨 **Beautiful Formatting**: Custom callouts with role-specific colors and icons
- 📎 **Complete Attachment Handling**: Images, documents, DALL-E creations with prompts
- 🎨 **Claude Artifact Versioning**: Separate files for each artifact modification
- 📊 **Detailed Reports**: Comprehensive import statistics with per-file breakdown
- 🗂️ **Flexible Organization**: Separate folders for conversations, attachments, and reports
- 🌍 **International Support**: ISO 8601 timestamps, works with all locales
- ⏱️ **Progress Tracking**: Real-time feedback during large imports
- 🔄 **Smart Deduplication**: Handles multiple ZIP files without creating duplicates

## 📥 Installation

### From Obsidian Community Plugins

1. Open **Settings** → **Community Plugins**
2. Click **Browse** and search for "**Nexus AI Chat Importer**"
3. Click **Install**, then **Enable**

### Manual Installation

1. Download the latest release from [GitHub Releases](https://github.com/Superkikim/nexus-ai-chat-importer/releases)
2. Extract the files to your vault's `.obsidian/plugins/nexus-ai-chat-importer/` folder
3. Reload Obsidian and enable the plugin in Settings

**Note**: Upgrades automatically migrate your settings and existing conversations to the latest format.

## 🚀 Quick Start

### 1. Export Your Conversations

**ChatGPT**:
- Go to **Settings** → **Data Controls** → **Export data**
- Wait for the email with your download link
- Download the ZIP file

**Claude**:
- Go to **Settings** → **Privacy** → **Export data**
- Wait for the email with your download link
- Download the ZIP file

### 2. Import into Obsidian

1. Click the **chat+** icon in the ribbon, or use **Ctrl/Cmd+P** → "**Nexus: Select zip file to process**"
2. Select your provider (ChatGPT or Claude)
3. Choose one or more ZIP files to import
4. **Review and select** which conversations to import
5. Click **Import Selected** and wait for completion

### 3. View Your Conversations

- Conversations are organized by provider, year, and month
- Click any conversation title to open it
- Use **Reading View** for the best visual experience
- Check the import report for detailed statistics

## ⚙️ Settings

### Folder Configuration

- **Conversations Folder**: Where conversation notes are stored (default: `Nexus AI Chat Imports/Conversations`)
- **Attachments Folder**: Where images, files, and artifacts are saved (default: `Nexus AI Chat Imports/Attachments`)
- **Reports Folder**: Where import reports are generated (default: `Nexus AI Chat Imports/Reports`)

**Tip**: You can change these folders at any time. The plugin will offer to migrate existing content.

### Display Options

- **Add Date Suffix**: Append conversation date to filenames
- **Date Format**: Choose between formats with or without dashes
  - With dashes: `conversation-title-2024-01-15.md`
  - Without dashes: `conversation-title-20240115.md`

### Advanced Options

- **Skip Missing Attachments**: Continue import even if some attachments are missing
- **Debug Logging**: Enable detailed logging for troubleshooting

## 💡 Best Practices

### Recommended Settings

- ✅ **Use Reading View** for optimal visual experience with callouts
- ✅ **Exclude attachments folder** from cloud sync to save bandwidth
- ✅ **Enable date suffix** to avoid filename conflicts
- ✅ **Keep debug logging off** unless troubleshooting

### Workflow Tips

- **Selective import**: Use the conversation selection dialog to import only what you need
- **Multi-file processing**: Select multiple ZIP files to process them all at once
- **Regular exports**: Export your conversations periodically to keep your vault up to date
- **Check reports**: Review import reports to verify everything imported correctly

## 📁 File Organization

### Folder Structure

```
Nexus AI Chat Imports/
├── Conversations/
│   ├── chatgpt/
│   │   ├── 2024/
│   │   │   ├── 01/
│   │   │   │   ├── conversation-title-20240115.md
│   │   │   │   └── another-chat-20240120.md
│   │   │   └── 02/
│   │   └── 2023/
│   └── claude/
│       ├── 2024/
│       │   └── 01/
│       │       └── claude-conversation-20240115.md
│       └── 2023/
├── Attachments/
│   ├── chatgpt/
│   │   ├── images/
│   │   │   ├── dalle-image-1.png
│   │   │   └── uploaded-photo.jpg
│   │   └── documents/
│   │       └── document.pdf
│   └── claude/
│       ├── artifacts/
│       │   └── conversation-id/
│       │       ├── script_v1.py
│       │       ├── script_v2.py
│       │       └── script_v3.py
│       └── attachments/
└── Reports/
    ├── chatgpt/
    │   └── import-20240115-143022.md
    └── claude/
        └── import-20240115-150000.md
```

### Conversation Files

Each conversation is saved as a Markdown file with:
- **Frontmatter**: Metadata (ID, provider, dates, aliases)
- **Header**: Title with link to original web conversation
- **Messages**: Formatted with custom callouts (user, assistant, attachments, artifacts)
- **Timestamps**: ISO 8601 format for international compatibility

### Import Reports

Reports include:
- Summary statistics (total analyzed, imported, skipped)
- Per-file breakdown with detailed metrics
- Attachment statistics (found, missing, failed)
- Processing time and performance data
- Links to imported conversations

## 🎨 Visual Features

### Custom Callouts

The plugin uses Obsidian's callout system for beautiful formatting:

- 👤 **User messages**: Blue callouts with user icon
- 🤖 **Assistant messages**: Green callouts with bot icon
- 📎 **Attachments**: Amber callouts with paperclip icon
- ✨ **Artifacts** (Claude): Purple callouts with sparkles icon
- 🪄 **DALL-E Prompts**: Red callouts with magic wand icon

### Reading View vs. Edit Mode

- **Reading View**: Full visual experience with colored callouts
- **Edit Mode**: Raw Markdown with callout syntax visible

**Recommendation**: Use Reading View for browsing conversations, Edit Mode for editing.

## 🔄 Selective Import

### How It Works

1. **Analysis Phase**: Plugin scans all ZIP files and extracts conversation metadata
2. **Selection Dialog**: Interactive table shows all available conversations with:
   - Title, date, message count
   - Status: 🆕 New, 🔄 Update, ✅ Already imported
   - Attachment information
   - Source file
3. **Deduplication**: Automatically detects duplicates across multiple files
4. **Import Phase**: Only selected conversations are processed

### Selection Features

- **Sort by**: Date, title, messages, or status
- **Filter by status**: Show only new, updates, or all conversations
- **Batch operations**: Select all, deselect all, or toggle individual items
- **Preview**: See conversation details before importing

## 📎 Attachment Handling

### What Gets Imported

The plugin automatically extracts and imports attachments from your conversation exports:

**ChatGPT Attachments**:
- 📷 **Images**: User-uploaded photos, screenshots
- 🎨 **DALL-E Images**: AI-generated images with their prompts
- 📄 **Documents**: PDFs, text files, code files
- 🔗 **Links**: Embedded as Obsidian links to the actual files

**Claude Attachments**:
- 📷 **Images**: User-uploaded images
- 📄 **Documents**: Uploaded files
- ✨ **Artifacts**: Code, documents, and other AI-generated content saved as separate versioned files

### DALL-E Special Handling

DALL-E images receive special treatment:

1. **Prompt Preservation**: The original prompt is saved in a dedicated callout
2. **Nested Structure**: Prompts and images are organized in nested callouts for clarity
3. **Timestamp Accuracy**: Uses the prompt timestamp for proper chronological ordering
4. **Format Support**: Handles both text-based and code-based prompt formats

**Example in your note**:
```markdown
> [!nexus_assistant]
> Here's your image:
>
> > [!nexus_prompt]
> > **DALL-E Prompt**
> >
> > A serene mountain landscape at sunset...
>
> ![Generated Image](Attachments/chatgpt/images/dalle-abc123.png)
```

### Claude Artifact Versioning

Claude artifacts are saved as separate files with version tracking:

- **Location**: `Attachments/claude/artifacts/{conversation_id}/`
- **Naming**: `artifact-name_v1.py`, `artifact-name_v2.py`, etc.
- **Versioning**: Each modification creates a new version
- **Linking**: Conversations link to specific artifact versions

**Version Types**:
- `create` → New artifact with full content (v1)
- `rewrite` → Complete replacement (new version)
- `update` → Incremental changes (new version with accumulated changes)

### Attachment Status

In your conversation notes, attachments show their status:

- ✅ **Found**: File successfully imported
- ⚠️ **Missing**: Referenced but not in ZIP export
- ❌ **Failed**: Import error occurred

### Storage Locations

```
Attachments/
├── chatgpt/
│   ├── images/
│   │   ├── dalle-abc123.png
│   │   └── photo-xyz789.jpg
│   └── documents/
│       └── report.pdf
└── claude/
    ├── artifacts/
    │   └── conversation-id/
    │       ├── script_v1.py
    │       ├── script_v2.py
    │       └── document_v1.md
    └── attachments/
        └── uploaded-file.pdf
```

### Missing Attachments

Some attachments may be missing from exports:

- **Older exports**: May not include all referenced files
- **Large files**: Sometimes excluded from ZIP
- **External links**: Not downloadable

**Settings**:
- Enable "Skip Missing Attachments" to continue import despite missing files
- Check import reports for detailed attachment statistics

## 📊 Import Reports

### What's in a Report

After each import, a detailed report is generated with:

**Summary Section**:
- Total conversations analyzed
- Total conversations imported
- Processing time
- Overall success rate

**Files Analyzed Table**:
```markdown
| File | Date | Conversations | Imported | Status |
|------|------|---------------|----------|--------|
| export-2024-01.zip | 2024-01-15 | 150 | 75 (50%) | ✅ |
| export-2024-02.zip | 2024-02-20 | 100 | 50 (50%) | ✅ |
```

**Per-File Statistics**:
For each ZIP file processed:
- Conversations analyzed vs. imported
- Status breakdown (🆕 new, 🔄 updates, ✅ existing)
- Attachment statistics (found/missing/failed)
- Processing details

**Attachment Details**:
- Total attachments found
- Missing attachments (with reasons)
- Failed imports (with error messages)
- DALL-E images with prompts

### Report Location

Reports are saved in:
```
Reports/
├── chatgpt/
│   └── import-20240115-143022.md
└── claude/
    └── import-20240115-150000.md
```

**Filename Format**: `import-YYYYMMDD-HHMMSS.md`

### Understanding Report Statistics

**When importing multiple files**:
- Each file is analyzed separately
- Duplicates across files are detected
- Only unique conversations are imported
- Report shows both analyzed and imported counts

**Example**:
```
File 1: 100 conversations analyzed, 50 imported (50 were duplicates)
File 2: 100 conversations analyzed, 30 imported (70 were duplicates or already existed)
Total: 200 analyzed, 80 imported
```

### Selective Import Reports

When using selective import:
- Report shows which conversations you selected
- Unselected conversations are marked as "skipped by user"
- Statistics reflect your selection choices

## 🔄 Reimporting & Updates

### Safe Reimporting

You can safely reimport the same ZIP file multiple times:
- ✅ **New conversations** are added
- ✅ **Updated conversations** are refreshed
- ✅ **Unchanged conversations** are skipped
- ✅ **No duplicates** are created

### When to Reimport

- **New conversations**: You've had more chats since your last export
- **Plugin updates**: New version adds features to conversation formatting
- **Fix issues**: Resolve any import problems from previous attempts
- **Attachment recovery**: Retry failed attachment downloads

### What Gets Updated

- Conversation content and messages
- Attachments and artifacts
- Frontmatter metadata
- Formatting and callouts

### What's Preserved

- Your manual edits to conversations (if you've made any)
- Existing attachments and artifacts
- Folder organization

## ⚠️ Important Notes

### Provider-Specific Limitations

**Claude Projects**:
- Claude exports don't currently include project association data
- This limitation has been reported to Anthropic
- All conversations are imported individually regardless of project membership

**ChatGPT Attachments**:
- Only attachments included in the ZIP export can be imported
- Some older exports may not contain all referenced files
- DALL-E images are automatically detected and imported with their prompts

### Performance Considerations

**Large Archives**:
- Archives with 1000+ conversations may take several minutes to analyze
- Conversation selection dialog loads all conversations for preview
- Import progress is shown in real-time
- Obsidian may become temporarily unresponsive during indexing

**Multi-File Processing**:
- Processing multiple ZIP files adds deduplication overhead
- Each file is analyzed before the selection dialog appears
- Progress dialogs show current file and overall status

### Storage Considerations

**Vault Size**:
- Importing attachments significantly increases vault size
- DALL-E images can be several MB each
- Consider excluding the attachments folder from cloud sync

**Sync Performance**:
- Large attachment folders can slow down cloud sync
- Recommended: Add `Nexus AI Chat Imports/Attachments/` to your sync ignore list

## 🐛 Troubleshooting

### Import Issues

**Import Stuck or Slow**:
- Check the progress dialog for current status
- Large archives with many attachments take longer
- Wait for the process to complete (can take 5-10 minutes for large archives)
- If truly frozen, restart Obsidian and try again

**No Conversations Appear in Selection Dialog**:
- Verify you selected the correct provider (ChatGPT vs Claude)
- Check that the ZIP file is a valid export from the provider
- Try the other provider option if auto-detection failed
- Check the console (Ctrl+Shift+I) for error messages

**Missing Attachments**:
- Verify "Import Attachments" is enabled in settings
- Check that your export ZIP includes the attachments folder
- Some older exports may not contain all referenced files
- Enable "Skip Missing Attachments" to continue import despite missing files

### Formatting Issues

**Callouts Not Displaying Correctly**:
- Use **Reading View** for the best experience
- Ensure your Obsidian theme supports callouts
- Update to the latest version of Obsidian
- Try a different theme if issues persist

**Broken Links to Attachments**:
- Verify attachments were imported successfully
- Check the import report for attachment statistics
- Ensure attachment folder path hasn't changed
- Try reimporting with attachments enabled

### Settings & Migration Issues

**Settings Not Saving**:
- Check that you have write permissions to your vault
- Restart Obsidian after changing settings
- Verify the plugin is enabled

**Folder Migration Problems**:
- Don't manually move folders while the plugin is running
- Use the plugin's folder migration feature when changing paths
- Backup your vault before major folder reorganizations

### Getting Help

If you encounter issues:

1. **Enable debug logging** in settings
2. **Reproduce the issue**
3. **Check the console** (Ctrl/Cmd+Shift+I) for errors
4. **Report the issue** on [GitHub Issues](https://github.com/Superkikim/nexus-ai-chat-importer/issues) with:
   - Plugin version
   - Obsidian version
   - Provider (ChatGPT/Claude)
   - Error messages from console
   - Steps to reproduce

## 📝 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Credits

- **Developer**: [Superkikim](https://github.com/Superkikim)
- **Contributors**: See [GitHub Contributors](https://github.com/Superkikim/nexus-ai-chat-importer/graphs/contributors)
- **Special Thanks**: To all users who report issues and suggest improvements

## 🔗 Links

- **GitHub Repository**: [nexus-ai-chat-importer](https://github.com/Superkikim/nexus-ai-chat-importer)
- **Report Issues**: [GitHub Issues](https://github.com/Superkikim/nexus-ai-chat-importer/issues)
- **Release Notes**: [Version History](https://github.com/Superkikim/nexus-ai-chat-importer/releases)
- **Support Development**: [Ko-fi](https://ko-fi.com/nexusplugins)
