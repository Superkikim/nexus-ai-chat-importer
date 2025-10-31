# Changelog: ISO 8601 Timestamp Migration (v1.3.0)

## Summary

Version 1.3.0 migrates all timestamps from US locale format to ISO 8601 format for better universality, compatibility, and to resolve locale-dependent parsing issues.

## Changes Made

### 1. Import/Export (note-formatter.ts)

**Changed:**
- Frontmatter timestamps now generated in ISO 8601 format
- Note body timestamps remain in user-friendly format

**Before:**
```yaml
create_time: 10/04/2025 at 10:30:45 PM
```

**After:**
```yaml
create_time: 2025-10-04T22:30:45.000Z
```

**Code Changes:**
```typescript
// Generate ISO 8601 timestamps for frontmatter (v1.3.0+)
const createTimeStr = new Date(conversation.createTime * 1000).toISOString();
const updateTimeStr = new Date(conversation.updateTime * 1000).toISOString();

// Generate user-friendly timestamps for note body
const createTimeDisplay = `${formatTimestamp(conversation.createTime, "date")} at ${formatTimestamp(conversation.createTime, "time")}`;
const updateTimeDisplay = `${formatTimestamp(conversation.updateTime, "date")} at ${formatTimestamp(conversation.updateTime, "time")}`;
```

### 2. Parsing (storage-service.ts)

**Changed:**
- Parser now tries ISO 8601 first
- Fallback to US format for compatibility

**Code Changes:**
```typescript
private parseTimeString(timeStr: string): number {
    // Try ISO 8601 first (v1.3.0+)
    let date = moment(timeStr, moment.ISO_8601, true);
    
    if (!date.isValid()) {
        // Fallback: US format with seconds (v1.2.0)
        date = moment(timeStr, "MM/DD/YYYY [at] h:mm:ss A", true);
    }
    
    return date.isValid() ? date.unix() : 0;
}
```

### 3. Migration (upgrade-1.3.0.ts)

**Changed:**
- Renamed operation from `FixTimestampPrecisionOperation` to `ConvertToISO8601TimestampsOperation`
- Converts all existing frontmatter timestamps to ISO 8601
- Only processes Nexus plugin files (checks for `nexus: nexus-ai-chat-importer`)
- Only modifies frontmatter (never touches note body)

**Key Features:**
- ✅ Verifies file belongs to Nexus plugin
- ✅ Extracts frontmatter separately
- ✅ Converts timestamps in frontmatter only
- ✅ Preserves note body content
- ✅ Updates plugin_version to 1.3.0
- ✅ Batch processing to avoid blocking
- ✅ Error handling and verification

