# Nexus AI Chat Importer

[![Version](https://img.shields.io/badge/version-1.3.0-blue)](https://github.com/Superkikim/nexus-ai-chat-importer/releases/tag/1.3.0) [![GitHub release (latest by date)](https://img.shields.io/github/v/release/superkikim/nexus-ai-chat-importer)](https://github.com/Superkikim/nexus-ai-chat-importer/releases/latest) [![GitHub all releases](https://img.shields.io/github/downloads/superkikim/nexus-ai-chat-importer/total)](https://github.com/Superkikim/nexus-ai-chat-importer/releases)

## Table of Contents

- [Overview](#overview)
- [☕ Support My Work](#-support-my-work)
- [✨ Key Features](#-key-features)
- [📥 Installation & Settings](#-installation--settings)
- [📤 Importing Conversations](#-importing-conversations)
- [📁 Data Organization](#-data-organization)
- [🔄 Reimporting & Updates](#-reimporting--updates)
- [⚠️ Important Notes](#️-important-notes)
- [🐛 Troubleshooting](#-troubleshooting)
- [🚀 Future Plans](#-future-plans)
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

## 📥 Installation & Settings

### Installation Methods

**From Obsidian Community Plugins** (Recommended):
1. Open **Settings** → **Community Plugins**
2. Click **Browse** and search for "**Nexus AI Chat Importer**"
3. Click **Install**, then **Enable**

**Manual Installation**:
1. Download the latest release from [GitHub Releases](https://github.com/Superkikim/nexus-ai-chat-importer/releases)
2. Extract files to `.obsidian/plugins/nexus-ai-chat-importer/`
3. Reload Obsidian and enable the plugin

### Automatic Migration

When you upgrade to a new version, the plugin automatically:
- Migrates your settings to the new format
- Updates existing conversations with new features
- Reorganizes folders if needed
- Shows you what changed in a beautiful upgrade dialog

No manual intervention required!

### Plugin Settings

The plugin has only **5 simple settings**:

**Folder Paths** (3 settings):
- **Conversations Folder**: `<conversations>/` - Where conversation notes are stored
- **Attachments Folder**: `<attachments>/` - Where images, files, and artifacts are saved
- **Reports Folder**: `<reports>/` - Where import reports are generated

**Filename Options** (2 settings):
- **Enable Date Prefix**: Add date before the title (e.g., `2024-01-15 - conversation-title.md`)
- **Date Format**: With dashes (`2024-01-15`) or without (`20240115`)

### Changing Folder Paths

You can change folder paths **at any time**. When you do:

1. The plugin will **offer to migrate** existing files to the new location
2. If you **accept migration**: All files move automatically, links update
3. If you **decline migration**: Old files stay in place but won't be managed by the plugin anymore

> **⚠️ Important**: If you don't migrate, the plugin won't update or manage conversations in the old location.

## 📤 Importing Conversations

### Getting Your Exports

**ChatGPT**:
1. Go to **Settings** → **Data Controls** → **Export data**
2. Wait for the email with your download link (usually within minutes)
3. Download the ZIP file

**Claude**:
1. Go to **Settings** → **Privacy** → **Export data**
2. Wait for the email with your download link (usually within minutes)
3. Download the ZIP file

### Import Process

**Starting an Import**:
- Click the **chat+** icon in the ribbon, OR
- Use command palette: **Ctrl/Cmd+P** → "**Nexus: Select zip file to process**"

**Choose Import Mode**:

#### All Conversations (Quick Import)
- Select provider (ChatGPT or Claude)
- Choose ZIP file(s)
- Click **Import All**
- All new and updated conversations are imported automatically

#### Selective Import (Recommended)
- Select provider (ChatGPT or Claude)
- Choose ZIP file(s)
- **Review conversation list** with:
  - Title, date, message count
  - Status: 🆕 New, 🔄 Update, ✅ Already imported
  - Attachment information
  - Source file
- **Select** which conversations to import
- Click **Import Selected**

**Features**:
- ✅ **Multi-file support**: Process multiple ZIP files at once
- ✅ **Smart deduplication**: Automatically detects duplicates across files
- ✅ **Sorting & filtering**: Sort by date, title, messages, or status
- ✅ **Batch operations**: Select all, deselect all, or cherry-pick

### Import Reports

After each import, a detailed report is generated:

**Summary**:
- Total conversations analyzed vs. imported
- Processing time and success rate
- Overall statistics

**Per-File Breakdown**:
- Which conversations were imported from each ZIP
- Status breakdown (new, updates, existing)
- Attachment statistics (found, missing, failed)

**Report Location**: `<reports>/<provider>/import-YYYYMMDD-HHMMSS.md`

Reports include clickable links to imported conversations for easy access.

## 📁 Data Organization

### Notes

#### Location

Conversations are organized by provider, year, and month:

```
<conversations>/
├── <provider>/
│   └── YYYY/
│       └── MM/
│           └── conversation-title-YYYYMMDD.md
```

**Example**:
```
<conversations>/chatgpt/2024/01/my-conversation-20240115.md
<conversations>/claude/2024/02/another-chat-20240220.md
```

#### Structure

Each conversation note contains:

**1. Frontmatter** - Rich metadata for Obsidian features:
```yaml
---
conversation_id: "abc123..."          # Unique identifier
provider: "chatgpt"                   # chatgpt or claude
title: "Conversation Title"           # Original title
create_time: "2024-01-15T14:30:22Z"  # Creation timestamp
update_time: "2024-01-15T16:45:10Z"  # Last update timestamp
message_count: 42                     # Total messages
aliases: ["Conversation Title"]       # For linking
---
```

This metadata enables powerful Obsidian features:
- 🔍 **Search & filter** by any field
- 📊 **Dataview queries** for custom dashboards
- 📈 **Track statistics** across conversations
- 🔗 **Link** using aliases

**2. Header** - Title with link to original conversation:
```markdown
# Conversation Title
[View original conversation](https://chatgpt.com/c/abc123...)
```

> **Note**: If you deleted the conversation online, the link will be dead.

**3. Messages** - Formatted with custom callouts:

```markdown
> [!nexus_user]
> **User** - 2024-01-15 14:30:22
>
> Your message here...

> [!nexus_assistant]
> **Assistant** - 2024-01-15 14:31:05
>
> AI response here...
```

**Callout Types**:
- 👤 **nexus_user**: Blue callouts for user messages
- 🤖 **nexus_assistant**: Green callouts for AI responses
- 📎 **nexus_attachment**: Amber callouts for attachments
- ✨ **nexus_artifact**: Purple callouts for Claude artifacts
- 🪄 **nexus_prompt**: Red callouts for DALL-E prompts

**Viewing Modes**:
- **Reading View**: Full visual experience with colored callouts
- **Live Preview**: Rendered callouts while editing
- **Source Mode**: Raw Markdown syntax

#### Date Format - Why ISO 8601?

All timestamps use **ISO 8601** format (`YYYY-MM-DDTHH:MM:SSZ`):

✅ **Universal** - Works with all locales
✅ **Sortable** - Alphabetical = chronological
✅ **Unambiguous** - No MM/DD vs DD/MM confusion
✅ **Standard** - Recognized everywhere
✅ **Dataview-friendly** - Perfect for queries
✅ **Future-proof** - Won't change

**Example**: `2024-01-15T14:30:22Z` = January 15, 2024 at 14:30:22 UTC (same everywhere)

#### Recommendations

**✅ DO**:
- Add your own frontmatter fields (v1.3.0+) - the plugin won't touch them
- Edit message content as needed
- Use Reading View for best experience

**❌ DON'T**:
- Modify plugin-generated frontmatter fields (conversation_id, provider, etc.)
- Delete message IDs (hidden in Reading View)
- Remove messages - they'll be restored on reimport

> **Why?** The plugin uses conversation_id and message IDs to detect updates and avoid duplicates. Modifying them breaks this functionality.

### Attachments

#### Location

Attachments are organized by provider:

```
<attachments>/
└── <provider>/
    ├── images/
    ├── documents/
    └── artifacts/  (Claude only)
```

**Example**:
```
<attachments>/chatgpt/images/dalle-abc123.png
<attachments>/claude/artifacts/conv-id/script_v1.py
```

#### What Gets Imported

**Images**:
- User-uploaded photos and screenshots
- AI-generated images (DALL-E with prompts)
- Embedded directly in conversation notes

**Documents**:
- PDFs, text files, code files
- Linked in conversation notes

**Claude Artifacts**:
- Code, documents, and AI-generated content
- Saved as separate versioned files
- Each modification creates a new version (v1, v2, v3...)

#### Missing Attachments

Some attachments may be missing from exports:
- **Older exports**: May not include all files
- **Large files**: Sometimes excluded from ZIP
- **External links**: Not downloadable

The plugin continues importing even with missing attachments. Check import reports for details.



## 🔄 Reimporting & Updates

You can safely reimport the same ZIP file multiple times. The plugin intelligently handles updates:

**What Happens**:
- ✅ **New conversations** → Added
- ✅ **Updated conversations** → Refreshed with new messages
- ✅ **Unchanged conversations** → Skipped
- ✅ **No duplicates** → Smart detection prevents duplicates

**When to Reimport**:
- You've had more conversations since last export
- Plugin update adds new features
- Fix issues from previous import
- Retry failed attachments

**What's Updated**:
- Messages and content
- Attachments and artifacts
- Frontmatter metadata
- Formatting

**What's Preserved**:
- Your manual edits (if frontmatter/message IDs intact)
- Existing attachments
- Folder structure

## ⚠️ Important Notes

**Projects**:
- Project organization is not currently supported
- All conversations are imported individually
- Future versions may add project support

**Performance**:
- Large archives (1000+ conversations) take several minutes to analyze
- Obsidian may become temporarily unresponsive during processing
- Progress dialogs show real-time status

**Storage**:
- Attachments can significantly increase vault size
- AI-generated images can be several MB each
- Consider excluding `<attachments>/` from cloud sync

## 🐛 Troubleshooting

**Import stuck or slow**:
- Large archives take 5-10 minutes
- Check progress dialog
- If frozen, restart Obsidian

**No conversations appear**:
- Verify correct provider selected
- Check ZIP file is valid export
- Review import report for errors

**Missing attachments**:
- Check import report for details
- Older exports may not include all files
- Reimport to retry failed attachments

**Callouts not displaying**:
- Use Reading View
- Update Obsidian to latest version
- Try different theme

**Need help?**
1. Check import report for errors
2. Verify settings are correct
3. Open issue on [GitHub](https://github.com/Superkikim/nexus-ai-chat-importer/issues) with:
   - Plugin & Obsidian versions
   - Provider (ChatGPT/Claude)
   - Problem description

## 🚀 Future Plans

We're constantly working to improve the plugin. Here's what's planned for future releases:

### Upcoming Features

**🤖 New Provider Support**:
- **Mistral Le Chat**: Full integration for Mistral AI conversations
- **Other Providers**: Support for any AI provider that offers easily exploitable conversation export files

**🌍 Localization**:
- **Multi-language UI**: Plugin interface translated into multiple languages
- **Date Format Options**: Choose your preferred date format (ISO 8601, US, European, etc.)
- **Locale-Aware Formatting**: Respect your system locale settings

**🎙️ Audio Support**:
- **Voice Conversations**: Optional import of audio files from ChatGPT voice conversations
- **Audio Embedding**: Link audio files directly in conversation notes
- **Transcript Integration**: Combine audio with text transcripts

### How You Can Help

- 💡 **Suggest Features**: Open an issue on GitHub with your ideas
- 🐛 **Report Bugs**: Help us improve by reporting issues
- ☕ **Support Development**: [Buy me a coffee](https://ko-fi.com/nexusplugins) to speed up development
- ⭐ **Star the Repo**: Show your support on GitHub

Your feedback and support directly influence what features get prioritized!

---

## 📝 License

**GNU General Public License v3.0 (GPL-3.0)**

This project is licensed under GPL-3.0 starting from version 1.3.0.

**What this means**:
- ✅ **Free to use** - The plugin is and will always be free
- ✅ **Open source** - Source code is publicly available
- ✅ **Can modify** - You can modify the code for personal use
- ✅ **Can redistribute** - You can share modified versions
- ⚠️ **Must share source** - Derivative works must also be GPL-3.0 and open source
- ⚠️ **No commercial use without GPL** - Commercial derivatives must also be GPL-3.0

**Why GPL-3.0?**

This license protects the open-source nature of this project while preventing commercial exploitation without giving back to the community. If you create a commercial product based on this code, it must also be open source under GPL-3.0.

See [LICENSE.md](LICENSE.md) for full details.

## 🙏 Credits

- **Developer**: [Superkikim](https://github.com/Superkikim)
- **Contributors**: See [GitHub Contributors](https://github.com/Superkikim/nexus-ai-chat-importer/graphs/contributors)
- **Special Thanks**: To all users who report issues and suggest improvements

## 🔗 Links

- **GitHub Repository**: [nexus-ai-chat-importer](https://github.com/Superkikim/nexus-ai-chat-importer)
- **Report Issues**: [GitHub Issues](https://github.com/Superkikim/nexus-ai-chat-importer/issues)
- **Release Notes**: [Version History](https://github.com/Superkikim/nexus-ai-chat-importer/releases)
- **Support Development**: [Ko-fi](https://ko-fi.com/nexusplugins)
