# 🎉 Nexus AI Chat Importer v1.3.0 - Release Notes

**Release Date:** January 2025  
**License Change:** GPL-3.0 (previously MIT)

---

## 📋 Table of Contents

- [Overview](#overview)
- [Major Features](#major-features)
- [Breaking Changes](#breaking-changes)
- [Improvements](#improvements)
- [Bug Fixes](#bug-fixes)
- [Migration & Upgrade](#migration--upgrade)
- [Technical Changes](#technical-changes)
- [Known Issues](#known-issues)

---

## 🌟 Overview

Version 1.3.0 is a **major release** focused on:
- ✅ **International support** with ISO 8601 timestamps
- ✅ **Flexible folder organization** with separate Reports folder
- ✅ **Enhanced UI/UX** with tree-based folder browser
- ✅ **Improved reliability** with comprehensive bug fixes
- ✅ **Better performance** with optimized imports and migrations

**Upgrading from v1.2.0?** The plugin automatically migrates your data. No manual work needed!

---

## 🚀 Major Features

### 1. **Separate Reports Folder** - Better Organization

**What's New:**
- Reports now have their own dedicated folder (default: `Nexus/Reports`)
- Configure the location in Settings → Folder Organization
- Automatic migration from old structure (`Nexus/Conversations/Reports`)

**Why This Matters:**
- ✅ Cleaner folder structure
- ✅ Easier to exclude reports from sync
- ✅ Better separation of concerns

**Migration:**
- Automatic on first launch of v1.3.0
- You'll be prompted to confirm the new location
- All existing reports are moved automatically
- Links in artifacts are updated to point to new location

---

### 2. **International Date Support** - Works Everywhere

**Before v1.3.0:** Date parsing issues for non-US users (MM/DD vs DD/MM confusion).

**Now:** Proper international support!

**What Changed:**
- ✅ All **frontmatter** uses **ISO 8601** format (universal standard: `2024-01-15T14:30:22.000Z`)
- ✅ Choose your preferred format for **message timestamps** in note body
- ✅ Works correctly in all languages and locales
- ✅ Automatic migration converts existing timestamps

**Available Message Timestamp Formats:**
- **Auto (Default)**: Follows Obsidian's language setting
- **ISO 8601**: `2024-01-15 14:30:22` (Universal, sortable)
- **US Format**: `01/15/2024 2:30:22 PM`
- **European Format**: `15/01/2024 14:30:22`
- **German Format**: `15.01.2024 14:30:22`
- **Japanese Format**: `2024/01/15 14:30:22`

> **⚠️ Important:** Changing the timestamp format only affects **new imports**. Existing notes keep their current format to avoid modifying your data.

**Configure in Settings:**
- Settings → Display Options → Custom message timestamp format
- Toggle ON to choose a specific format
- Toggle OFF to use Obsidian's language setting (default)

---

### 3. **Tree-Based Folder Browser** - Easier Navigation

**What's New:**
- Visual folder tree browser replaces text input
- Create new folders directly from the browser
- Browse your entire vault structure
- Select vault root with one click

**Where You'll See It:**
- Settings → Folder Organization (all 3 folders)
- Migration dialogs
- Folder configuration prompts

**Benefits:**
- ✅ No more typos in folder paths
- ✅ See your vault structure at a glance
- ✅ Create folders on the fly
- ✅ Validation prevents nesting conflicts

---

### 4. **Enhanced Selective Import** - Better Preview

**Improvements:**
- ✅ Clearer conversation status indicators (New, Updated, Unchanged)
- ✅ Duplicate detection across multiple ZIP files
- ✅ Better deduplication information
- ✅ Improved table sorting and filtering
- ✅ Comprehensive analysis display

**Status Indicators:**
- 🆕 **New**: Conversation doesn't exist in vault
- 🔄 **Updated**: Conversation has new messages
- ⏭️ **Unchanged**: No changes detected (auto-filtered)

---

### 5. **Improved Attachment Handling**

**What's New:**
- ✅ DALL-E images with prompts properly nested
- ✅ Better attachment statistics in reports
- ✅ Recursive search for DALL-E prompt-image association
- ✅ Provider-agnostic attachment types
- ✅ Enhanced error logging with context

**DALL-E Improvements:**
- Prompts are now nested inside message callouts
- Better visual hierarchy
- Supports both text and code format prompts
- Chronological timestamp handling

---

## ⚠️ Breaking Changes

### 1. **License Change: MIT → GPL-3.0**

**What This Means:**
- The plugin remains **free and open-source**
- You can still use it freely
- If you modify and distribute it, you must share your changes under GPL-3.0
- Commercial use requires compliance with GPL-3.0 terms

**Why the Change:**
- Better protection for open-source contributions
- Ensures improvements benefit the community
- Standard license for Obsidian plugins

---

### 2. **Folder Structure Changes**

**Old Structure (v1.2.0):**
```
Nexus/
├── Conversations/
│   ├── [conversation files]
│   └── Reports/          ← Reports were here
└── Attachments/
```

**New Structure (v1.3.0):**
```
Nexus/
├── Conversations/        ← Clean, only conversations
├── Attachments/
└── Reports/              ← Separate folder
```

**Migration:**
- Automatic on first launch
- You'll be prompted to confirm
- All links are updated automatically

---

### 3. **Timestamp Format in Frontmatter**

**Old Format (v1.2.0):**
```yaml
create_time: 06/28/2024 at 10:34:21 PM
update_time: 06/28/2024 at 10:34:21 PM
```

**New Format (v1.3.0):**
```yaml
create_time: 2024-06-28T22:34:21.000Z
update_time: 2024-06-28T22:34:21.000Z
```

**Migration:**
- Automatic conversion of all existing files
- Supports all date formats (US, EU, DE, JP, etc.)
- Intelligent parser detects format automatically
- Progress tracking during migration

---

## 🎨 Improvements

### User Interface

- ✅ Redesigned Settings page - easier to find what you need
- ✅ Wider folder path inputs - see full paths without scrolling
- ✅ Better dialog sizes - everything fits on screen
- ✅ Clearer progress messages - know exactly what's happening
- ✅ Simplified migration prompts - less confusing text

### Speed & Performance

- ✅ Faster imports - especially for large conversation collections
- ✅ Quicker folder moves - no more waiting
- ✅ Smoother upgrades - batch processing prevents freezing

### Import Reports

- ✅ More detailed statistics - see exactly what was imported
- ✅ Better organization - newest conversations at the top
- ✅ Duplicate count shown - know how many were skipped
- ✅ Prettier formatting - easier to read with colors and tables

---

## 🐛 Bug Fixes

### Critical Fixes

- ✅ **Fixed timestamp parsing for non-US locales** - No more MM/DD vs DD/MM confusion
- ✅ **Fixed folder deletion after migration** - Empty parent folders are now properly removed
- ✅ **Fixed link updates in artifacts** - Links are updated in both frontmatter and body
- ✅ **Fixed duplicate conversations in multi-ZIP imports** - Proper deduplication across files
- ✅ **Fixed progress modal stuck at 5%** - Accurate progress tracking
- ✅ **Fixed Browse button overflow** - UI elements stay within containers

### Import & Processing

- ✅ Empty conversations (0 messages) are now filtered out automatically
- ✅ Invalid conversations are skipped instead of causing errors
- ✅ Unchanged conversations no longer show as "Updated"
- ✅ Import reports are always generated, even if nothing was imported
- ✅ Cancelling an import no longer creates an empty report

### Attachments

- ✅ DALL-E images now display correctly with their prompts
- ✅ Better formatting for images and files in conversations
- ✅ Attachment counts are now accurate in reports
- ✅ Claude artifacts are counted properly in statistics

### User Interface

- ✅ Conversation selection dialog now fits properly on screen
- ✅ Dropdown menus no longer cut off text
- ✅ Folder input fields are now consistent width
- ✅ Settings are preserved during upgrades
- ✅ Upgrade dialogs are wider and easier to read

### Data Integrity

- ✅ Fixed special characters in conversation titles (quotes, brackets, etc.)
- ✅ Fixed conversation metadata corruption issues
- ✅ Fixed artifact date detection for Claude conversations

---

## 🔄 Migration & Upgrade

### What Happens When You Upgrade

When you upgrade to v1.3.0, the plugin automatically:

1. **Updates Your Timestamps**
   - Converts dates to a universal format that works in all languages
   - Shows a progress bar so you know it's working
   - Only updates metadata, never touches your conversation content

2. **Fixes Special Characters**
   - Cleans up conversation titles with quotes, brackets, etc.
   - Prevents errors when opening notes

3. **Adds Missing Dates to Claude Artifacts**
   - Finds the creation date from the conversation
   - Ensures all your artifacts have proper dates

4. **Reorganizes Your Reports Folder**
   - Asks you where you want reports stored
   - Moves all existing reports automatically
   - Updates all links so nothing breaks

### Is It Safe?

**Yes!** The migration is designed to be safe:

- ✅ **Your data is preserved** - Nothing is deleted
- ✅ **You can see progress** - Real-time updates show what's happening
- ✅ **Errors are handled** - If something goes wrong, you'll see a clear message
- ✅ **You get a report** - See exactly what changed

### What You Need to Do

**Almost nothing!** Just:
1. Update the plugin (Settings → Community Plugins)
2. Reload Obsidian
3. When prompted, choose where you want your Reports folder
4. Wait for the automatic migration to finish (usually 1-5 minutes)
5. Done! ✅

---

## 🔧 Under the Hood

**For the curious:** Here's what changed behind the scenes to make everything work better.

- ✅ Cleaner code - removed over 200 lines of unnecessary debug messages
- ✅ Better error messages - when something goes wrong, you'll know why
- ✅ Smarter folder handling - prevents conflicts and data loss
- ✅ Optimized builds - smaller plugin size, faster loading

---

## ⚠️ Known Issues

### Timestamp Format Changes

- **Issue**: Changing message timestamp format only affects new imports
- **Reason**: To avoid modifying existing notes and preserve user data
- **Workaround**: If you want to update existing notes, you'll need to reimport them

### Folder Browser

- **Issue**: Cannot select folders outside the vault
- **Reason**: Obsidian API limitation
- **Workaround**: Use relative paths within your vault

---

## 📝 Upgrade Instructions

### From v1.2.0 to v1.3.0

1. **Backup your vault** (recommended but optional)
2. Update the plugin via Community Plugins
3. Reload Obsidian
4. When prompted, confirm the Reports folder location
5. Wait for automatic migration (progress bar will show status)
6. Review the upgrade report in your Reports folder

### From v1.1.0 or earlier

1. Follow the same steps as above
2. Multiple migrations will run sequentially
3. Each migration has its own progress tracking
4. Total time depends on vault size (typically 1-5 minutes)

---

## 🙏 Support the Project

I'm working on Nexus plugins full-time while unemployed and dealing with health issues. Over 1,000 users so far, but I've received just $10 in donations while paying $200/month in expenses.

**If this plugin makes your life easier, please consider supporting:**

[![Support me on Ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/nexusplugins)

**Suggested amounts:**
- **$5** - Buy me a coffee ☕
- **$25** - Power my AI development tools 🤖
- **$75** - Supercharge my entire dev toolkit 🚀

Even $5 makes a huge difference! 🙏

---

## 📚 Additional Resources

- **Full Documentation**: [README.md](README.md)
- **GitHub Repository**: [superkikim/nexus-ai-chat-importer](https://github.com/Superkikim/nexus-ai-chat-importer)
- **Report Issues**: [GitHub Issues](https://github.com/Superkikim/nexus-ai-chat-importer/issues)
- **Changelog**: See commit history for detailed changes

---

**Thank you for using Nexus AI Chat Importer!** 🎉

