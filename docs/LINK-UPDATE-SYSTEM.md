# Link Update System

## Overview

The Link Update System automatically updates attachment and conversation links when folder paths are changed in settings. This prevents broken links when users reorganize their folder structure.

## Features

### 🔗 Automatic Link Updates
- **Attachment Links**: Updates all attachment references when attachment folder path changes
- **Conversation Links**: Updates all conversation references in reports when conversation folder path changes
- **Progress Tracking**: Real-time progress display with estimated completion time
- **Batch Processing**: Processes files in batches to prevent UI blocking

### 📊 Progress Information
- Shows estimated time based on file count
- Displays current progress with detailed status
- Provides completion summary with statistics

### 🎯 Supported Link Formats

#### Attachment Links (in conversations)
- Markdown images: `![alt](path/to/attachment.png)`
- Markdown links: `[text](path/to/attachment.pdf)`
- Obsidian image embeds: `![[path/to/attachment.jpg]]`
- Obsidian file links: `[[path/to/attachment.md]]`

#### Conversation Links (in reports)
- Obsidian links with aliases: `[[path/to/conversation.md|Title]]`
- Simple Obsidian links: `[[path/to/conversation.md]]`

## Implementation

### Core Components

#### 1. LinkUpdateService (`src/services/link-update-service.ts`)
- Scans and updates links in conversation and report files
- Provides progress callbacks for UI updates
- Handles batch processing with configurable batch sizes
- Includes error handling and statistics tracking

#### 2. EnhancedFolderMigrationDialog (`src/dialogs/enhanced-folder-migration-dialog.ts`)
- Extended version of the original folder migration dialog
- Shows link update information and time estimates
- Integrates with progress modal for real-time updates
- Handles both file movement and link updates

#### 3. Integration with Settings (`src/ui/settings/folder-settings-section.ts`)
- Automatically uses enhanced dialog for attachment and conversation folders
- Falls back to standard dialog for report folders (no link updates needed)
- Maintains backward compatibility

### Performance Characteristics

- **Small vaults** (< 50 conversations): 2-5 seconds
- **Medium vaults** (50-200 conversations): 10-20 seconds  
- **Large vaults** (200+ conversations): 30-60 seconds

### Batch Processing
- **Conversations**: 10 files per batch
- **Reports**: 5 files per batch (typically fewer files)
- **Delay**: 10ms between batches to prevent UI blocking

## User Experience

### Enhanced Dialog Flow

1. **Information Phase**
   - Shows old and new folder paths
   - Displays estimated file count and processing time
   - Explains what link updates will occur

2. **Progress Phase** (if user chooses to move)
   - Real-time progress bar
   - Current operation status
   - File processing details

3. **Completion Phase**
   - Summary of changes made
   - Statistics on links updated
   - Success/error notifications

### Example User Messages

```
🔗 Link Updates:
Moving attachments will also update 45 conversation files to fix attachment links.
Estimated time: ~15 seconds
```

```
✅ Files moved to NewFolder/Attachments and 156 links updated successfully
```

## Technical Details

### Regex Patterns

#### Attachment Links
```javascript
// Markdown image links: ![alt](path)
const imagePattern = new RegExp(`(!\\[[^\\]]*\\]\\()${escapedOldPath}(/[^)]+\\))`, 'g');

// Obsidian embeds: ![[path]]
const obsidianImagePattern = new RegExp(`(!\\[\\[)${escapedOldPath}(/[^\\]]+\\]\\])`, 'g');
```

#### Conversation Links
```javascript
// Links with aliases: [[path|title]]
const linkWithAliasPattern = new RegExp(`(\\[\\[)${escapedOldPath}(/[^|\\]]+)(\\|[^\\]]+\\]\\])`, 'g');

// Simple links: [[path]]
const simpleLinkPattern = new RegExp(`(\\[\\[)${escapedOldPath}(/[^\\]]+\\]\\])`, 'g');
```

### Error Handling
- Individual file errors don't stop the entire process
- Error statistics are tracked and reported
- Failed operations are logged for debugging

### Safety Features
- Path escaping prevents regex injection
- Batch processing prevents UI freezing
- Progress callbacks allow user cancellation
- Comprehensive logging for troubleshooting

## Testing

The system includes comprehensive pattern testing to ensure link updates work correctly across all supported formats. Tests verify:

- Markdown link formats
- Obsidian link formats  
- Path escaping
- Batch processing logic
- Progress tracking accuracy

## Future Enhancements

- **Undo functionality**: Allow reverting link updates
- **Selective updates**: Let users choose which files to update
- **Preview mode**: Show what changes will be made before applying
- **Custom patterns**: Support for additional link formats
