# Release Notes for Nexus AI Chat Importer

## Version 1.3.0 - Major Update: Selective Import & Enhanced User Experience

![Version](https://img.shields.io/badge/version-1.3.0-blue) ![Selective Import](https://img.shields.io/badge/selective_import-enabled-green) ![UX](https://img.shields.io/badge/UX-enhanced-purple)

## Overview

Version 1.3.0 introduces **selective conversation import**, allowing you to choose exactly which conversations to import from your ChatGPT and Claude exports. This release brings major improvements to the import workflow with **interactive conversation selection**, **multi-file processing with automatic deduplication**, **enhanced import reports with per-file statistics**, and **flexible folder management** with separate settings for conversations, attachments, and reports. International users benefit from **ISO 8601 timestamp support** and **locale-independent date parsing**. The release includes comprehensive **DALL-E processing enhancements**, **architecture refinements**, and **26 bug fixes** across import processing, UI formatting, and settings migration.

---

## ☕ Support This Project

**This plugin is free and always will be.** If you find it valuable, please consider supporting its development:

[![Support me on Ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/nexusplugins)

Your support helps me dedicate more time to:
- 🚀 Adding new features
- 🐛 Fixing bugs faster
- 💡 Implementing user suggestions
- 📚 Improving documentation

**Even $5 makes a difference!** 🙏

---

## ⚖️ **LICENSE CHANGE**

### ⚠️ Important: License Update

**Previous versions (≤1.2.0):** MIT License
**Version 1.3.0+:** GNU GPL v3.0

### Why the change?

After **300+ hours of development** and **1000+ downloads**, I'm changing to GPL v3 to:
- Protect this work from commercial exploitation without giving back
- Ensure it remains free and open for everyone
- Allow me to create commercial products for other platforms based on this codebase

### What this means for you:

**As a user:** Nothing changes! The plugin is still:
- ✅ **Free forever**
- ✅ **Open source**
- ✅ **Fully functional**

**As a developer:** If you fork or modify this plugin:
- ✅ You must keep it open source (GPL v3)
- ✅ You must share your improvements
- ✅ You cannot create a closed-source commercial version

### Previous versions

Versions ≤1.2.0 remain under MIT license (already released, can't be revoked). However, **all future development will be GPL v3**.

Thank you for your understanding and continued support! 🙏

See [LICENSE.md](LICENSE.md) for full legal details.

---

### 🚀 **MAJOR NEW FEATURES**

#### **🎯 Selective Conversation Import**
- **Interactive conversation selection**: Choose exactly which conversations to import from your ZIP files
- **Multi-file support**: Select and process multiple ZIP files in a single operation
- **Smart deduplication**: Automatically detects and handles duplicate conversations across multiple files
- **Comprehensive preview**: View conversation details before importing:
  - Title, date, message count
  - Existing status (new, update, or already imported)
  - Attachment information
  - File source tracking
- **Flexible sorting**: Sort conversations by date, title, messages, or status
- **Batch operations**: Select all, deselect all, or cherry-pick specific conversations

#### **📊 Enhanced Import Reports**
- **Per-file statistics**: Detailed breakdown of what was imported from each ZIP file
- **Visual presentation**: Beautiful callouts and tables for better readability
- **Chronological file listing**: Files sorted newest first for easy tracking
- **Comprehensive metrics**:
  - Total conversations analyzed vs. imported
  - Attachment statistics (found/missing/failed)
  - Processing time and performance data
  - Selective import details when applicable

#### **🗂️ Improved Folder Management**
- **Separate folder settings**: Independent configuration for:
  - Conversations folder (where chat notes are stored)
  - Attachments folder (where files and artifacts are saved)
  - Reports folder (where import reports are generated)
- **Automatic migration**: Seamless upgrade from old `archiveFolder` setting
- **Folder change detection**: Warns when changing folders with existing content
- **Smart folder migration**: Option to move existing content when changing locations

### 🔧 **TECHNICAL IMPROVEMENTS**

#### **Internationalization & Standards**
- **ISO 8601 timestamps in frontmatter**: All metadata dates use international standard format
- **Custom message timestamp formats**: Choose your preferred format for message callouts
  - Default: Follows Obsidian's language setting (English = US format)
  - Custom: ISO 8601, US, European, UK, German, or Japanese formats
- **Non-US locale support**: Fixed timestamp parsing issues for international users
- **Consistent date formatting**: Unified date handling across all features
- **Automatic migration**: Existing conversations upgraded to ISO 8601 in frontmatter
- **Note**: Format changes only affect new imports, existing notes remain unchanged

#### **DALL-E Processing Enhancements**
- **Centralized processor**: Unified DALL-E handling logic for better reliability
- **Recursive prompt search**: Improved association between prompts and generated images
- **Dual format support**: Handles both text-based and code-based prompt formats
- **Nested callout structure**: Better visual organization of prompts and images
- **Accurate timestamps**: Uses prompt timestamp for generated images

#### **Architecture Refinements**
- **Provider-agnostic formatters**: Cleaner separation between providers
- **Centralized message filtering**: Removed duplicated logic across codebase
- **Enhanced metadata extraction**: New dedicated service for conversation metadata
- **Improved error handling**: Better logging with conversation and message context

### 🐛 **BUG FIXES**

#### **Import & Processing**
- Fixed Claude detection for older export formats without `projects.json`
- Fixed duplicate conversation handling in multi-ZIP imports
- Fixed existence status calculation after deduplication
- Fixed file statistics tracking during deduplication
- Prevented report generation when import is cancelled
- Fixed timestamp normalization for ZIP file comparisons

#### **UI & Formatting**
- Fixed DALL-E callout encapsulation and indentation
- Cleaned up message spacing in notes (removed blank lines)
- Fixed truncated text in conversation selection dialog
- Fixed YAML frontmatter alias sanitization for special characters
- Fixed title cleaning to handle double quotes properly
- Improved dialog sizing and readability

#### **Settings & Migration**
- Fixed settings overwrite issues during upgrades
- Fixed folder change detection and added cancel option
- Fixed Reports folder migration to same level as Conversations
- Added fallback for conversationFolder in existing conversation scans
- Fixed progress dialog errors during migration

### ✨ **USER EXPERIENCE ENHANCEMENTS**

#### **Dialog Improvements**
- **Modern file selection**: Enhanced multi-file picker with better UX
- **Conversation selection**: Beautiful, responsive table with comprehensive information
- **Import completion**: Detailed summary dialog with statistics and next steps
- **Folder migration**: Clear guidance when changing folder locations
- **Upgrade notices**: Informative dialogs for automatic migrations

#### **Quality of Life**
- **Empty conversation filtering**: Automatically skips conversations with 0 messages
- **Invalid conversation filtering**: Skips conversations with missing IDs or timestamps
- **Always generate reports**: Reports created even when 0 conversations imported
- **Better error messages**: More context in attachment error logging
- **Debug logging**: Comprehensive logging for troubleshooting

### 🔄 **MIGRATION & COMPATIBILITY**

#### **Automatic Migrations (v1.2.0 → v1.3.0)**
1. **Folder settings migration**: Converts `archiveFolder` to separate folder settings
2. **ISO 8601 timestamp migration**: Updates all conversation frontmatter dates
3. **Alias sanitization**: Fixes special characters in frontmatter aliases
4. **Timestamp precision**: Ensures consistent timestamp formatting

#### **Breaking Changes**
- **Settings structure**: `archiveFolder` replaced with `conversationFolder`, `attachmentFolder`, `reportFolder`
- **Date format**: All timestamps now use ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)
- **Report filenames**: Now use `YYYYMMDD-HHMMSS` format instead of slashes

#### **Backward Compatibility**
- Existing conversations remain fully functional
- Old settings automatically migrated on first launch
- No manual intervention required for upgrades

### ⚠️ **IMPORTANT NOTES**

#### **For New Users**
- **Selective import**: You can now choose which conversations to import
- **Multi-file support**: Process multiple ZIP files in one operation
- **Better organization**: Separate folders for conversations, attachments, and reports
- **International support**: Works correctly with all date/time locales

#### **For Existing Users**
- **Automatic upgrade**: Plugin handles all migrations automatically
- **Settings preserved**: Your preferences are maintained and enhanced
- **Folder structure**: Reports folder moved to same level as Conversations folder
- **No data loss**: All existing conversations and attachments remain intact

#### **Performance Considerations**
- Large ZIP files (1000+ conversations) may take time to analyze
- Conversation selection dialog loads all conversations for preview
- Deduplication across multiple files adds processing time
- Progress dialogs show real-time status for long operations

### 📋 **WHAT'S NEXT**

Version 1.3.0 establishes a **mature, user-friendly import workflow**:
- ✅ **Selective import**: Full control over what gets imported
- ✅ **Multi-file support**: Batch processing with deduplication
- ✅ **International standards**: ISO 8601 timestamps and locale support
- ✅ **Enhanced UX**: Beautiful dialogs and comprehensive reports
- 🔮 **Future enhancements**: Additional providers, advanced filtering, bulk operations

---

## Version 1.2.0 - Major Update: Claude Support & Enhanced UI

![Version](https://img.shields.io/badge/version-1.2.0-blue) ![Claude](https://img.shields.io/badge/Claude-supported-purple) ![UI](https://img.shields.io/badge/UI-enhanced-green)

### 🚀 **MAJOR NEW FEATURES**

#### **🎉 Full Claude Support Added**
- **Complete Claude conversation import**: Import your Claude.ai conversations for the first time!
- **Claude artifact versioning**: Each artifact modification creates a separate file (`script_v1.md`, `script_v2.md`, etc.)
- **Smart content tracking**:
  - `create` commands start new artifacts with full content
  - `rewrite` commands create new complete versions
  - `update` commands apply incremental changes to previous versions
- **Chronological processing**: Artifacts processed in conversation order for accurate version progression
- **Claude attachment support**: Handles file references with links to original conversations

#### **🎨 Revolutionary UI with Custom Callouts**
- **Nexus custom callouts**: Replaced ugly indentations with beautiful, themed callouts
- **Role-specific styling**:
  - 👤 **User messages**: Blue callouts with user icon
  - 🤖 **Assistant messages**: Green callouts with bot icon
  - 📎 **Attachments**: Amber callouts with paperclip icon
  - ✨ **Artifacts**: Purple callouts with sparkles icon
  - 🪄 **DALL-E Prompts**: Red callouts with magic wand icon
- **Better readability**: Clean, modern presentation that adapts to your Obsidian theme
- **Functional links**: Markdown links work perfectly inside callouts

#### **⚡ Performance Optimizations**
- **50%+ faster ChatGPT processing**: Major optimizations for large conversation imports
- **Optimized mapping traversal**: Reduced iterations by 50% through smart caching
- **Pre-compiled regex patterns**: Faster message content processing
- **Smart sorting algorithms**: Insertion sort for small datasets, optimized for mostly-sorted data

### 🔧 **Technical Improvements**

#### **Provider Selection Workflow**
- **Automatic provider detection**: Smart detection of ChatGPT vs Claude exports
- **Manual override option**: Force provider selection when auto-detection fails
- **Better error handling**: Clear feedback when ZIP format is unrecognized

#### **Enhanced Processing Architecture**
- **Conversation-level processing**: Full conversation analysis for better context
- **Persistent content tracking**: Artifact content properly accumulates across conversations
- **Smart update handling**: Filters out empty UI-only updates while preserving meaningful changes
- **Chronological message ordering**: Fixed Claude message ordering issues

#### **Reimport Safety**
- **Version UUID tracking**: Prevents duplicate versions when reimporting conversations
- **Incremental updates**: New artifact versions added without affecting existing files
- **Stable numbering**: Version numbers remain consistent across multiple imports

### 🐛 **Bug Fixes**
- **Fixed ChatGPT code block detection**: JSON strings in message parts now properly converted to code blocks
- **Restored DALL-E prompts**: Prompts now display in dedicated callouts instead of being hidden
- **Fixed Claude message ordering**: Messages now appear in correct chronological order
- **Improved link handling**: Proper vault-relative paths for all artifact and attachment links
- **Better ZIP file caching**: Optimized attachment extraction with cache management

### 🎯 **Enhanced User Experience**
- **Version-specific artifact links**: Each artifact reference links to its exact version with "View Artifact" text
- **Improved visual hierarchy**: Clear distinction between different content types
- **Better attachment status**: Clear indicators for found/missing/failed attachments
- **Cleaner conversation layout**: No more messy indentations, everything in organized callouts

### ⚠️ **Important Notes**

#### **For New Users**
- **Claude support**: You can now import Claude conversations alongside ChatGPT
- **Modern UI**: All conversations use the new callout system for better readability
- **Performance**: Large conversation imports are significantly faster

#### **For Existing Users**
- **Automatic upgrade**: Existing ChatGPT conversations remain functional
- **UI improvements**: New imports will use the enhanced callout system
- **NEW: Claude support**: You can now import Claude conversations for the first time!
- **Settings preserved**: All your existing settings are maintained

#### **File Structure Changes**
- **Claude artifacts**: Saved in `Attachments/claude/artifacts/{conversation_id}/` with version numbers
- **Callout styling**: Custom CSS classes for Nexus callouts (automatically applied)
- **Legacy support**: Old div-based styling still works but new callouts are recommended

### 🔄 **Migration Guide**

#### **From v1.1.0 to v1.2.0**
1. **No action required**: Plugin automatically upgrades
2. **Claude users**: Can now import conversations for the first time
3. **UI benefits**: New imports automatically use enhanced callouts
4. **Performance**: Enjoy faster processing on large ChatGPT exports

#### **Recommended Actions**
- **Test Claude import**: Try importing a Claude conversation to see the new features
- **Reimport large ChatGPT files**: Benefit from 50%+ performance improvements
- **Check callout styling**: Verify the new UI looks good with your Obsidian theme

### 🎯 **What's Next**

This major release establishes Nexus AI Chat Importer as a **multi-provider platform**:
- ✅ **ChatGPT**: Full support with attachments and optimizations
- ✅ **Claude**: Complete support with artifacts and versioning
- 🔮 **Future providers**: Architecture ready for additional AI platforms

---

## Version 1.1.0 - Attachment Support

![Version](https://img.shields.io/badge/version-1.1.0-blue)

[View Full README](https://github.com/Superkikim/nexus-ai-chat-importer/blob/1.1.0/README.md)

## Overview

Version 1.1.0 adds comprehensive attachment support to the plugin. ChatGPT conversations now import with their associated files, including DALL-E generated images, documents, and other attachments when available in the export archive.

## New Features

### Attachment Import System

- Import images, documents, and files from ChatGPT exports
- DALL-E generated images are automatically detected and imported
- Files are organized in `Attachments/chatgpt/images/` and `Attachments/chatgpt/documents/`
- Generation prompts are preserved with DALL-E images
- Status tracking shows which files were found, missing, or failed to import

### Import Reports

- Reports are now organized in `Reports/chatgpt/` folder
- Attachment statistics display: ✅ found, ⚠️ partial, ❌ missing
- Report names include dates extracted from ZIP filenames

### Reprocess Existing Conversations

- Option to reprocess conversations imported before v1.1.0
- Adds attachment support to previously imported notes
- Automatic detection when reimporting already processed files

## Improvements

### Settings

- Toggle to enable/disable attachment import
- Configurable attachment folder location
- Options for handling missing files
- Control over attachment statistics in reports

### Report Content

- Focus on new and updated conversations
- Cleaner statistics without unnecessary information
- Better organization of import results

## Fixes

### Performance

- Resolved startup performance issue affecting users with large conversation collections
- Eliminated file scanning that was slowing Obsidian launch

## Technical Details

### Architecture Changes

- Provider-agnostic framework for future AI chat platform support
- Modular settings interface with organized sections
- Enhanced error handling and type safety

### File Processing

- ZIP-wide file search using ChatGPT file identifiers
- Conflict resolution for duplicate filenames
- Memory-optimized processing

### Message Processing

- Improved filtering of ChatGPT internal messages
- Better handling of DALL-E content in conversations
- Enhanced content extraction from complex message structures

## Migration Notes

### For Existing Users

- All existing conversations remain functional
- Settings are preserved with new attachment options added
- No manual migration required

### Storage Considerations

- Attachment import increases vault size
- Consider excluding attachment folder from cloud sync for large collections
- Attachment processing is optional and can be disabled

## Compatibility

### File Formats

- Supports both old and new ChatGPT export formats
- Automatic conversion of legacy .dat files to correct extensions
- Handles image attachments

### Breaking Changes

- Import reports now use provider-specific subfolders
- Internal API changes for provider-specific logic (affects developers only)

## Future Development

This release establishes the foundation for:

- Support for additional AI chat platforms
- Enhanced content analysis and filtering
- Batch operations on imported conversations

**Full Changelog**: https://github.com/Superkikim/nexus-ai-chat-importer/compare/1.0.8…1.1.0