# Nexus AI Chat Importer

[![Obsidian](https://img.shields.io/badge/Obsidian-0.15.0+-purple?logo=obsidian)](https://obsidian.md/) [![GitHub release (latest by date)](https://img.shields.io/github/v/release/superkikim/nexus-ai-chat-importer)](https://github.com/Superkikim/nexus-ai-chat-importer/releases/latest) [![Downloads](https://img.shields.io/badge/dynamic/json?url=https://raw.githubusercontent.com/Superkikim/nexus_stats/main/summary.json&query=%24.total_downloads&label=downloads&color=blue)](https://github.com/Superkikim/nexus-ai-chat-importer/releases) [![License](https://img.shields.io/badge/license-GPL--3.0-green)](LICENSE)

> 🌍 **Plugin UI and documentation now available in 10 languages**
>
> [![EN](https://img.shields.io/badge/docs-EN-0066CC)](https://nexus-prod.dev/nexus-ai-chat-importer/) [![DE](https://img.shields.io/badge/docs-DE-0066CC)](https://nexus-prod.dev/de/nexus-ai-chat-importer/) [![ES](https://img.shields.io/badge/docs-ES-0066CC)](https://nexus-prod.dev/es/nexus-ai-chat-importer/) [![FR](https://img.shields.io/badge/docs-FR-0066CC)](https://nexus-prod.dev/fr/nexus-ai-chat-importer/) [![IT](https://img.shields.io/badge/docs-IT-0066CC)](https://nexus-prod.dev/it/nexus-ai-chat-importer/) [![JA](https://img.shields.io/badge/docs-JA-0066CC)](https://nexus-prod.dev/ja/nexus-ai-chat-importer/) [![KO](https://img.shields.io/badge/docs-KO-0066CC)](https://nexus-prod.dev/ko/nexus-ai-chat-importer/) [![PT](https://img.shields.io/badge/docs-PT-0066CC)](https://nexus-prod.dev/pt/nexus-ai-chat-importer/) [![RU](https://img.shields.io/badge/docs-RU-0066CC)](https://nexus-prod.dev/ru/nexus-ai-chat-importer/) [![ZH](https://img.shields.io/badge/docs-ZH-0066CC)](https://nexus-prod.dev/zh/nexus-ai-chat-importer/)

> ✅ **v1.6.9** — Claude's new split export (the one that comes with a manifest and several ZIPs) is now detected: import `conversations-000.zip` directly. Callout colors restored on Obsidian 1.13+.
> See [What’s New](#-whats-new) for details.


## 📑 Table of Contents

### 🚀 Getting Started
- [⚡ Quickstart](#-quickstart) - Get up and running in 2 minutes
- [📥 Installation](#-installation--settings) - Install from Community Plugins
- [📤 Export Your Chats](#-importing-conversations) - Get your data from ChatGPT/Claude/Mistral Vibe/Perplexity

### 💡 Using the Plugin
- [📥 Import Conversations](#-importing-conversations) - Quick or selective import
- [📊 Import Reports](#-understanding-import-reports) - Understand what was imported
- [📁 File Organization](#-data-organization) - Where your files are stored
- [🎨 Conversation Format](#-conversation-format) - How conversations look

### 🔧 Advanced
- [📎 Attachments](#attachments) - Images, DALL-E, artifacts
- [🤖 Provider Differences](#-provider-specific-features--limitations) - ChatGPT, Claude, Mistral Vibe, Perplexity specifics
- [💻 CLI](#-command-line-interface-cli) - Import from command line
- [⚙️ Settings](#plugin-settings) - Customize folders and formatting
- [🔧 Troubleshooting](#-troubleshooting) - Common issues and solutions

### 📚 More
- [🔒 Privacy & Security](#-privacy--security) - What the plugin accesses and why
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
   - **Mistral Vibe**: Click your name → Profile → Mistral Vibe: Export → Download
   - **Perplexity**: Export via Perplexity Thread Exporter (ZIP with `perplexity_*.json`)
3. **Import**: Click the <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><line x1="9" x2="15" y1="10" y2="10"/><line x1="12" x2="12" y1="7" y2="13"/></svg> ribbon icon (chat +) in the left sidebar or use command palette → "Import AI conversations"
4. **Select** your ZIP file(s) and import mode (all or selective)
5. **Provider is auto-detected** from the first supported archive in your selection
6. **Done!** Your conversations are now in `Nexus/Conversations/`

💡 **First time?** The plugin will show you a welcome dialog with helpful links!

---

## Overview

Import and organize AI chat exports from **ChatGPT**, **Claude**, **Mistral Vibe**, **Perplexity**, and more in your local Obsidian vault, so you stay in control of your data.

### 🔍 Features in a Glance

- Multi-provider support (ChatGPT, Claude, Mistral Vibe, Perplexity)
- Selective import with interactive preview
- Smart deduplication across multiple ZIPs
- Attachment handling — images, documents, DALL-E, artifacts (provider-dependent)
- Claude artifact versioning
- LaTeX math support
- CLI for automation and headless setups
- Beautiful formatting with role-specific callouts
- Detailed import reports
- Full UI localization in 10 languages

## ✨ What's New

### v1.6.9 — Claude split export detection

🐛 **Fixed**
- **Claude — New export layout supported** — Anthropic now delivers a manifest listing several ZIPs, and `users.json` moved out of the conversations archive; `conversations-000.zip` was therefore misread as a ChatGPT export and imported nothing
- Import `conversations-000.zip` directly — the projects, memories and light metadata archives contain nothing the plugin uses
- Detection of all previously supported export formats is unchanged
- **Callout colors on Obsidian 1.13+** — Obsidian 1.13.0 changed `--callout-color` to require a real CSS color, leaving Nexus callouts without color or border; both the old and the new format are now served

---

### v1.6.8 — ChatGPT 2026, Claude Citations & Vibe Canvas

✨ **New**
- **ChatGPT — Product carousels rendered** — `products{…}` shopping widget tokens are replaced by a collapsible callout showing product names, categories and prices; images and purchase links are not in the export, a link to the original conversation is provided
- **Claude — Web search citations** — sources consulted during web search are now appended as a deduplicated `### References` list at the end of each message
- **ChatGPT — Canvas directives** — `:::writing{…}` blocks in the 2026 export are rendered as collapsible `nexus_canvas` callouts (raw markup no longer leaks into notes)
- **ChatGPT — Canvas documents** — assistant-generated Canvas files (`.docx`, etc.) extracted from `library_files.json` and linked in the originating message
- **ChatGPT — Generated image placeholder** — when recent exports omit AI-generated images entirely, a visible placeholder is inserted with the prompt; older DALL-E exports are unaffected
- **Vibe — Canvas rendered inline** — slide decks and markdown documents from the `canvas[]` field are rendered as collapsible `nexus_canvas` callouts
- **Vibe — Generated file placeholder** — assistant-generated files (`.docx`, etc.) referenced via `file_reference` chunks get a `nexus_attachment` placeholder with a link to the original conversation

🐛 **Fixed**
- **ChatGPT 2026 format** — `.dat` attachments resolved via `conversation_asset_file_names.json`; user-uploaded documents (PDFs, etc.) imported correctly
- **Voice recordings** — WAVs now correctly detected and skipped (were previously imported as broken WebP files)

---

### v1.6.7 — Mistral Vibe & Claude message order fix

✨ **Changed**
- **Mistral Vibe** (formerly Le Chat) — Mistral AI has rebranded their chat product
- Vault folders renamed automatically on upgrade: `lechat/` → `vibe/`
- Conversation frontmatter updated: `provider: lechat` → `provider: vibe`
- Conversation links in import reports updated to reflect new folder paths

🔧 **Improved**
- Upgrade migrations now run after the vault is fully indexed (`onLayoutReady`), preventing silent no-ops on first load

🐛 **Fixed**
- Claude messages no longer appear out of order when the user replies within the same second as the assistant

---

### v1.6.6 — Claude Attachment Fix & Report Improvements

🐛 **Fixed**
- **Claude inline text/doc content was silently ignored** — `.txt` and `.docx` attachments whose content is embedded in `conversations.json` (`extracted_content`) are now rendered as collapsible callouts in the conversation note

🔧 **Improved**
- Attachment display refined: `.txt` as plain callout, document extracts labelled *(text extract)* + link, code files with syntax-highlighted fence, binaries with placeholder
- Empty conversations (interrupted sessions, artifact-only) now classified as `ignored` rather than `skipped`
- Attachment summary in reports redesigned as a breakdown table (Extracted / Inline / Not provided / Missing / Failed)
- ZIP timestamp column added to import summary tables (works across all providers)

---

### v1.6.5 — Vault Safety & Dialog Readability

🔧 **Improved**
- Vault file scans scoped to plugin folders only — no longer enumerates the entire vault
- Removed legacy migration scripts (pre-1.3.0); replaced with an explicit version guard
- Conversation selection dialog toolbar wraps correctly on narrow viewports and long-label locales (FR, DE, JA…)
- Folder migration dialog: buttons and paths wrap properly for long vault paths
- First-install and upgrade dialogs show contextually relevant content (overview vs. What's New)

---

### v1.6.x — Series highlights

✨ **New across 1.6.x**
- Perplexity provider support (Perplexity Thread Exporter ZIP archives)
- Mistral Vibe support (formerly Le Chat)
- Per-turn model-aware assistant headers (`Assistant · <model>`)
- Universal frontmatter metadata (`mode`, `models`)
- Dual-schema support for Perplexity Thread Exporter archives

🔧 **Improved across 1.6.x**
- Filenames no longer truncate or fail on long conversation titles
- Perplexity conversations deduplicated correctly across export variants
- Under-the-hood quality and compliance improvements for better stability

🐛 **Fixed across 1.6.x**
- Claude conversations with no exportable content are now skipped gracefully instead of creating empty notes

---

> Upgrading from a previous version triggers required migration tasks automatically.

*For full release history, see [RELEASE_NOTES.md](RELEASE_NOTES.md)*

## ☕ Support My Work

Nexus has reached 15,000+ downloads. Right now, only about 5 users per month donate to support development.

I maintain this plugin in my own time, and keeping my dev ecosystem running has ongoing costs. Adding new providers also requires paid subscriptions so I can test and deliver accurate support.

If Nexus is valuable to you, please consider a one-time or monthly donation. Thank you to everyone already supporting the project.

[![Support my work](https://img.shields.io/badge/☕_Support_my_work-nexus--prod.dev-FF5E5B?style=for-the-badge)](https://nexus-prod.dev/nexus-ai-chat-importer/support)

**Why support?**
- 🚀 **Faster development** - More time for features and improvements
- 🐛 **Better support** - Quicker bug fixes and responses
- 💡 **New features** - Your suggestions become reality
- ❤️ **Motivation** - Shows that my work is appreciated

> **Note:** The plugin will invite you to donate after your first import, and every 5 imports after that. You can always close the dialog.

## ✨ Key Features

- 🎯 **Selective Import**: Choose exactly which conversations to import with interactive preview
- 💬 **Multi-Provider Support**: Full support for ChatGPT, Claude, Mistral Vibe, and Perplexity conversations
- 🎨 **Beautiful Formatting**: Custom callouts with role-specific colors and icons
- 📎 **Complete Attachment Handling**: Images, documents, DALL-E creations with prompts (when included in export)
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
4. **Choose message timestamp format**:
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
  - **Custom**: Pick from ISO 8601, US, European, German, or Japanese

#### **🔄 Moving Your Files**

Want to reorganize? No problem!

1. **Change a folder path** in settings
2. **Click Save**
3. **Choose what to do**:
   - ✅ **Move files**: Existing files are moved/merged to the new location
     - For conversation/attachment folder moves, links are updated after migration
   - ❌ **Leave files**: They stay put (but won't be managed by the plugin anymore)

> **💡 Pro tip:** The plugin uses move+merge (not blind overwrite). If the target folder is not empty, migration is blocked to prevent conflicts.

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

**Mistral Vibe** (formerly Le Chat):
1. Click your name → **Profile** → **Mistral Vibe: Export**
2. Wait for the button to change from "Export" to "Download"
3. Click **Download** to get the ZIP file

**Perplexity**:
1. Install **Perplexity Thread Exporter** from the Chrome Web Store:
   https://chromewebstore.google.com/detail/perplexity-thread-exporte/cnfolggfjfikolipcldcnbbbbbfogegj
2. Open Perplexity and go to a thread (or your Library): https://www.perplexity.ai/library
3. Click the extension icon and export your threads
4. Download the export ZIP that contains `perplexity_*.json` files
5. If your download is an **outer ZIP that contains part ZIP files** (`part1of3.zip`, etc.), extract that outer ZIP first and import the inner part ZIP files directly
6. Import ZIP files in the plugin (direct JSON import is not supported)

> **⚠️ Important (third-party extension disclaimer)**
> Perplexity export support in this plugin currently relies on the third-party Chrome extension
> **Perplexity Thread Exporter** (MMV Inc).
> This extension is not maintained by the plugin author and is outside this project's control.
> If extension behavior, pricing, limits, output format, or availability changes, imports may be affected and may require plugin updates.

### Step 2: Import to Obsidian

**Two ways to start:**
- Click the <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><line x1="9" x2="15" y1="10" y2="10"/><line x1="12" x2="12" y1="7" y2="13"/></svg> ribbon icon (chat +) in the left sidebar, OR
- Press **Ctrl/Cmd+P** → type "**Import AI conversations**"

### Provider Detection Rules (v1.6.x)

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

> **💾 Keep your export ZIPs**
> The plugin imports from your ZIP files but does not store them. If something goes wrong or a future plugin version improves processing, you will need the original ZIP to reimport. Keep at least your most recent export from each provider.

### Step 4: Check Your Report

After each import run with at least one supported archive, you get linked report files:

**What's in it:**
- ✅ **Import Summary** - stats, archive status, errors, attachments
- ✅ **Index Heavy** - full conversation index (new / updated / failed tables)
- ✅ **Index Mobile** - compact list optimized for mobile browsing

**Where to find them:**
- `<reports>/<provider>/<timestamp> - import summary.md`
- `<reports>/<provider>/<timestamp> - index heavy.md`
- `<reports>/<provider>/<timestamp> - index mobile.md`

**💡 Tip:** The completion dialog includes a direct link to the summary report.

## 📊 Understanding Import Reports

Each import now writes three cross-linked reports:

1. **Import Summary**
- Global counters (files, conversations, attachments)
- Per-archive status table (`processed` / `skipped`) with reason
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

`conversation-title` follows the same naming rules as conversation notes (including date prefix if enabled).

#### What Gets Imported

**Images**:
- User-uploaded photos and screenshots
- AI-generated images (DALL-E with prompts) — when included in the export (see [Provider Limitations](#-provider-specific-features--limitations))
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

---

## 🎨 Conversation Format

Each imported conversation is a Markdown note with three parts.

### 1. Frontmatter

Rich metadata written at the top of every note:

```yaml
---
nexus: nexus-ai-chat-importer        # Plugin identifier (do not modify)
plugin_version: "1.x.x"             # Plugin version at import time
provider: chatgpt                    # chatgpt, claude, vibe, or perplexity
aliases: My Conversation Title       # YAML-safe alias for Obsidian linking
conversation_id: abc123...
create_time: 2024-01-15T14:30:22.000Z # UTC ISO 8601
update_time: 2024-01-15T16:45:10.000Z # UTC ISO 8601
---
```

> **Note on `aliases`**: Normal titles are written unquoted. Titles that contain YAML-special characters (`:`, `[`, `{`) are automatically wrapped in single quotes — e.g. `aliases: 'My Question: An Answer'`.

This metadata enables powerful Obsidian features:
- 🔍 **Search & filter** by any field
- 📊 **Dataview queries** for custom dashboards
- 📈 **Track statistics** across conversations
- 🔗 **Link** using aliases

### 2. Header

Title and timestamps, with a link to the original conversation:

```markdown
# Title: Conversation Title
Created: 2024-01-15 at 14:30:22
Last Updated: 2024-01-15 at 16:45:10
Chat URL: https://chatgpt.com/c/abc123...
```

> **Note**: If you deleted the conversation online, the link will be dead.

### 3. Messages

Formatted with custom Obsidian callouts:

```markdown
> [!nexus_user]
> **User** - 2024-01-15 14:30:22
>
> How do I implement binary search in Python?

> [!nexus_agent]
> **Assistant** - 2024-01-15 14:31:05
>
> Binary search works by dividing the search space in half repeatedly. Here's a Python implementation:
```

**Callout Types**:
- 👤 **nexus_user**: Blue callouts for user messages
- 🤖 **nexus_agent**: Green callouts for AI responses
- 📎 **nexus_attachment**: Amber callouts for attachments
- ✨ **nexus_artifact**: Purple callouts for Claude artifacts
- 🪄 **nexus_prompt**: Red callouts for prompt blocks (including DALL-E prompts)

**Viewing Modes**:
- **Reading View**: Full visual experience with colored callouts
- **Live Preview**: Rendered callouts while editing. If you make a search or click a message, the message you access will be shown as raw markdown. This is an expected behavior of Obsidian Live Preview
- **Source Mode**: Raw Markdown syntax

### Date & Time Formats

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

### Recommendations

**✅ DO**:
- Add your own frontmatter fields and edit message content as needed
- Manual edits are usually preserved during migrations and incremental updates
- Keep backups if you plan to reprocess/recreate existing notes
- Use Reading View for best experience

**❌ DON'T**:
- Modify plugin-generated frontmatter fields (`nexus`, `plugin_version`, `provider`, `aliases`, `conversation_id`, `create_time`, `update_time`)
- Delete message IDs (hidden in Reading View)
- Remove messages and expect skipped/incremental runs to always restore them automatically

> **Why?** The plugin uses `conversation_id` and message IDs to detect updates and avoid duplicates. Modifying them breaks this functionality.

---

## 🤖 Provider-Specific Features & Limitations

Each AI provider exports data differently.

> **⚠️ Export Format Stability**
>
> AI providers make export ZIPs available to comply with data portability regulations (GDPR, CCPA, etc.).
> These exports are **not officially documented** and providers make **no guarantees** about format stability — they can and do change without notice.
>
> If a provider changes their export format, the plugin may stop importing correctly through no fault of its own.
> **The plugin author cannot be held responsible for breakage caused by provider-side format changes.**
>
> If import behavior changes unexpectedly, please open an issue with clear, precise details:
> provider, platform/device, plugin version, ZIP size, problem description, and relevant logs or screenshots.

### ChatGPT (OpenAI)

**✅ Fully Supported**:
- Conversation titles (exported in JSON)
- User-uploaded attachments (images, documents)
- Complete message history
- Custom instructions and model information

**⚠️ Limitations**:
- **DALL-E generated images no longer included in exports**: As of 2026, OpenAI stopped including AI-generated images in the data export. The plugin inserts a visible placeholder (with the generation prompt when available) so the omission is explicit rather than silent. This is an OpenAI-side regression — the plugin cannot recover images that are absent from the export.
- Very large archives (multi-GB) are increasingly common. Mobile stability cannot be guaranteed in those cases.
- Desktop usually handles larger archives better, but if you hit limits, please report with ZIP size + logs.

**Export Format**:
- `conversations.json` (single-file exports)
- `conversations-XXX.json` (split exports)
- Attachments in the same ZIP (2026 format: all files as `file_<id>.dat`, resolved via `conversation_asset_file_names.json`)

### Claude (Anthropic)

**✅ Fully Supported**:
- Conversation titles (exported in JSON)
- Complete message history
- Artifacts with full content and versioning

**📎 Attachment Handling by File Type**:

Claude's export contains only `conversations.json` — no binary files. What gets imported depends on the file type:

| File type | What Claude exports | Result in note |
|---|---|---|
| Text (`.txt`) | Full text content in `extracted_content` | Inline collapsible callout |
| Word (`.docx`) | Extracted text in `extracted_content` | Inline collapsible callout |
| Images (`.png`, `.jpg`, …) | Reference only (no content) | Placeholder: *Image not included in Claude's export* |
| PDF | Reference only — **text extraction not provided** | Placeholder: *PDF not included in Claude's export (text content not provided)* |
| Other binaries | Reference only (no content) | Placeholder: *File not included in Claude's export* |

> **Note on PDFs**: Claude can read and reason about PDFs during conversation, but the extracted text is not included in the data export. Only a file reference is present.

**⚠️ Limitations**:
- Binary file content (images, PDFs, etc.) is never included in Claude's export and cannot be recovered by the plugin
- Some artifact/tool outputs may be absent from the provider export itself. Missing source data cannot be reconstructed by the plugin.
- As with all providers, export schema changes may require plugin updates.

**Export Format**: Single `conversations.json` file with all conversations + inline text content in ZIP

**💡 Tip for Claude Users**:
- Artifacts are fully extracted and saved with versioning - check your artifacts folder
- Text and Word document content is embedded directly in your conversation notes
- If artifact rendering looks wrong after a provider-side change, reimport and report the issue with logs

### Mistral Vibe (formerly Le Chat)

**✅ Supported**:
- User-uploaded attachments (images, documents)
- Complete message history
- References and citations
- Custom elements

**⚠️ Limitations**:
- **No conversation titles**: Mistral Vibe exports don't include conversation titles. The plugin automatically generates titles from the first user message (first 50 characters, followed by '...')
- **No generated images**: Images created by Mistral Vibe's image generation tool are **not included in exports**. Only external URLs are provided, which may expire. The plugin will show the generation prompt but cannot download the images
- **Tool calls filtered**: Internal tool calls (web_search, etc.) are filtered out as they're not useful for users

**Export Format**: Individual `chat-{uuid}.json` files (one per conversation) + attachments in `chat-{uuid}-files/` directories

**💡 Tip for Mistral Vibe Users**:
- If you want to preserve generated images, download them manually before exporting
- Consider adding custom titles to your conversations by editing the imported notes' frontmatter

### Perplexity (via Perplexity Thread Exporter)

**✅ Supported**:
- Thread export archives generated by Perplexity Thread Exporter (`perplexity_*.json`)
- Thread Exporter schema variants:
  - `metadata + conversations[]`
  - `status + entries + thread_metadata`
- Answer Markdown preserved as-is
- Sources/references rendered in assistant messages
- Related queries appended at the end of notes (when present)
- Best-effort `mode` / `models` metadata when available in export data

**⚠️ Limitations**:
- Export creation currently depends on a third-party extension (not affiliated with this plugin)
- Free/Premium limits, UI flow, and export options are controlled by the extension publisher and may change
- If the extension output schema changes, the plugin may require updates before imports work again

**Export format expected by this plugin**:
- ZIP containing `perplexity_*.json` thread files (Perplexity Thread Exporter output)
- If you downloaded an outer ZIP that contains multiple `part*.zip` files, import those inner `part*.zip` files directly

**💡 Tip for Perplexity users**:
- Keep original export ZIP files so you can reimport after plugin updates
- If import behavior changes, include sample archive structure and logs when reporting issues

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

> ⚠️ **CLI disclaimer**: The CLI is a separate, optional tool — not part of the Obsidian plugin distribution and not verified by Obsidian. It requires Node.js and runs on desktop only. Installation is voluntary and independent from the plugin. See [cli/README.md](cli/README.md) for details.

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
| `--provider <name>` | Provider: `chatgpt`, `claude`, or `vibe` (required) |
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

# Import a Mistral Vibe export
nexus-cli import --vault ~/my-vault --input mistral-vibe-export.zip --provider vibe

# Import multiple files with date prefix
nexus-cli import --vault ~/my-vault --input export1.zip export2.zip --provider chatgpt --date-prefix

# Preview without writing (dry run)
nexus-cli import --vault ~/my-vault --input export.zip --provider chatgpt --dry-run
```

> **Note**: The CLI reuses the same import engine as the plugin. Conversations imported via CLI are fully compatible with the plugin and vice versa.

---

## 🔒 Privacy & Security

The Obsidian plugin portal lists the following disclosures for this plugin. Here is what each means in practice.

### External domain requests

The plugin may reference external domains. Here is exactly what each is used for:

**GitHub (api.github.com, raw.githubusercontent.com)**
Used once per version upgrade to display "What's New" release notes inside the upgrade dialog.

**AI provider URLs (chatgpt.com, claude.ai, chat.mistral.ai, perplexity.ai)**
Each imported conversation contains the original link to the webapp of its provider, allowing you to open it in your browser.

**Support links (github.com, nexus-prod.dev, forum.obsidian.md)**
Shown as clickable links in the plugin settings panel or dialogs. These links are used for issues and discussions (github.com, forum.obsidian.md), support (github.com, nexus-prod.dev), documentation (nexus-prod.dev).

### Network requests

The plugin makes network requests only to GitHub, and only to display release notes in the upgrade dialog.

### Vault Enumeration

The plugin scans vault files in two situations only:
1. **During import** — to detect and skip duplicate conversations already in your vault
2. **During version upgrades** — to migrate existing conversation notes to the new format (runs once per version, automatically)

No vault content is read for any other purpose.

### Vault Read / Write

The plugin reads and writes files in the folders you configure (Conversations, Attachments, Reports). It only accesses files it has created. It does not read, modify, or delete any other files in your vault.

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
- On mobile, only one ZIP is processed per import run
- Check ZIP file is valid export
- Review import report for errors

**Archive is skipped as unsupported**:
- This means the file does not match a supported export structure
- The import continues for other valid archives
- Use the summary report to see exactly which file was skipped and why

**Perplexity outer ZIP with inner part ZIP files**:
- Some Thread Exporter runs produce an outer ZIP containing `part1of3.zip`, `part2of3.zip`, etc.
- The plugin does not import nested ZIP files recursively
- Extract the outer ZIP, then import the inner part ZIP files directly

**Safari users (Mac) - ZIP file issues**:
- Safari automatically unzips downloaded files by default
- This creates a folder instead of keeping the ZIP file
- **Solution**: Disable auto-unzip in Safari:
  - Safari → Preferences → General
  - Uncheck "Open 'safe' files after downloading"
  - Re-download the export from ChatGPT/Claude/Mistral Vibe/Perplexity
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
- **v1.6.x**: Perplexity follow-up improvements (sources/citations variants, richer metadata)

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

See [LICENSE](LICENSE) for full details.

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
