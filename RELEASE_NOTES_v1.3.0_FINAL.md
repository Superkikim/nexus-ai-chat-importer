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

- ✅ Redesigned Settings UI with better organization
- ✅ Wider folder path inputs for better readability
- ✅ Improved dialog sizing and spacing
- ✅ Better visual hierarchy in reports
- ✅ Enhanced progress tracking with time estimates
- ✅ Clearer migration dialogs with simplified text

### Performance

- ✅ Optimized timestamp comparison (ignores seconds for v1.2.0 → v1.3.0 compatibility)
- ✅ Batch processing for large migrations
- ✅ Reduced console noise (removed debug logs)
- ✅ Faster folder operations with vault.rename()

### Reports

- ✅ ISO 8601 format in report frontmatter
- ✅ Per-file statistics in import reports
- ✅ Chronological sorting (newest first)
- ✅ Duplicate count in completion dialog
- ✅ Better visual presentation with callouts and tables

### Developer Experience

- ✅ Removed debugger statements in production builds
- ✅ Better error logging with context
- ✅ Comprehensive TypeScript type safety
- ✅ Cleaner codebase with removed dead code

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

- ✅ Filter out empty conversations (0 messages)
- ✅ Filter out invalid conversations (missing IDs or timestamps)
- ✅ Skip conversations with no new messages instead of counting as updated
- ✅ Prevent report generation when import is cancelled
- ✅ Always generate report even when 0 conversations imported
- ✅ Normalize ZIP timestamps before comparison

### Attachments

- ✅ Restore DALL-E attachment handling from v1.2.0
- ✅ Fix DALL-E callout encapsulation and indentation
- ✅ Fix file statistics tracking during deduplication
- ✅ Count artifacts as attachments in statistics
- ✅ Nest attachment callouts inside message callouts

### UI/UX

- ✅ Fix conversation selection dialog sizing
- ✅ Fix truncated text in sort dropdown
- ✅ Fix folder input width consistency
- ✅ Prevent settings overwrite during migration
- ✅ Fix upgrade modal width not applying correctly

### Data Integrity

- ✅ Fix YAML frontmatter alias sanitization for special characters
- ✅ Fix title cleaning to handle double quotes
- ✅ Normalize plugin_version with quotes in artifacts
- ✅ Always update plugin_version during migration
- ✅ Fix artifact date extraction regex for multi-line callouts

---

## 🔄 Migration & Upgrade

### Automatic Migrations

When you upgrade to v1.3.0, the plugin automatically performs these operations:

1. **Convert Timestamps to ISO 8601**
   - Converts all frontmatter timestamps to universal format
   - Supports all date formats (US, EU, DE, JP, ISO)
   - Batch processing with progress tracking
   - Only modifies frontmatter, never touches note body

2. **Fix Frontmatter Aliases**
   - Sanitizes special characters in aliases
   - Ensures YAML compatibility
   - Prevents parsing errors

3. **Add Missing create_time to Artifacts**
   - Extracts from first message timestamp
   - Fallback to conversation create_time
   - Ensures all artifacts have proper metadata

4. **Configure Folder Locations**
   - Prompts for Reports folder location
   - Validates folder nesting (prevents conflicts)
   - Moves existing reports automatically
   - Updates all links in artifacts

### Migration Safety

- ✅ **Non-destructive**: Original data is preserved
- ✅ **Reversible**: Can downgrade if needed (though not recommended)
- ✅ **Progress tracking**: Real-time feedback during migration
- ✅ **Error handling**: Graceful fallbacks if issues occur
- ✅ **Detailed reports**: See exactly what changed

### What You Need to Do

**Nothing!** Just:
1. Update the plugin
2. Reload Obsidian
3. Confirm the Reports folder location when prompted
4. Wait for automatic migration to complete

---

## 🔧 Technical Changes

### Architecture

- Refactored folder management with centralized validation
- Simplified migration system with blocking dialogs
- Provider-agnostic attachment handling
- Centralized message filtering and processing

### Code Quality

- Removed 214+ lines of debug logs
- Removed dead code and duplicated logic
- Better TypeScript type safety
- Comprehensive error handling

### Build System

- Added `drop: ["debugger"]` to remove debugger statements in production
- Added `keepNames: true` to preserve function/class names
- Optimized build output

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