**Conversion Logic:**
```typescript
// Pattern: create_time: 10/04/2025 at 10:30:45 PM
// Converts to: create_time: 2025-10-04T22:30:45Z

frontmatter = frontmatter.replace(
    /^(create|update)_time: (\d{1,2})\/(\d{1,2})\/(\d{4}) at (\d{1,2}):(\d{2})(?::(\d{2}))? (AM|PM)$/gm,
    (match, field, month, day, year, hour, minute, second, ampm) => {
        // Convert to 24-hour format
        let h = parseInt(hour);
        if (ampm === 'PM' && h !== 12) h += 12;
        if (ampm === 'AM' && h === 12) h = 0;
        
        // Default seconds to 00 if not present
        const sec = second || '00';
        
        // Build ISO 8601 string
        const isoDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${h.toString().padStart(2, '0')}:${minute}:${sec}Z`;
        
        return `${field}_time: ${isoDate}`;
    }
);
```

## Files Modified

1. **src/formatters/note-formatter.ts**
   - Lines 15-30: Generate ISO 8601 for frontmatter, user-friendly for body
   - Lines 32-74: Updated header generation with separate display timestamps

2. **src/services/storage-service.ts**
   - Lines 293-325: Updated parseTimeString() to support ISO 8601 with fallback

3. **src/upgrade/versions/upgrade-1.3.0.ts**
   - Lines 5-14: Renamed and updated operation description
   - Lines 16-60: Updated canRun() with Nexus file check
   - Lines 62-150: Updated execute() with conversion logic
   - Lines 152-209: New helper methods (isNexusFile, hasUSFormatTimestamps, convertTimestampsToISO8601)
   - Lines 211-273: Updated verify() method
   - Lines 276-289: Updated operation reference

## New Files

1. **MIGRATION-ISO8601.md**
   - Comprehensive documentation of the migration
   - Before/after examples
   - Technical details
   - Troubleshooting guide

2. **CHANGELOG-ISO8601.md** (this file)
   - Summary of changes
   - Code examples
   - Migration details

## Benefits

### For Users

1. **Universal Compatibility**: Works on all locales (US, EU, Asia, etc.)
2. **No More Parsing Errors**: Resolves Issue #18 (dates with day > 12 failing on non-US systems)
3. **Better Plugin Integration**: Compatible with Dataview and other Obsidian plugins
4. **Future-Proof**: International standard that won't change

### For Developers

1. **Simpler Parsing**: ISO 8601 is unambiguous
2. **Better Testing**: No locale-dependent behavior
3. **Standard Compliance**: Aligns with web standards and APIs
4. **Maintainability**: Less edge cases to handle

## Migration Behavior

### What Gets Migrated

**Frontmatter Only:**
```yaml
---
nexus: nexus-ai-chat-importer
create_time: 10/04/2025 at 10:30:45 PM  # ← CONVERTED
update_time: 10/04/2025 at 10:35:12 PM  # ← CONVERTED
---

Created: 10/04/2025 at 10:30:45 PM      # ← NOT TOUCHED
Last Updated: 10/04/2025 at 10:35:12 PM # ← NOT TOUCHED
```

### Safety Checks

1. **Nexus-only**: Only processes files with `nexus: nexus-ai-chat-importer`
2. **Frontmatter extraction**: Parses frontmatter separately to avoid touching body
3. **Pattern matching**: Only matches exact timestamp patterns
4. **Verification**: Samples files after migration to verify success

### Error Handling

- Continues processing even if individual files fail
- Logs errors for debugging
- Returns detailed results (processed, converted, skipped, errors)

## Testing Recommendations

### Manual Testing

1. **New Import**: Import a new conversation and verify frontmatter has ISO 8601
2. **Existing Files**: Verify migration converted all timestamps
3. **Mixed Vault**: Test with both migrated and non-migrated files
4. **Non-Nexus Files**: Verify non-Nexus files are not touched

### Test Cases

```typescript
// Test 1: New import generates ISO 8601
// Expected: create_time: 2025-10-04T22:30:45.000Z

// Test 2: Parser reads ISO 8601
// Input: "2025-10-04T22:30:45.000Z"
// Expected: Unix timestamp 1728079845

// Test 3: Parser reads US format (fallback)
// Input: "10/04/2025 at 10:30:45 PM"
// Expected: Unix timestamp 1728079845

// Test 4: Migration converts US to ISO
// Input: "10/04/2025 at 10:30:45 PM"
// Expected: "2025-10-04T22:30:45Z"

// Test 5: Migration skips non-Nexus files
// Input: File without "nexus: nexus-ai-chat-importer"
// Expected: File unchanged
```

## Rollback Plan

If issues are discovered:

1. **Immediate**: Parser has fallback to US format (no data loss)
2. **Short-term**: Can revert commits and rebuild
3. **Long-term**: Create reverse migration if needed (ISO 8601 → US format)

## Related Issues

- **Issue #18**: Timestamp parsing fails for non-US locales
- **Commit 0cb13ff**: Fix timestamp parsing for non-US locales
- **Commit 8d4a727**: Add v1.3.0 migration for timestamp precision fix

## Next Steps

1. Test migration with sample vault
2. Verify all timestamps convert correctly
3. Test parsing with both formats
4. Update user documentation
5. Create release notes
6. Consider updating GitHub comment on Issue #18

## Notes

- Migration is automatic on first startup of v1.3.0
- No user action required
- Downgrade to v1.2.0 not recommended after migration
- Note body timestamps remain user-friendly for readability

