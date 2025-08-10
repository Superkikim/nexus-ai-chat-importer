# Release Notes for Nexus AI Chat Importer

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
- **Automatic upgrade**: Existing conversations remain functional
- **UI improvements**: New imports will use the enhanced callout system
- **Reimport recommended**: Consider reimporting Claude conversations to benefit from new features
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