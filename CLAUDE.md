# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Nexus AI Chat Importer** is an Obsidian plugin that imports AI chat conversations (ChatGPT, Claude, Mistral Vibe, Perplexity) as beautifully formatted Markdown files with full attachment support, metadata preservation, and intelligent deduplication.

- **Current Version**: 1.6.8
- **License**: GPL-3.0-or-later
- **Author**: Akim Sissaoui (Superkikim)
- **Minimum Obsidian**: 1.4.0

## Development Commands

### Building

```bash
npm run build              # Production build
npm run build-with-check   # Type check + production build
npm run type-check         # Type check only (no compilation)
npm run dev                # Development build with watch mode
```

### Linting and Formatting

```bash
npx eslint src/            # Run ESLint (check)
npx eslint --fix src/      # Auto-fix Prettier/ESLint issues
npm run check:docs-links   # Validate documentation URLs
```

### Testing

```bash
npm run test:run           # Run all tests (vitest)
npm run test:coverage      # Run tests with coverage report
npm run test               # Interactive test UI
```

**174 tests** across 24 test files. Tests live alongside source files as `*.test.ts`.

## Pre-Commit Checklist

**Always run before committing:**

```bash
npm run test:run           # All 174 tests must pass
npx eslint src/            # Zero errors on modified files
npm run build              # Build must succeed
```

Fix any Prettier/ESLint issues with `npx eslint --fix src/<file>` before committing.

**Commit discipline**: Make **granular commits** as work progresses — one logical change per commit. Do not batch unrelated changes. Use standard prefixes: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`.

## High-Level Architecture

### Core Design Pattern: Provider Adapter System

All providers convert to a standardized format before processing:

```
Provider-Specific Format → ProviderAdapter → StandardConversation → Formatters → Markdown
```

**Key Interfaces**:
- `ProviderAdapter<TChat>` - Contract for all provider implementations ([src/providers/provider-adapter.ts](src/providers/provider-adapter.ts))
- `StandardConversation` / `StandardMessage` / `StandardAttachment` - Unified formats ([src/types/standard.ts](src/types/standard.ts))

### Service Layer Architecture

**Import Pipeline**:
1. **ImportService** ([src/services/import-service.ts](src/services/import-service.ts)) - Orchestrates the entire import workflow
2. **ProviderAdapter** - Detects and converts provider-specific format
3. **ConversationProcessor** ([src/services/conversation-processor.ts](src/services/conversation-processor.ts)) - Processes individual conversations
4. **FileService** ([src/services/file-service.ts](src/services/file-service.ts)) - Handles vault file operations
5. **StorageService** ([src/services/storage-service.ts](src/services/storage-service.ts)) - Manages conversation catalog/metadata

**Supporting Services**:
- **AttachmentMapBuilder** ([src/services/attachment-map-builder.ts](src/services/attachment-map-builder.ts)) - Builds unified attachment index from multiple ZIP files
- **ConversationMetadataExtractor** ([src/services/conversation-metadata-extractor.ts](src/services/conversation-metadata-extractor.ts)) - Lightweight conversation analysis for selection dialog
- **LinkUpdateService** ([src/services/link-update-service.ts](src/services/link-update-service.ts)) - Updates wikilinks when files are moved/renamed

### Dialog-Driven User Flow

1. **ProviderSelectionDialog** - Choose provider (ChatGPT / Claude / Mistral Vibe / Perplexity)
2. **EnhancedFileSelectionDialog** - Select ZIP file(s) + import mode (all/selective)
3. **ConversationSelectionDialog** - Choose specific conversations (selective mode only)
4. **ImportProgressModal** - Real-time import feedback
5. **Completion Notice** - Summary with report link

### Upgrade System

**Incremental Version Upgrades** ([src/upgrade/](src/upgrade/)):

- **IncrementalUpgradeManager** ([src/upgrade/incremental-upgrade-manager.ts](src/upgrade/incremental-upgrade-manager.ts)) - Orchestrates sequential upgrades
- Version-specific upgrades in `src/upgrade/versions/`
- Runs automatically on plugin load; fresh install detection for welcome dialog

## Code Organization

### Critical Entry Points

- **[src/main.ts](src/main.ts)** - Plugin class, lifecycle hooks, command registration
- **[src/commands/command-registry.ts](src/commands/command-registry.ts)** - All Obsidian commands
- **[src/events/event-handlers.ts](src/events/event-handlers.ts)** - Event lifecycle management

### Provider Implementations

**ChatGPT** ([src/providers/chatgpt/](src/providers/chatgpt/)):
- `chatgpt-adapter.ts`, `chatgpt-converter.ts`, `chatgpt-attachment-extractor.ts`
- `chatgpt-asset-index.ts` - Loads `conversation_asset_file_names.json` (new 2026 export format: all attachments are `<fileId>.dat` at ZIP root; the index maps them to original names and flags DALL-E/voice assets)
- `chatgpt-dalle-processor.ts` - DALL-E image handling with prompts
- `chatgpt-message-filter.ts` - Deduplicates messages (ChatGPT exports contain duplicates)
- Attachments come from two pipelines merged by fileId: `message.metadata.attachments[]` (user uploads incl. PDFs/docs, carries the original filename) and `image_asset_pointer` content parts (carries dimensions). Voice recordings (`audio_asset_pointer`, RIFF/WAVE `.dat`) are intentionally never imported.

**Claude** ([src/providers/claude/](src/providers/claude/)):
- `claude-adapter.ts`, `claude-converter.ts`, `claude-attachment-extractor.ts`, `claude-types.ts`
- Handles `extracted_content` inline attachments (txt, docx) and artifact versioning

**Mistral Vibe** (formerly Le Chat) ([src/providers/vibe/](src/providers/vibe/)):
- `vibe-adapter.ts`, `vibe-converter.ts`, `vibe-attachment-extractor.ts`

**Perplexity** ([src/providers/perplexity/](src/providers/perplexity/)):
- `perplexity-adapter.ts`, `perplexity-converter.ts`

**Provider Registry** ([src/providers/provider-registry.ts](src/providers/provider-registry.ts)):
- Auto-detection by testing each provider's `detect()` method
- Extensible for future providers

### Formatters

**Message Formatting** ([src/formatters/message-formatter.ts](src/formatters/message-formatter.ts)):
- Converts StandardMessage to Markdown with custom Obsidian callouts
- Handles nested content (code blocks, artifacts, images, inline attachments)

**Note Formatting** ([src/formatters/note-formatter.ts](src/formatters/note-formatter.ts)):
- Creates complete conversation notes with frontmatter
- Generates YAML metadata (conversation_id, timestamps, etc.)

### Type System

**Core Types** ([src/types/](src/types/)):
- `plugin.ts` - PluginSettings, AttachmentStats
- `standard.ts` - StandardConversation, StandardMessage, StandardAttachment, AttachmentStatus
- `conversation-selection.ts` - Selection dialog types
- `index.ts` - Barrel export

**Important**: All timestamps in frontmatter use **ISO 8601 UTC format** (`2024-01-15T14:30:22.000Z`).

## Important Development Patterns

### Adding a New Provider

1. Create `src/providers/<name>/` with adapter, converter, types
2. Implement `ProviderAdapter<TChat>` interface
3. Handle provider-specific attachments
4. Register in `ProviderRegistry`
5. Add to provider selection dialog

### Working with Obsidian Vault

**CRITICAL**: Always use `FileService` methods, never direct Node.js `fs`:

```typescript
// ❌ WRONG
import fs from 'fs';
fs.writeFileSync(path, content);

