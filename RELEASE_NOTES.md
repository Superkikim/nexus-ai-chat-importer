# Release Notes for Nexus AI Chat Importer

## Version 1.2.0 - Advanced Claude Artifact Versioning (In Development)

### 🎯 Major Features

#### **Complete Claude Artifact Versioning System**
- **Individual version files**: Each artifact version now gets its own file (e.g., `script_v1.md`, `script_v2.md`)
- **Proper command handling**:
  - `create`: Initial version with complete content
  - `rewrite`: New complete version (resets content)
  - `update`: Applies sed-like replacements (`old_str` → `new_str`) to previous version
- **Cumulative content tracking**: Updates build upon previous versions correctly
- **Chronological processing**: Artifacts processed in conversation order for accurate versioning

#### **Smart Conversation-Level Processing**
- **Architecture rewrite**: Moved from message-by-message to conversation-level artifact processing
- **Persistent content tracking**: Artifact content properly accumulates across entire conversation
- **Version-specific links**: Each artifact reference links to its specific version (not "latest")

#### **Enhanced Link System**
- **Specific version links**: `Artifact: script_name v2` instead of generic "Latest Version"
- **Note callouts**: Using `>[!note]` format for better Obsidian integration
- **Proper path handling**: Correct vault-relative paths for all artifact links

### 🔧 Technical Improvements

#### **Robust Update Handling**
- **Empty update filtering**: Skips UI-only updates with no content changes
- **Replacement logic**: Proper `old_str`/`new_str` replacement for incremental updates
- **Content validation**: Ensures all versions have meaningful content differences

#### **Reimport Compatibility**
- **Version UUID tracking**: Prevents duplicate versions on conversation updates
- **Incremental updates**: New artifact versions added without affecting existing ones
- **Consistent numbering**: Version numbers remain stable across reimports

### 🐛 Bug Fixes
- **Fixed attachment links**: External Claude conversation links now properly clickable
- **Corrected div rendering**: Obsidian reading mode compatibility for attachment boxes
- **Resolved version conflicts**: Eliminated "File already exists" errors during processing

### 📋 Breaking Changes
- **Artifact structure**: New versioned file structure may require reimporting existing Claude conversations
- **Link format**: Artifact links now point to specific versions rather than generic references

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