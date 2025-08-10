# Release Notes for Nexus AI Chat Importer

## Version 1.2.0 - Claude Artifact Versioning (🚧 In Development)

### 🎯 New Features

#### **Claude Artifact Versioning**
- **Complete version history**: Each artifact modification creates a separate file (`script_v1.md`, `script_v2.md`, etc.)
- **Smart content tracking**:
  - `create` commands start new artifacts with full content
  - `rewrite` commands create new complete versions
  - `update` commands apply incremental changes to previous versions
- **Chronological processing**: Artifacts processed in conversation order for accurate version progression

#### **Enhanced User Experience**
- **Version-specific links**: Each artifact reference in conversations links to its exact version
- **Improved attachment links**: Claude conversation links now properly clickable in Obsidian
- **Better visual integration**: Cleaner presentation using Obsidian's note callout system

### 🔧 Technical Improvements

#### **Robust Processing Architecture**
- **Conversation-level processing**: Moved from message-by-message to full conversation analysis
- **Persistent content tracking**: Artifact content properly accumulates across entire conversations
- **Smart update handling**: Filters out empty UI-only updates while preserving meaningful changes

#### **Reimport Safety**
- **Version UUID tracking**: Prevents duplicate versions when reimporting updated conversations
- **Incremental updates**: New artifact versions added without affecting existing files
- **Stable numbering**: Version numbers remain consistent across multiple imports

### 🐛 Bug Fixes
- **Fixed Obsidian reading mode**: Attachment boxes now render correctly in all viewing modes
- **Resolved file conflicts**: Eliminated "File already exists" errors during artifact processing
- **Improved link handling**: Proper vault-relative paths for all artifact and attachment links

### ⚠️ Important Notes
- **Existing Claude conversations**: May need to be reimported to benefit from new versioning system
- **File structure changes**: Artifacts now saved in conversation-specific folders with version numbers

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