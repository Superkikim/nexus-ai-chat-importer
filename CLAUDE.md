# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Nexus AI Chat Importer** is an Obsidian plugin that imports AI chat conversations (ChatGPT and Claude) as beautifully formatted Markdown files with full attachment support, metadata preservation, and intelligent deduplication.

- **Current Version**: 1.6.0
- **License**: GPL-3.0-or-later
- **Author**: Akim Sissaoui (Superkikim)
- **Minimum Obsidian**: 0.15.0

## Development Commands

### Building

```bash
# Development build with watch mode and sourcemaps
npm run dev

# Production build (optimized, no sourcemaps)
npm run build

# Build with type checking
npm run build-with-check

# Type check only (no compilation)
npm run type-check

# iOS-specific build
npm run ios-build
```

### Linting and Formatting

```bash
# Run ESLint (must be run manually - no npm script)
npx eslint src/

# Format with Prettier (must be run manually - no npm script)
npx prettier --write src/
```

### Testing

**Note**: There is no formal test framework configured. Two test files exist in `src/tests/` for reference but cannot be run with a test runner.

## High-Level Architecture

### Core Design Pattern: Provider Adapter System

The plugin uses a **provider adapter pattern** to support multiple AI chat services. All providers convert to a standardized format before processing:

```
Provider-Specific Format → ProviderAdapter → StandardConversation → Formatters → Markdown
```

**Key Interfaces**:
- `ProviderAdapter<TChat>` - Contract for all provider implementations ([src/providers/provider-adapter.ts](src/providers/provider-adapter.ts))
- `StandardConversation` - Unified conversation format ([src/types/standard.ts](src/types/standard.ts))
- `StandardMessage` - Unified message format ([src/types/standard.ts](src/types/standard.ts))

### Service Layer Architecture

The application follows a clear service-oriented architecture:

**Import Pipeline**:
1. **ImportService** ([src/services/import-service.ts](src/services/import-service.ts)) - Orchestrates the entire import workflow
2. **ProviderAdapter** (ChatGPT/Claude) - Detects and converts provider-specific format
3. **ConversationProcessor** ([src/services/conversation-processor.ts](src/services/conversation-processor.ts)) - Processes individual conversations
4. **FileService** ([src/services/file-service.ts](src/services/file-service.ts)) - Handles vault file operations
5. **StorageService** ([src/services/storage-service.ts](src/services/storage-service.ts)) - Manages conversation catalog/metadata

**Supporting Services**:
- **AttachmentMapBuilder** ([src/services/attachment-map-builder.ts](src/services/attachment-map-builder.ts)) - Builds unified attachment index from multiple ZIP files
- **ConversationMetadataExtractor** ([src/services/conversation-metadata-extractor.ts](src/services/conversation-metadata-extractor.ts)) - Lightweight conversation analysis for selection dialog
- **LinkUpdateService** ([src/services/link-update-service.ts](src/services/link-update-service.ts)) - Updates wikilinks when files are moved/renamed

### Dialog-Driven User Flow

The plugin uses a progressive disclosure workflow through modal dialogs:

1. **ProviderSelectionDialog** - Choose ChatGPT or Claude
2. **EnhancedFileSelectionDialog** - Select ZIP file(s) + import mode (all/selective)
3. **ConversationSelectionDialog** - Choose specific conversations (selective mode only)
4. **ImportProgressModal** - Real-time import feedback
5. **Completion Notice** - Summary with report link

All dialogs extend Obsidian's `Modal` class and follow consistent UX patterns.

### Upgrade System

**Incremental Version Upgrades** ([src/upgrade/](src/upgrade/)):

The plugin includes a sophisticated upgrade system that manages data migrations between versions:

- **IncrementalUpgradeManager** ([src/upgrade/incremental-upgrade-manager.ts](src/upgrade/incremental-upgrade-manager.ts)) - Orchestrates sequential upgrades
- **Version-specific upgrades** in `src/upgrade/versions/` (e.g., `upgrade-1.3.0.ts`)
- **State tracking** to prevent re-running completed upgrades
- **Fresh install detection** to show welcome dialog only for new users

Each upgrade can migrate data, reorganize folders, and update metadata schemas. The system runs automatically on plugin load.

## Code Organization

### Critical Entry Points

- **[src/main.ts](src/main.ts)** - Plugin class, lifecycle hooks, command registration
- **[src/commands/command-registry.ts](src/commands/command-registry.ts)** - All Obsidian commands
- **[src/events/event-handlers.ts](src/events/event-handlers.ts)** - Event lifecycle management

### Provider Implementations

