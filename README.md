# Nexus AI Chat Importer

[![Version](https://img.shields.io/badge/version-1.3.0-blue)](https://github.com/Superkikim/nexus-ai-chat-importer/releases/tag/1.3.0) [![Obsidian](https://img.shields.io/badge/Obsidian-0.15.0+-purple?logo=obsidian)](https://obsidian.md/) [![GitHub release (latest by date)](https://img.shields.io/github/v/release/superkikim/nexus-ai-chat-importer)](https://github.com/Superkikim/nexus-ai-chat-importer/releases/latest) [![Downloads (v1.3.0)](https://img.shields.io/github/downloads/superkikim/nexus-ai-chat-importer/1.3.0/total?label=downloads%20(v1.3.0))](https://github.com/Superkikim/nexus-ai-chat-importer/releases/tag/1.3.0) [![License](https://img.shields.io/badge/license-GPL--3.0-green)](LICENSE.md)

## 📑 Table of Contents

### 🚀 Getting Started
- [⚡ Quickstart](#-quickstart) - Get up and running in 2 minutes
- [📥 Installation](#-installation--settings) - Install from Community Plugins
- [📤 Export Your Chats](#-importing-conversations) - Get your data from ChatGPT/Claude

### 💡 Using the Plugin
- [📥 Import Conversations](#-importing-conversations) - Quick or selective import
- [📊 Import Reports](#-understanding-import-reports) - Understand what was imported
- [📁 File Organization](#-data-organization) - Where your files are stored
- [🎨 Conversation Format](#-conversation-format) - How conversations look

### 🔧 Advanced
- [📎 Attachments](#-complete-attachment-handling) - Images, DALL-E, artifacts
- [🤖 Provider Differences](#-provider-specific-features--limitations) - ChatGPT, Claude, Le Chat specifics
- [⚙️ Settings](#plugin-settings) - Customize folders and formatting
- [🔧 Troubleshooting](#-troubleshooting) - Common issues and solutions

### 📚 More
- [✨ What's New](#-new-in-v130) - v1.3.0 features
- [☕ Support](#-support-my-work) - Help keep this plugin alive
- [📜 License](#-license) - GPL-3.0

---

## ⚡ Quickstart

**Get started in 2 minutes:**

1. **Install** the plugin from Obsidian Community Plugins (search "Nexus AI Chat Importer")
2. **Export** your chats:
   - **ChatGPT**: Settings → Data controls → Export data → Download ZIP
   - **Claude**: Settings → Export data → Download ZIP
   - **Le Chat**: Click your name → Profile → Export your personal data → Le Chat → Download
3. **Import**: Click the <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><line x1="9" x2="15" y1="10" y2="10"/><line x1="12" x2="12" y1="7" y2="13"/></svg> ribbon icon (chat +) in the left sidebar or use command palette → "Import AI conversations"
4. **Select** your ZIP file(s) → Choose import mode (all or selective)
5. **Done!** Your conversations are now in `Nexus/Conversations/`

💡 **First time?** The plugin will show you a welcome dialog with helpful links!

---

## Overview

Import your AI chat conversations from **ChatGPT**, **Claude**, and **Le Chat** exports into Obsidian as beautifully formatted Markdown files.

### ✨ New in v1.4.0

- **🤖 Le Chat Support** - Full integration for Mistral AI's Le Chat conversations
- **📎 Smart Attachment Handling** - Unique filenames prevent collisions across imports
- **⏱️ Millisecond Precision** - Accurate chronological sorting even for rapid-fire messages
- **🔍 Enhanced Detection** - Automatic provider detection for Le Chat exports

### ✨ New in v1.3.0

- **[Selective Import](#-importing-conversations)** - Choose exactly which conversations to import with interactive preview
- **[Separate Reports Folder](#-folder-organization-new-in-v130)** - Better organization, easier to exclude from sync
- **[International Date Support](#-date--time-formats)** - ISO 8601 timestamps work in all languages
- **[Visual Folder Browser](#first-time-setup)** - Tree-based navigation, create folders on the fly
- **[Enhanced Attachments](#-complete-attachment-handling)** - DALL-E images with prompts, better formatting

### 🎨 Improvements in v1.3.0

- Redesigned Settings page - easier to find what you need
- Faster imports - especially for large collections
- Better progress messages - know exactly what's happening
- More detailed reports - see exactly what was imported
- Clearer dialogs - less confusing text

### 🐛 Fixed in v1.3.0

- Fixed timestamp parsing for non-US locales
- Fixed folder deletion after migration
- Fixed link updates in Claude artifacts
- Fixed duplicate conversations in multi-ZIP imports
- Fixed special characters in conversation titles
- And many more...

## ☕ Support My Work

I'm working on Nexus projects full-time while unemployed and dealing with health issues.

**Over 4,300 downloads so far, yet I've received only $20 in donations in the last two months while paying about $200/month out of pocket in expenses.**

**If this plugin makes your life easier, a donation would mean the world to me and help keep them alive.**

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

> **Reality check**: Over 4,300 downloads, but only $20 in donations over two months. If you use this plugin regularly, please consider contributing. Even $5 makes a real difference! 🙏

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

### 📸 See It In Action

<!-- TODO: Add screenshots here
Suggested screenshots:
1. Conversation selection dialog showing preview
2. Example of imported conversation with formatting
3. Import completion dialog with statistics
-->

> 💡 **Tip**: Screenshots coming soon! For now, try the plugin yourself - it's free and takes 2 minutes to set up.

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

### First-Time Setup

After installing the plugin:

1. **Open Settings** → **Community Plugins** → **Nexus AI Chat Importer**
2. **Configure your folders** (or keep the defaults):
   - **Conversations**: Where your chat notes will be saved
   - **Attachments**: Where images and files will be stored
   - **Reports**: Where import summaries will be created
3. **Configure filename options**:
   - **Add Date Prefix**: Enable to add dates to conversation filenames (e.g., `2024-01-15 - My Chat.md`)
   - **Date Format**: Choose between `YYYY-MM-DD` (2024-01-15) or `YYYYMMDD` (20240115)
4. **Chose message date format**:
   - **Custom date format** If Obsidian Locale is not providing the format you want (i.e. english provides US format MM/DD/YYYY), select the format you prefer. The plugin will apply it to messages in conversations while importing

### Upgrading from Previous Versions

**Good news:** The plugin handles everything automatically!

When you upgrade to v1.3.0:
- ✅ Your settings are migrated to the new format
- ✅ Your existing conversations are updated with new features
- ✅ Folders are reorganized if needed (with your permission)
- ✅ A detailed upgrade report shows you what changed

**No manual work required** - just install and go!

### Plugin Settings

#### **📁 Folder Organization** (NEW in v1.3.0)

Choose where your files are stored:

- **Conversations Folder**: Your chat notes (default: `Nexus/Conversations`)
- **Attachments Folder**: Images, files, and Claude artifacts (default: `Nexus/Attachments`)
- **Reports Folder**: Import summaries (default: `Nexus/Reports`)

**💡 Tip:** You can organize these folders however you like! Put them all together, or spread them across your vault.

#### **🎨 Display Options**

Customize how your conversations look:

- **Date Prefix**: Add dates to filenames
  - ✅ Enabled: `2024-01-15 - My Conversation.md`
  - ❌ Disabled: `My Conversation.md`

- **Date Format**: Choose your style
  - With dashes: `2024-01-15`
  - Without: `20240115`

- **Message Timestamps** (NEW in v1.3.0): Choose how dates appear in messages
  - **Auto** (default): Matches your Obsidian language
  - **Custom**: Pick from ISO 8601, US, European, UK, German, or Japanese

#### **🔄 Moving Your Files**

Want to reorganize? No problem!

1. **Change a folder path** in settings
2. **Click Save**
3. **Choose what to do**:
   - ✅ **Move files**: Everything moves automatically, links stay working
   - ❌ **Leave files**: They stay put (but won't be managed by the plugin anymore)

> **💡 Pro tip:** The plugin is smart - it merges folders instead of overwriting, so your existing files are safe!

## 📤 Importing Conversations

### Step 1: Get Your Export

**ChatGPT**:
1. Open ChatGPT → **Settings** → **Data Controls** → **Export data**
2. Check your email (arrives in a few minutes)
3. Download the ZIP file

**Claude**:
1. Open Claude → **Settings** → **Privacy** → **Export data**
2. Check your email (arrives in a few minutes)
3. Download the ZIP file

**Le Chat**:
1. Click your name → **Profile** → **Export your personal data** → **Le Chat**
2. Wait for the button to change from "Export" to "Download"
3. Click **Download** to get the ZIP file

### Step 2: Import to Obsidian

**Two ways to start:**
- Click the <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><line x1="9" x2="15" y1="10" y2="10"/><line x1="12" x2="12" y1="7" y2="13"/></svg> ribbon icon (chat +) in the left sidebar, OR
- Press **Ctrl/Cmd+P** → type "**Import AI conversations**"

### Step 3: Choose Your Import Style

#### 🚀 **Quick Import** (Import Everything)

Perfect when you want everything imported fast:

1. Select **ChatGPT** or **Claude**
2. Choose your ZIP file(s)
3. Click **Import All**
4. Done! ✨

#### 🎯 **Selective Import** (Pick & Choose) - NEW in v1.3.0

Perfect when you want control:

1. Select **ChatGPT** or **Claude**
2. Choose your ZIP file(s)
3. Click **Select Conversations**
4. **Review the list** - you'll see:
   - 📝 Conversation title and date
   - 💬 Number of messages
   - 🆕 **New** / 🔄 **Updated** / ✅ **Already imported**
   - 📎 Attachments info
5. **Filter conversations** (optional):
   - 🔍 **Search by keyword** - Type in the search box to filter by title
   - 📊 **Filter by status** - Show only New, Updated, or Already imported
   - 📅 **Sort** - By date, title, or status
6. **Select conversations**:
   - ✅ Check individual conversations
   - ✅ Use "Select All" / "Deselect All" buttons
   - ✅ Use "Select New Only" to import only new conversations
7. Click **Import Selected**

**Cool features:**
- ✅ **Keyword search** - Find conversations by title instantly
- ✅ **Smart filtering** - Show only what you need
- ✅ **Multi-ZIP support** - Process multiple exports at once
- ✅ **Duplicate detection** - Automatically finds duplicates across ZIPs
- ✅ **Flexible sorting** - Organize by date, title, or status

### Step 4: Check Your Report

After every import, you get a beautiful summary report:

**What's in it:**
- ✅ How many conversations were imported
- ⏱️ How long it took
- 📊 Success rate
- 📎 Attachment statistics
- 🔗 Clickable links to your new conversations

**Where to find it:** `<reports>/<provider>/import-YYYYMMDD-HHMMSS.md`

**💡 Tip:** The report opens automatically when import finishes!

## 📁 Data Organization

### Notes

#### Location

Conversations are organized by provider, year, and month:

```
<conversations>/
├── <provider>/
│   └── YYYY/
│       └── MM/
│           └── YYYY-MM-DD - conversation-title.md
```

**Example** (with date prefix enabled):
```
<conversations>/chatgpt/2024/01/2024-01-15 - my-conversation.md
<conversations>/claude/2024/02/2024-02-20 - another-chat.md
```

**Example** (without date prefix):
```
<conversations>/chatgpt/2024/01/my-conversation.md
<conversations>/claude/2024/02/another-chat.md
```

#### Structure

Each conversation note contains:

**1. Frontmatter** - Rich metadata for Obsidian features:
```yaml
---
conversation_id: "abc123..."          # Unique identifier
provider: "chatgpt"                   # chatgpt or claude
title: "Conversation Title"           # Original title
create_time: "2024-01-15T14:30:22Z"  # Creation timestamp (UTC, ISO 8601)
update_time: "2024-01-15T16:45:10Z"  # Last update timestamp (UTC, ISO 8601)
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

#### Date & Time Formats

The plugin uses **two different date formats** depending on where they appear:

**1. Metadata (Top of File) - Universal Format**

The dates at the top of each note use **ISO 8601** format (`2024-01-15T14:30:22.000Z`):

✅ **Works everywhere** - No matter what language you use
✅ **Sorts correctly** - Alphabetical order = chronological order
✅ **No confusion** - Never mix up month and day
✅ **Works with Dataview** - Perfect for queries and tables
✅ **Same timezone** - Always UTC (no timezone confusion)

**2. Message Timestamps (In Conversation) - Your Choice**

The timestamps shown in each message can be customized:

- **Auto (Default)**: Matches your Obsidian language
  - English → `01/15/2024 2:30:22 PM`
  - French → `15/01/2024 14:30:22`
  - German → `15.01.2024 14:30:22`

- **Custom (NEW in v1.3.0)**: Pick your favorite format in Settings
  - **Universal**: `2024-01-15 14:30:22` (same everywhere, easy to sort)
  - **US**: `01/15/2024 2:30:22 PM`
  - **European**: `15/01/2024 14:30:22`
  - **German**: `15.01.2024 14:30:22`
  - **Japanese**: `2024/01/15 14:30:22`

> **⚠️ Important**: Changing this setting only affects **new imports**. Your existing notes won't change (to protect your data).

**Example of Universal Format**: `2024-01-15T14:30:22.000Z`
- **Date**: January 15, 2024
- **Time**: 2:30:22 PM (in UTC timezone)
- **Why UTC?** So the same timestamp works everywhere in the world

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

## 🤖 Provider-Specific Features & Limitations

Each AI provider has unique characteristics in how they export conversations. Here's what you need to know:

### ChatGPT (OpenAI)

**✅ Fully Supported**:
- Conversation titles (exported in JSON)
- User-uploaded attachments (images, documents)
- DALL-E generated images with prompts
- Complete message history
- Custom instructions and model information

**Export Format**: Single `conversations.json` file with all conversations + attachments in ZIP

### Claude (Anthropic)

**✅ Fully Supported**:
- Conversation titles (exported in JSON)
- User-uploaded attachments (images, documents)
- Artifacts (code, documents, generated content) with versioning
- Complete message history
- Web search results (filtered out as not useful)

**Export Format**: Single `conversations.json` file with all conversations + attachments in ZIP

### Le Chat (Mistral AI)

**✅ Supported**:
- User-uploaded attachments (images, documents)
- Complete message history
- References and citations
- Custom elements

**⚠️ Limitations**:
- **No conversation titles**: Le Chat exports don't include conversation titles. The plugin automatically generates titles from the first user message (truncated to 50 characters)
- **No generated images**: Images created by Le Chat's image generation tool are **not included in exports**. Only external URLs are provided, which may expire. The plugin will show the generation prompt but cannot download the images
- **Tool calls filtered**: Internal tool calls (web_search, etc.) are filtered out as they're not useful for users

**Export Format**: Individual `chat-{uuid}.json` files (one per conversation) + attachments in `chat-{uuid}-files/` directories

**💡 Tip for Le Chat Users**:
- If you want to preserve generated images, download them manually before exporting
- Consider adding custom titles to your conversations by editing the imported notes' frontmatter

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

**"Invalid file format" error**:
- Only ZIP files are supported (must have `.zip` extension)
- **Known Issue (Claude + Firefox on Mac)**: The downloaded file may have a `.dat` extension instead of `.zip`
  - **Solution**: Simply rename the file to change `.dat` to `.zip` (do NOT extract and re-compress!)
  - This is a browser/server issue that has been reported to Anthropic
- If you manually compressed a folder, make sure it's a valid ZIP format

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
- **Other Providers**: Support for additional AI providers (Gemini, Perplexity, etc.)

**🌍 Localization**:
- **Multi-language UI**: Plugin interface translated into multiple languages
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

## 🔗 Resources

<div align="center">

### 📖 Documentation & Help

[![README](https://img.shields.io/badge/📖_Documentation-README-blue?style=for-the-badge)](https://github.com/Superkikim/nexus-ai-chat-importer/blob/master/README.md)
[![Release Notes](https://img.shields.io/badge/📝_Release_Notes-Changelog-green?style=for-the-badge)](https://github.com/Superkikim/nexus-ai-chat-importer/blob/master/RELEASE_NOTES.md)
[![Troubleshooting](https://img.shields.io/badge/🔧_Troubleshooting-Guide-orange?style=for-the-badge)](https://github.com/Superkikim/nexus-ai-chat-importer#-troubleshooting)

### 💬 Community & Support

[![Report Issues](https://img.shields.io/badge/🐛_Report_Issues-GitHub-red?style=for-the-badge)](https://github.com/Superkikim/nexus-ai-chat-importer/issues)
[![Obsidian Forum](https://img.shields.io/badge/💬_Community-Obsidian_Forum-purple?style=for-the-badge)](https://forum.obsidian.md/)
[![Ko-fi](https://img.shields.io/badge/☕_Support-Ko--fi-ff5e5b?style=for-the-badge&logo=ko-fi&logoColor=white)](https://ko-fi.com/nexusplugins)

### 📦 Repository

[![GitHub](https://img.shields.io/badge/GitHub-Repository-181717?style=for-the-badge&logo=github)](https://github.com/Superkikim/nexus-ai-chat-importer)
[![Releases](https://img.shields.io/badge/Releases-Download-blue?style=for-the-badge)](https://github.com/Superkikim/nexus-ai-chat-importer/releases)
[![Contributors](https://img.shields.io/badge/Contributors-View-green?style=for-the-badge)](https://github.com/Superkikim/nexus-ai-chat-importer/graphs/contributors)

</div>
