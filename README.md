# Nexus AI Chat Importer

[![Obsidian](https://img.shields.io/badge/Obsidian-0.15.0+-purple?logo=obsidian)](https://obsidian.md/) [![GitHub release (latest by date)](https://img.shields.io/github/v/release/superkikim/nexus-ai-chat-importer)](https://github.com/Superkikim/nexus-ai-chat-importer/releases/latest) [![Downloads](https://img.shields.io/badge/dynamic/json?url=https://raw.githubusercontent.com/Superkikim/nexus_stats/main/summary.json&query=%24.total_downloads&label=downloads&color=blue)](https://github.com/Superkikim/nexus-ai-chat-importer/releases) [![License](https://img.shields.io/badge/license-GPL--3.0-green)](LICENSE.md)

> 🌍 **Plugin UI and documentation now available in 10 languages**
>
> [![EN](https://img.shields.io/badge/docs-EN-0066CC)](https://nexus-prod.dev/nexus-ai-chat-importer/) [![DE](https://img.shields.io/badge/docs-DE-0066CC)](https://nexus-prod.dev/de/nexus-ai-chat-importer/) [![ES](https://img.shields.io/badge/docs-ES-0066CC)](https://nexus-prod.dev/es/nexus-ai-chat-importer/) [![FR](https://img.shields.io/badge/docs-FR-0066CC)](https://nexus-prod.dev/fr/nexus-ai-chat-importer/) [![IT](https://img.shields.io/badge/docs-IT-0066CC)](https://nexus-prod.dev/it/nexus-ai-chat-importer/) [![JA](https://img.shields.io/badge/docs-JA-0066CC)](https://nexus-prod.dev/ja/nexus-ai-chat-importer/) [![KO](https://img.shields.io/badge/docs-KO-0066CC)](https://nexus-prod.dev/ko/nexus-ai-chat-importer/) [![PT](https://img.shields.io/badge/docs-PT-0066CC)](https://nexus-prod.dev/pt/nexus-ai-chat-importer/) [![RU](https://img.shields.io/badge/docs-RU-0066CC)](https://nexus-prod.dev/ru/nexus-ai-chat-importer/) [![ZH](https://img.shields.io/badge/docs-ZH-0066CC)](https://nexus-prod.dev/zh/nexus-ai-chat-importer/)

> ✅ **v1.5.7** fixes key import reliability issues:
> provider auto-detection, safer mobile imports, cleaner unsupported ZIP handling,
> improved reports, and a fix for missing message updates in Claude imports.
> See [What’s New](#-whats-new) for details.


## 📑 Table of Contents

### 🚀 Getting Started
- [⚡ Quickstart](#-quickstart) - Get up and running in 2 minutes
- [📥 Installation](#-installation--settings) - Install from Community Plugins
- [📤 Export Your Chats](#-importing-conversations) - Get your data from ChatGPT/Claude/Le Chat

### 💡 Using the Plugin
- [📥 Import Conversations](#-importing-conversations) - Quick or selective import
- [📊 Import Reports](#-understanding-import-reports) - Understand what was imported
- [📁 File Organization](#-data-organization) - Where your files are stored
- [🎨 Conversation Format](#-conversation-format) - How conversations look

### 🔧 Advanced
- [📎 Attachments](#-complete-attachment-handling) - Images, DALL-E, artifacts
- [🤖 Provider Differences](#-provider-specific-features--limitations) - ChatGPT, Claude, Le Chat specifics
- [💻 CLI](#-command-line-interface-cli) - Import from command line
- [⚙️ Settings](#plugin-settings) - Customize folders and formatting
- [🔧 Troubleshooting](#-troubleshooting) - Common issues and solutions

### 📚 More
- [✨ What's New](#-whats-new) - Latest changes
- [☕ Support](#-support-my-work) - Help keep this plugin alive
- [📜 License](#-license) - GPL-3.0

---

## ⚡ Quickstart

**Get started in 2 minutes:**

1. **Install** the plugin from Obsidian Community Plugins (search "Nexus AI Chat Importer")
2. **Export** your chats:
   - **ChatGPT**: Settings → Data controls → Export data → Download ZIP
   - **Claude**: Settings → Privacy → Export data → Download ZIP
   - **Le Chat**: Click your name → Profile → Le Chat: Export → Download
3. **Import**: Click the <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><line x1="9" x2="15" y1="10" y2="10"/><line x1="12" x2="12" y1="7" y2="13"/></svg> ribbon icon (chat +) in the left sidebar or use command palette → "Import AI conversations"
4. **Select** your ZIP file(s) and import mode (all or selective)
5. **Provider is auto-detected** from the first supported archive in your selection
6. **Done!** Your conversations are now in `Nexus/Conversations/`

💡 **First time?** The plugin will show you a welcome dialog with helpful links!

---

## Overview

Import your AI chat conversations from **ChatGPT**, **Claude**, and **Le Chat** exports into Obsidian as beautifully formatted Markdown files.

### 🔍 Features in a Glance

- Multi-provider support (ChatGPT, Claude, Le Chat)
- Selective import with interactive preview
- Smart deduplication across multiple ZIPs
- Attachment handling — images, documents, DALL-E, artifacts (provider-dependent)
- Claude artifact versioning
- LaTeX math support
- CLI for automation and headless setups
- Beautiful formatting with role-specific callouts
- Detailed import reports
- Full UI localization in 10 languages

### ✨ What's New

#### v1.5.x — Highlights

✨ **New**
- Full UI localization in 10 languages — automatic, matches your Obsidian language setting
- Upgrade flow now surfaces current release notes directly inside the plugin

🔧 **Improved**
- Le Chat generated images now show a proper "not included in export" callout
- Missing attachment callouts simplified to a single clean line
- Support links and branding updated throughout
- Provider is auto-detected from the first supported selected archive
- Mixed-provider selections are handled cleanly (unsupported provider files are ignored)
- Mobile now runs imports in single-archive mode for better runtime stability
- Desktop and mobile now follow the same ZIP-reading model: scan first, then read only what is needed
- Import logs now identify the exact phase reached during ZIP scan, metadata extraction, attachment indexing, and streaming import
- Reports are now split into summary + heavy index + mobile index for better readability

🐛 **Bug Fixes**
- ChatGPT numbered exports (`conversations-XXX.json`) are recognised correctly
- ChatGPT user-uploaded image extraction restored for multi-ZIP imports
- Claude export format changes handled correctly
- Missing message updates in Claude imports are now handled correctly
- Unsupported ZIP files are classified earlier and skipped with clearer messaging
- Large archive handling no longer relies on loading the whole ZIP into memory
- CLI now uses the desktop ZIP backend reliably in Node.js and writes correct plugin version metadata

---

> Upgrading from a previous version triggers required migration tasks automatically.

*For full release history, see [RELEASE_NOTES.md](RELEASE_NOTES.md)*

## ☕ Support My Work

I'm working on Nexus projects full-time while unemployed and dealing with health issues.

**Over 6,500 downloads so far! Thank you to everyone who has supported this project.**

**If this plugin makes your life easier, a donation would mean the world to me and help keep development going strong.**

[![Support my work](https://img.shields.io/badge/☕_Support_my_work-nexus--prod.dev-FF5E5B?style=for-the-badge)](https://nexus-prod.dev/nexus-ai-chat-importer/support)

**Why support?**
- 🚀 **Faster development** - More time for features and improvements
- 🐛 **Better support** - Quicker bug fixes and responses
- 💡 **New features** - Your suggestions become reality
- ❤️ **Motivation** - Shows that my work is appreciated

## ✨ Key Features

- 🎯 **Selective Import**: Choose exactly which conversations to import with interactive preview
- 💬 **Multi-Provider Support**: Full support for ChatGPT, Claude, and Le Chat conversations
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

When you upgrade to a new version:
- ✅ Your settings are migrated to the new format
- ✅ Your existing conversations are updated with new features
- ✅ Folders are reorganized if needed (with your permission)
- ✅ A detailed upgrade report shows you what changed

**No manual work required** - just install and go!

### Plugin Settings

#### **📁 Folder Organization**

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

- **Message Timestamps**: Choose how dates appear in messages
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
1. Click your name → **Profile** → **Le Chat: Export**
2. Wait for the button to change from "Export" to "Download"
3. Click **Download** to get the ZIP file

### Step 2: Import to Obsidian

**Two ways to start:**
- Click the <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><line x1="9" x2="15" y1="10" y2="10"/><line x1="12" x2="12" y1="7" y2="13"/></svg> ribbon icon (chat +) in the left sidebar, OR
- Press **Ctrl/Cmd+P** → type "**Import AI conversations**"

### Provider Detection Rules (v1.5.7)

- The plugin auto-detects the provider from the **first supported ZIP** in your selection
- Files that don't match that provider are ignored and reported as skipped
- Unsupported archives are ignored with a clear message instead of breaking the import flow
- Desktop supports multiple ZIPs in one run (single provider per run)
- Mobile runs one ZIP per import for reliability

### Step 3: Choose Your Import Style

#### 🚀 **Quick Import** (Import Everything)

Perfect when you want everything imported fast:

1. Choose your ZIP file(s)
2. The provider is detected automatically from the first supported archive
3. Click **Import All**
4. Done! ✨

#### 🎯 **Selective Import** (Pick & Choose)

Perfect when you want control:

1. Choose your ZIP file(s)
2. The provider is detected automatically from the first supported archive
3. Click **Select Conversations**
4. **Review the list** - you'll see:
   - 📝 Conversation title and date
   - 💬 Number of messages
   - 🆕 **New** / 🔄 **Updated** / ✅ **Unchanged**
5. **Filter conversations** (optional):
   - 🔍 **Search by keyword** - Type in the search box to filter by title
   - 📊 **Filter by status** - Show New, Updated, or Unchanged
   - ♻️ **Show existing conversations only** - Shows only Updated + Unchanged entries
   - 📅 **Sort** - By date, title, or status
6. **Select conversations**:
   - ✅ Check individual conversations
   - ✅ Use "Select All" / "Deselect All" buttons
7. Click **Import Selected**

**Important behavior:**
- Selecting an **existing** conversation (Updated or Unchanged) in selective mode will overwrite and reprocess the matching note.

**Cool features:**
- ✅ **Keyword search** - Find conversations by title instantly
- ✅ **Smart filtering** - Show only what you need
- ✅ **Existing-only reprocess filter** - Rebuild selected existing notes intentionally
- ✅ **Multi-ZIP support (desktop)** - Process multiple exports at once
- ✅ **Single-ZIP safety mode (mobile)** - One archive per run for stable imports
- ✅ **Duplicate detection** - Automatically finds duplicates across ZIPs
- ✅ **Flexible sorting** - Organize by date, title, or status

### Step 4: Check Your Report

After every import, you get linked report files:

**What's in it:**
- ✅ **Import Summary** - stats, archive status, errors, attachments
- ✅ **Index Heavy** - full conversation index (new / updated / failed tables)
- ✅ **Index Mobile** - compact list optimized for mobile browsing

**Where to find them:**
- `<reports>/<provider>/<timestamp> - import summary.md`
- `<reports>/<provider>/<timestamp> - index heavy.md`
- `<reports>/<provider>/<timestamp> - index mobile.md`

**💡 Tip:** The summary report opens automatically when import finishes.

## 📊 Understanding Import Reports

Each import now writes three cross-linked reports:

1. **Import Summary**
- Global counters (files, conversations, attachments)
- Per-archive status table
- Consolidated errors

2. **Index Heavy**
- Full per-conversation listing
- Separate sections for created, updated, and failed items
- Best suited for desktop review and audits

3. **Index Mobile**
- Lightweight conversation index
- Split into `✨ New Notes` and `🔄 Updated Notes`
- Faster to open on mobile and small screens

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
nexus: nexus-ai-chat-importer
plugin_version: "1.x.x"
provider: chatgpt                     # chatgpt, claude, or lechat
aliases: "Conversation Title"         # YAML-safe alias used for linking
conversation_id: abc123...
create_time: 2024-01-15T14:30:22.000Z # UTC ISO 8601
update_time: 2024-01-15T16:45:10.000Z # UTC ISO 8601
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

- **Custom**: Pick your favorite format in Settings
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
- Add your own frontmatter fields and edit message content as needed
- Manual edits are preserved during plugin migrations
- Manual edits are lost if you reprocess/recreate a conversation note
- Use Reading View for best experience

**❌ DON'T**:
- Modify plugin-generated frontmatter fields (`nexus`, `plugin_version`, `provider`, `aliases`, `conversation_id`, `create_time`, `update_time`)
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
<attachments>/claude/artifacts/conversation-title/script_v1.py
```

#### What Gets Imported

**Images**:
- User-uploaded photos and screenshots
- AI-generated images (DALL-E with prompts)
- Embedded directly in conversation notes

**Documents**:
- PDFs, text files, code files
- Linked in conversation notes

**Claude Artifacts** (when included in export):
- Code, documents, and AI-generated content
- Saved as separate versioned files when content is available
- Each modification creates a new version (v1, v2, v3...)
- ⚠️ Note: Claude exports often don't include artifact content - see [Provider Limitations](#-provider-specific-features--limitations)

**Claude artifact notes include provider-specific frontmatter**:
```yaml
---
nexus: nexus-ai-chat-importer
plugin_version: "1.x.x"
provider: claude
artifact_id: artifact_abc123
version_uuid: 3aa6f6ec-6408-4a30-97d5-3774f289f4f3
version_number: 2
command: update
conversation_id: 09c7...e12f
create_time: 2024-10-21T14:19:11.000Z
format: markdown
aliases: ["Artifact Title", "artifact_abc123_v2"]
---
```

#### Missing Attachments

Some attachments may be missing from exports:
- **Older exports**: May not include all files
- **Large files**: Sometimes excluded from ZIP
- **External links**: Not downloadable

The plugin continues importing even with missing attachments. Check import reports for details.

## 🤖 Provider-Specific Features & Limitations

Each AI provider exports data differently.

> **Important**: providers do not publish stable export specs. Export ZIP formats can change at any time.
> If import behavior changes unexpectedly, please open an issue with clear details (provider, platform/device, plugin version, ZIP size, logs, screenshots).

### ChatGPT (OpenAI)

**✅ Fully Supported**:
- Conversation titles (exported in JSON)
- User-uploaded attachments (images, documents)
- DALL-E generated images with prompts
- Complete message history
- Custom instructions and model information

**Export Format**:
- `conversations.json` (single-file exports)
- `conversations-XXX.json` (split exports)
- Attachments in the same ZIP

**⚠️ Limitations**:
- Very large archives (multi-GB) are increasingly common. Mobile stability cannot be guaranteed in those cases.
- Desktop usually handles larger archives better, but if you hit limits, please report with ZIP size + logs.

### Claude (Anthropic)

**✅ Fully Supported**:
- Conversation titles (exported in JSON)
- User-uploaded attachments (images, documents)
- Complete message history
- Artifacts with full content and versioning

**⚠️ Limitations**:
- Some artifact/tool outputs may be absent from the provider export itself. Missing source data cannot be reconstructed by the plugin.
- As with all providers, export schema changes may require plugin updates.

**Export Format**: Single `conversations.json` file with all conversations + attachments in ZIP

**💡 Tip for Claude Users**:
- Artifacts are fully extracted and saved with versioning - check your artifacts folder
- If artifact rendering looks wrong after a provider-side change, reimport and report the issue with logs

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

---

## 🔄 Reimporting & Updates

You can reimport the same ZIP multiple times. The plugin supports two behaviors:

**Default behavior (incremental)**:
- ✅ New conversations are created
- ✅ Existing conversations with new content are updated
- ✅ Unchanged conversations are skipped
- ✅ Duplicates are prevented

**When to Reimport**:
- You've had more conversations since last export
- Plugin update adds new features
- Fix issues from previous import
- Retry failed attachments

**Reprocess behavior (overwrite)**:
- Reprocessing an existing conversation note overwrites it with fresh imported content
- This includes selective reimport when you explicitly select existing conversations
- Manual edits in overwritten notes (message content and custom frontmatter) are lost

**Mobile note**:
- In **Full Import** mode, if an archive was already imported, mobile lets you choose between:
  - **Reprocess and recreate all notes**
  - **Add/update missing/updated notes**
- In **Selective Import**, use **Show existing conversations only** to reprocess specific existing notes.

## 💻 Command-Line Interface (CLI)

Import conversations without opening Obsidian — useful for automation, large archives, or headless setups.

### Installation

The CLI is included in the plugin source. To use it:

1. Clone or download the [repository](https://github.com/Superkikim/nexus-ai-chat-importer)
2. Run `npm install` (plugin dependencies)
3. Run `npm --prefix cli install` (CLI dependencies)
4. Build the CLI with `npm --prefix cli run build`
5. Run `nexus-cli` from `cli/dist/` (or add it to your PATH)

### Usage

```bash
nexus-cli import --vault /path/to/vault --input export.zip --provider chatgpt [options]
```

> **CLI note**: provider auto-detection is a plugin UI feature. In CLI, `--provider` is required.
> Run one provider per command.

### Options

| Option | Description |
|--------|-------------|
| `--vault <path>` | Path to your Obsidian vault (required) |
| `--input <files...>` | One or more ZIP export files (required) |
| `--provider <name>` | Provider: `chatgpt`, `claude`, or `lechat` (required) |
| `--conversation-folder <path>` | Override conversation folder |
| `--attachment-folder <path>` | Override attachment folder |
| `--report-folder <path>` | Override report folder |
| `--date-prefix` | Add date prefix to filenames |
| `--date-format <fmt>` | Date format: `YYYY-MM-DD` or `YYYYMMDD` |
| `--timestamp-format <fmt>` | Message timestamp format: `locale`, `iso`, `us`, `eu`, `de`, or `jp` |
| `--dry-run` | Preview what would be imported without writing files |
| `--verbose` | Show detailed import progress |

### Examples

```bash
# Import a ChatGPT export
nexus-cli import --vault ~/my-vault --input chatgpt-export.zip --provider chatgpt

# Import a Claude export
nexus-cli import --vault ~/my-vault --input claude-export.zip --provider claude

# Import a Le Chat export
nexus-cli import --vault ~/my-vault --input lechat-export.zip --provider lechat

# Import multiple files with date prefix
nexus-cli import --vault ~/my-vault --input export1.zip export2.zip --provider chatgpt --date-prefix

# Preview without writing (dry run)
nexus-cli import --vault ~/my-vault --input export.zip --provider chatgpt --dry-run
```

> **Note**: The CLI reuses the same import engine as the plugin. Conversations imported via CLI are fully compatible with the plugin and vice versa.

---

## ⚠️ Important Notes

**Export format volatility**:
- Providers can change export structures at any time
- If imports suddenly fail after a provider change, open an issue with logs and archive details

**Mobile constraints**:
- Mobile imports run one ZIP at a time
- Very large archives can exceed memory limits depending on device

**Overwrite behavior**:
- Reprocess/recreate modes overwrite target notes
- Keep backups if you manually edited notes and plan to reprocess

**Storage impact**:
- Attachments can significantly increase vault size
- AI-generated images can be several MB each
- Consider excluding `<attachments>/` from cloud sync if storage/bandwidth is limited

## 🐛 Troubleshooting

**"Invalid file format" error**:
- Only ZIP files are supported (must have `.zip` extension)
- **Known Issue (Claude + Firefox on Mac)**: The downloaded file may have a `.dat` extension instead of `.zip`
  - **Solution**: Simply rename the file to change `.dat` to `.zip` (do NOT extract and re-compress!)
  - This is a browser/server issue that has been reported to Anthropic
- If you manually compressed a folder, make sure it's a valid ZIP format

**Import stuck or slow**:
- Large archives can take several minutes
- Check progress dialog
- On mobile, import one archive at a time
- If frozen, restart Obsidian and retry

**No conversations appear**:
- Verify selected ZIP files are from a supported provider
- In plugin UI, provider is auto-detected from the first supported archive
- In CLI, verify `--provider` matches the selected ZIP files
- Check ZIP file is valid export
- Review import report for errors

**Archive is skipped as unsupported**:
- This means the file does not match a supported export structure
- The import continues for other valid archives
- Use the summary report to see exactly which file was skipped and why

**Safari users (Mac) - ZIP file issues**:
- Safari automatically unzips downloaded files by default
- This creates a folder instead of keeping the ZIP file
- **Solution**: Disable auto-unzip in Safari:
  - Safari → Preferences → General
  - Uncheck "Open 'safe' files after downloading"
  - Re-download the export from ChatGPT/Claude/Le Chat
- **Note**: This is a Safari feature, not a plugin bug
- **Do NOT manually re-compress** unzipped folders (creates incorrect structure)

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
   - Provider + import mode (full/selective, plugin/CLI)
   - Platform (desktop/iOS/Android) + device model
   - ZIP size (and number of ZIPs)
   - Problem description
   - Relevant logs and screenshots

## 🚀 Future Plans

Current roadmap:
- **v1.6.0**: Perplexity provider support
- **Gemini**: feasibility study in progress (no ETA)

### How You Can Help

- 💡 **Suggest Features**: Open an issue on GitHub with your ideas
- 🐛 **Report Bugs**: Help us improve by reporting issues
- ☕ **Support Development**: [Support my work](https://nexus-prod.dev/nexus-ai-chat-importer/support) to speed up development
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
- **Contributors**:
  - [@caseyg](https://github.com/caseyg) — CLI for bulk importing (PR #33), Claude formatting feedback (PR #34)
  - [@chuckfs](https://github.com/chuckfs) — iOS support (PR #15)
  - [@baron](https://github.com/baron) — Large archive handling research (PR #27)
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
[![Support my work](https://img.shields.io/badge/☕_Support_my_work-nexus--prod.dev-FF5E5B?style=for-the-badge)](https://nexus-prod.dev/nexus-ai-chat-importer/support)

### 📦 Repository

[![GitHub](https://img.shields.io/badge/GitHub-Repository-181717?style=for-the-badge&logo=github)](https://github.com/Superkikim/nexus-ai-chat-importer)
[![Releases](https://img.shields.io/badge/Releases-Download-blue?style=for-the-badge)](https://github.com/Superkikim/nexus-ai-chat-importer/releases)
[![Contributors](https://img.shields.io/badge/Contributors-View-green?style=for-the-badge)](https://github.com/Superkikim/nexus-ai-chat-importer/graphs/contributors)

</div>