**ChatGPT Provider** ([src/providers/chatgpt/](src/providers/chatgpt/)):
- `chatgpt-adapter.ts` - Main adapter implementation
- `chatgpt-converter.ts` - Converts ChatGPT JSON to StandardConversation
- `chatgpt-dalle-processor.ts` - Processes DALL-E images with prompts
- `chatgpt-message-filter.ts` - Deduplicates messages (ChatGPT exports contain duplicates)
- `chatgpt-attachment-extractor.ts` - Extracts images and documents

**Claude Provider** ([src/providers/claude/](src/providers/claude/)):
- `claude-adapter.ts` - Main adapter implementation
- `claude-converter.ts` - Converts Claude JSON to StandardConversation
- `claude-attachment-extractor.ts` - Extracts attachments and artifacts
- `claude-types.ts` - Claude-specific TypeScript types

**Provider Registry** ([src/providers/provider-registry.ts](src/providers/provider-registry.ts)):
- Factory pattern for provider instantiation
- Auto-detection by testing each provider's `detect()` method
- Extensible for future providers (Mistral, Gemini, etc.)

### Formatters

**Message Formatting** ([src/formatters/message-formatter.ts](src/formatters/message-formatter.ts)):
- Converts StandardMessage to Markdown with custom callouts
- Handles nested content (code blocks, artifacts, images)
- Generates message IDs for deduplication

**Note Formatting** ([src/formatters/note-formatter.ts](src/formatters/note-formatter.ts)):
- Creates complete conversation notes with frontmatter
- Generates YAML metadata (conversation_id, timestamps, etc.)
- Formats provider-specific features (DALL-E prompts, Claude artifacts)

### Type System

**Core Types** ([src/types/](src/types/)):
- `plugin.ts` - PluginSettings, command types
- `standard.ts` - StandardConversation, StandardMessage, StandardAttachment
- `conversation-selection.ts` - Selection dialog types
- `index.ts` - Barrel export for all types

**Important**: All timestamps in frontmatter use **ISO 8601 UTC format** (`2024-01-15T14:30:22.000Z`) for universal compatibility and Dataview queries.

## Important Development Patterns

### Adding a New Provider

1. Create new directory: `src/providers/<provider-name>/`
2. Implement `ProviderAdapter<TChat>` interface
3. Create converter to `StandardConversation` format
4. Handle provider-specific attachments (if any)
5. Register in `ProviderRegistry`
6. Add to provider selection dialog

**Example structure**:
```typescript
// src/providers/mistral/mistral-adapter.ts
export class MistralAdapter implements ProviderAdapter<MistralChat> {
  detect(rawConversations: any[]): boolean {
    // Detection logic
  }

  convertChat(chat: MistralChat): StandardConversation {
    // Conversion to standard format
  }

  // ... implement all interface methods
}
```

### Modifying Import Behavior

**Key files to understand**:
1. [src/services/import-service.ts](src/services/import-service.ts) - Overall orchestration
2. [src/services/conversation-processor.ts](src/services/conversation-processor.ts) - Individual conversation processing
3. Provider-specific adapters - Format conversion

**Common modifications**:
- **Add metadata field**: Update `StandardConversation` type and formatters
- **Change file structure**: Modify `FileService.getConversationPath()`
- **Custom attachment handling**: Extend provider's attachment extractor

### Working with Obsidian Vault

**CRITICAL**: Always use `FileService` methods, never direct Node.js `fs` module:

```typescript
// ❌ WRONG - Don't use Node.js fs
import fs from 'fs';
fs.writeFileSync(path, content);

// ✅ CORRECT - Use FileService
await this.fileService.createOrUpdateFile(path, content);
```

**Why**: `FileService` uses Obsidian's Vault API which respects excluded folders, sync settings, and triggers proper vault events.

### Storage Service Usage

**StorageService** ([src/services/storage-service.ts](src/services/storage-service.ts)) maintains a catalog of imported conversations:

```typescript
// Record imported conversation
await this.storageService.recordConversation(
  conversation.id,
  conversation.updateTime,
  filePath,
  messageIds
);

// Check if conversation needs update
const stored = await this.storageService.getConversation(id);
if (stored && stored.updateTime >= conversation.updateTime) {
  // Skip unchanged conversation
}
```

**Important**: The catalog is stored in `.obsidian/plugins/nexus-ai-chat-importer/data.json` and must be maintained for deduplication to work.

### Link Updates When Moving Files

When reorganizing folders, use **LinkUpdateService** ([src/services/link-update-service.ts](src/services/link-update-service.ts)) to preserve wikilinks:

```typescript
await this.linkUpdateService.updateLinksInVault(
  oldPath,  // Old file path
  newPath   // New file path
);
```

This updates all references across the vault, including links within conversation notes and Claude artifact files.

### Upgrade Development

When creating a new major version upgrade:

1. Create new file: `src/upgrade/versions/upgrade-X.Y.Z.ts`
2. Implement `Upgrade` interface
3. Add to upgrade chain in `IncrementalUpgradeManager`