// ✅ CORRECT
await this.fileService.createOrUpdateFile(path, content);
```

`FileService` uses Obsidian's Vault API which respects excluded folders, sync settings, and triggers vault events.

### Claude Attachment Handling

Claude exports store attachment content in `conversations.json`, not as files in the ZIP:

| File type | Export content | Result in note |
|---|---|---|
| `.txt` | Full text in `extracted_content` | Collapsed callout, no link |
| `.docx`, other docs | Extracted text in `extracted_content` | Collapsed callout `(text extract)` + link |
| Code files (`.ts`, `.py`…) | Content in `extracted_content` | Collapsed callout with syntax fence |
| Images, PDFs, binaries | Reference only — no content | Placeholder: "Attachment not provided by export" |

**Key files**: `claude-converter.ts` (`processInlineAttachments`, `getCodeLanguage`), `claude-attachment-extractor.ts` (`createFileNotFoundPlaceholder`)

### Upgrade Development

1. Create `src/upgrade/versions/upgrade-X.Y.Z.ts`
2. Implement `Upgrade` interface (`needsUpgrade`, `performUpgrade`)
3. Add to upgrade chain in `IncrementalUpgradeManager`

## Configuration and Settings

All settings defined in [src/types/plugin.ts](src/types/plugin.ts). Defaults in [src/config/default-settings.ts](src/config/default-settings.ts).

**File Organization Pattern**:
```
<conversationFolder>/<provider>/<YYYY>/<MM>/<filename>.md
<attachmentFolder>/<provider>/images|documents|artifacts/...
<reportFolder>/<provider>/<YYYYMMDD-HHMMSS> - import report.md
```

## Build System

**Build script**: [esbuild.config.mjs](esbuild.config.mjs)
- Entry: `src/main.ts` → Output: `dist/main.js` (CommonJS)
- External: `obsidian`, `@codemirror/*`, `@electron/*`
- Copies `manifest.json` and `styles.css` to `dist/`

**TypeScript**: ES2018 target, CommonJS module, strict mode, no emit (esbuild handles compilation).

## Common Pitfalls

### Date/Time Handling
Store all dates in ISO 8601 UTC in frontmatter. Use locale formatting only for display.

### Attachment Path Resolution
Use `AttachmentMapBuilder` for unified cross-ZIP attachment lookup.

### Message Deduplication
ChatGPT exports contain duplicate messages — `ChatGPTMessageFilter.filterDuplicateMessages()` handles this.

### Vault File Race Conditions
Always `await` vault operations. Process conversations sequentially, not in parallel.

### Plugin Upgrades Breaking User Data
Never modify existing frontmatter fields — add new ones. Use upgrade system for schema migrations.

## License Compliance

**GPL-3.0-or-later**: modifications must also be GPL-3.0, source must be available, include license headers in new files. See [LICENSE.md](LICENSE.md).
