# Migration to ISO 8601 Timestamps (v1.3.0)

## Overview

Version 1.3.0 introduces a migration from US locale format timestamps to ISO 8601 format for better universality and compatibility.

## Changes

### Before (v1.2.0 and earlier)

**Frontmatter:**
```yaml
---
nexus: nexus-ai-chat-importer
plugin_version: "1.2.0"
create_time: 10/04/2025 at 10:30:45 PM
update_time: 10/04/2025 at 10:35:12 PM
---
```

**Note Body:**
```markdown
Created: 10/04/2025 at 10:30:45 PM
Last Updated: 10/04/2025 at 10:35:12 PM
```

### After (v1.3.0+)

**Frontmatter:**
```yaml
---
nexus: nexus-ai-chat-importer
plugin_version: "1.3.0"
create_time: 2025-10-04T22:30:45.000Z
update_time: 2025-10-04T22:35:12.000Z
---
```

**Note Body (unchanged):**
```markdown
Created: 10/04/2025 at 10:30:45 PM
Last Updated: 10/04/2025 at 10:35:12 PM
```

## Why ISO 8601?

### Problems with US Format

1. **Locale-dependent parsing**: The old format used `new Date()` which interprets dates according to system locale
2. **Ambiguity**: MM/DD/YYYY vs DD/MM/YYYY confusion for international users
3. **Parsing failures**: Dates with day > 12 failed to parse on non-US systems (Issue #18)

### Benefits of ISO 8601

1. **Universal standard**: No locale ambiguity
2. **Obsidian native**: Aligns with Obsidian's native date properties
3. **Dataview compatible**: Automatically recognized by Dataview plugin
4. **Alphabetical sorting**: Sorts chronologically when sorted alphabetically
5. **Future-proof**: International standard that won't change

## Migration Process

### Automatic Migration

When you upgrade to v1.3.0, the plugin automatically:

1. **Scans** all conversation files in your archive folder
2. **Verifies** each file belongs to Nexus plugin (checks for `nexus: nexus-ai-chat-importer`)
3. **Converts** timestamps in frontmatter only (not in note body)
4. **Updates** `plugin_version` to "1.3.0"

### What Gets Converted

**Only frontmatter timestamps:**
- `create_time`
- `update_time`

**Not converted:**
- Timestamps in note body (remain user-friendly format)
- Non-Nexus files (skipped for safety)
- Reports and Attachments folders (excluded)

### Safety Features

1. **Nexus-only**: Only processes files with `nexus: nexus-ai-chat-importer` in frontmatter
2. **Frontmatter-only**: Never modifies note body content
3. **Batch processing**: Processes files in small batches to avoid blocking
4. **Error handling**: Continues processing even if individual files fail
5. **Verification**: Samples files after migration to verify success

## Parsing Compatibility

The new parsing function supports both formats for robustness:

```typescript
// Priority 1: ISO 8601 (v1.3.0+)
moment(timeStr, moment.ISO_8601, true)

// Priority 2: US format with seconds (v1.2.0 - fallback if migration failed)
moment(timeStr, "MM/DD/YYYY [at] h:mm:ss A", true)
```

This ensures:
- ✅ New imports use ISO 8601
- ✅ Migrated files parse correctly
- ✅ Partially migrated vaults still work (if migration was interrupted)

## Technical Details

### Conversion Logic

**US Format → ISO 8601:**
```
10/04/2025 at 10:30:45 PM  →  2025-10-04T22:30:45Z
```

**Steps:**
1. Parse US format: `MM/DD/YYYY at H:MM:SS AM/PM`
2. Convert 12-hour to 24-hour format
3. Build ISO 8601 string: `YYYY-MM-DDTHH:MM:SSZ`

### Files Modified

1. **src/formatters/note-formatter.ts**
   - Generate ISO 8601 for frontmatter
   - Keep user-friendly format for note body

2. **src/services/storage-service.ts**
   - Parse ISO 8601 first
   - Fallback to US format for compatibility

3. **src/upgrade/versions/upgrade-1.3.0.ts**
   - Automatic migration operation
   - Converts all existing files

## User Impact

### What Users See

**Frontmatter (Properties panel):**
- Before: `10/04/2025 at 10:30:45 PM`
- After: `2025-10-04T22:30:45.000Z`

**Note Body (Reading mode):**
- Before: `Created: 10/04/2025 at 10:30:45 PM`
- After: `Created: 10/04/2025 at 10:30:45 PM` (unchanged)

### What Changes

- ✅ Frontmatter timestamps are now ISO 8601
- ✅ Note body timestamps remain user-friendly
- ✅ All parsing works correctly on all locales
- ✅ No more false positive "updated" conversations

### What Doesn't Change

- ❌ Note body content (unchanged)
- ❌ File names (unchanged)
- ❌ Folder structure (unchanged)
- ❌ Conversation data (unchanged)

## Troubleshooting

### Migration Failed

If migration fails or is interrupted:
1. Plugin will retry on next startup
2. Parsing still works (fallback to US format)
3. No data loss - original files preserved

### Mixed Formats

If you have both formats:
- ✅ Parser handles both automatically
- ✅ New imports use ISO 8601
- ✅ Old files work until migrated

### Downgrade Warning

⚠️ **Do not downgrade to v1.2.0 or earlier after migration**

If you downgrade:
- Old parser won't understand ISO 8601
- Timestamps will fail to parse
- Conversations may be detected as "updated" incorrectly

## Related Issues

- **Issue #18**: Timestamp parsing fails for non-US locales
- **Commit 0cb13ff**: Fix timestamp parsing for non-US locales
- **Commit 8d4a727**: Add v1.3.0 migration for timestamp precision fix

## Future Considerations

This migration sets the foundation for:
- Better Dataview integration
- Obsidian native date properties
- International user support
- Plugin ecosystem compatibility