**Template**:
```typescript
export class Upgrade_X_Y_Z implements Upgrade {
  version = "X.Y.Z";

  async needsUpgrade(settings: PluginSettings): Promise<boolean> {
    // Check if upgrade needed
  }

  async performUpgrade(context: UpgradeContext): Promise<UpgradeResult> {
    // Perform migration
    // Use context.progressModal for user feedback
    return { success: true };
  }
}
```

## Configuration and Settings

### Plugin Settings Schema

All settings are defined in [src/types/plugin.ts](src/types/plugin.ts):

**User-Facing Settings**:
- `conversationFolder` - Where conversation notes are saved
- `reportFolder` - Where import reports are saved
- `attachmentFolder` - Where images/documents/artifacts are stored
- `addDatePrefix` - Add date to conversation filenames
- `dateFormat` - Filename date format (YYYY-MM-DD vs YYYYMMDD)
- `useCustomMessageTimestampFormat` - Enable custom message timestamps
- `messageTimestampFormat` - Format for timestamps in messages

**Internal Settings**:
- `currentVersion` / `previousVersion` - Version tracking for upgrades
- `completedUpgrades` - List of completed upgrade versions
- `lastConversationsPerPage` - UI state persistence

### Default Values

Defaults are defined in [src/config/default-settings.ts](src/config/default-settings.ts):

```typescript
conversationFolder: "Nexus/Conversations"
reportFolder: "Nexus/Reports"
attachmentFolder: "Nexus/Attachments"
addDatePrefix: false
dateFormat: "YYYY-MM-DD"
```

### File Organization Pattern

**Conversations**:
```
<conversationFolder>/<provider>/<YYYY>/<MM>/<filename>.md
```

**Attachments**:
```
<attachmentFolder>/<provider>/images/<filename>
<attachmentFolder>/<provider>/documents/<filename>
<attachmentFolder>/<provider>/artifacts/<conversation-id>/<artifact>_v<n>.<ext>
```

**Reports**:
```
<reportFolder>/<provider>/<YYYYMMDD-HHMMSS> - import report.md
```

## Build System

### esbuild Configuration

**Build script**: [esbuild.config.mjs](esbuild.config.mjs)

**Build modes**:
- `npm run dev` - Development with watch, sourcemaps, no minification
- `npm run build` - Production with minification, no sourcemaps
- `npm run ios-build` - iOS-specific variant

**Key settings**:
- Entry: `src/main.ts`
- Output: `dist/main.js` (CommonJS format)
- External modules: `obsidian`, `@codemirror/*`, `@electron/*`
- Bundles all other dependencies (jszip, etc.)
- Copies `manifest.json` and `styles.css` to dist

### TypeScript Configuration

**tsconfig.json**:
- Target: ES2018
- Module: CommonJS (required by Obsidian)
- Strict mode enabled
- No emit (esbuild handles compilation)
- Source maps: inline in dev mode

## Common Pitfalls and Solutions

### Date/Time Handling

**Problem**: Different locales format dates differently, causing parsing issues.

**Solution**:
- Store all dates in **ISO 8601 UTC** format in frontmatter
- Use configurable display formats only for message timestamps
- Always use `new Date(timestamp).toISOString()` for storage
- Use locale-specific formatting only for display

### Attachment Path Resolution

**Problem**: Attachments in ZIP files use various path formats across providers.

**Solution**:
- Use `AttachmentMapBuilder` to create unified attachment index
- Handle both absolute and relative paths from ZIP
- Normalize paths before lookup: `path.normalize(attachment.file_name)`

### Message Deduplication

**Problem**: ChatGPT exports contain duplicate messages in the JSON structure.

**Solution**:
- Use `ChatGPTMessageFilter.filterDuplicateMessages()` before conversion
- Generate consistent message IDs: `<!-- msg-id: <hash> -->`
- Compare message IDs when detecting updates

### Vault File Race Conditions

**Problem**: Multiple file operations can conflict in Obsidian.

**Solution**:
- Always `await` vault operations
- Process conversations sequentially, not in parallel
- Use `FileService` methods which handle Obsidian-specific locking

### Plugin Upgrades Breaking User Data

**Problem**: Schema changes can corrupt existing conversation files.

**Solution**:
- Never modify existing frontmatter fields (add new ones instead)
- Use upgrade system to migrate data when schema changes
- Always preserve user content (messages, manual edits)
- Test upgrades on copy of real vault data

## License Compliance

This project is licensed under **GPL-3.0-or-later**. When contributing or creating derivative works:

- Any modifications must also be GPL-3.0
- Source code must be made available
- Commercial derivatives must also be open source
- Include proper license headers in new files

See [LICENSE.md](LICENSE.md) for full text.
