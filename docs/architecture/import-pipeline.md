# Import pipeline

How an import runs, from the moment the user picks one or more ZIP files to the
moment the notes and reports are written. Companion pages:
[Archive pipeline](archive-pipeline.md) for ZIP reading and classification,
[Attachment handling](attachment-handling.md) for payload extraction.

Primary sources: [`src/main.ts`](../../src/main.ts),
[`src/services/import-service.ts`](../../src/services/import-service.ts),
[`src/services/conversation-processor.ts`](../../src/services/conversation-processor.ts),
[`src/services/conversation-metadata-extractor.ts`](../../src/services/conversation-metadata-extractor.ts).

## High-level flow

```mermaid
flowchart TD
    A([User runs "Import AI conversations"]) --> B[File picker: one or more .zip]
    B --> C{OpenAI Privacy Portal<br/>container ZIP?}
    C -- yes --> C1[expandContainerArchives<br/>unwrap recognised inner conversation ZIPs]
    C -- no --> D
    C1 --> D[Sort selection by embedded timestamp,<br/>then lastModified, then name]
    D --> E[resolveProviderLockFromSelection<br/>lock to the first supported archive]
    E --> F{Import mode}

    F -- Import All (desktop) --> G[Metadata extraction across all archives<br/>ConversationMetadataExtractor]
    G --> H[Deduplicate conversation IDs across archives<br/>compare with vault: new / updated / unchanged]
    H --> I[ImportService.handleZipFile per archive]

    F -- Import All (mobile) --> J[Single archive, no analysis phase<br/>handleImportAllMobileSequential]
    J --> I

    F -- Select Specific --> K[Metadata extraction + selection dialog<br/>filter / sort / choose]
    K --> L[Optional: rebuild selected existing notes]
    L --> I

    I --> M[validateZipFile: classify entries, confirm provider]
    M --> N[processConversations: adapter.convertChat -> StandardConversation]
    N --> O[Per-conversation processing order, below]
    O --> P[writeConsolidatedReport: 3 report files + completion dialog]
```

Provider locking, container expansion, the desktop/mobile split, deduplication, and
"nothing new is not an error" are user-visible behaviours documented in
[docs/user/importing.md](../user/importing.md); this page covers the internal wiring.

## Per-conversation processing order

Inside `ConversationProcessor`, every conversation goes through the same fixed
sequence for **new imports, incremental updates, and rebuilds** alike
(`processSingleChat` → `handleNewChat` / `handleExistingChat` →
`createNewNote` / `updateExistingNote`):

1. **Convert** the raw provider payload to `StandardConversation` via the provider
   adapter/converter.
2. **Placeholders** for genuinely incomplete exports are inserted during conversion
   (for example ChatGPT's "generated image not in export" callout).
3. **Reconcile** — the adapter's optional `reconcileConversationMessages()` runs on
   the **whole** conversation, between conversion and attachment extraction
   (`reconcileMessages` in `conversation-processor.ts`). ChatGPT uses it to attach
   `library_files.json` artifacts to the message that produced them, replacing
   resolved placeholders and creating stable synthetic messages when the
   originating message was omitted from the export. A failure here never sinks the
   conversation — the import continues with the unreconciled messages.
4. **Decide new messages** on the reconciled conversation. For an existing note,
   only messages whose `<!-- UID: … -->` marker is absent are appended; a rebuild
   regenerates the whole note.
5. **Sort** messages chronologically (synthetic messages included).
6. **Extract attachments** through the shared per-provider extractor (lazy `.dat`
   reads; see [Attachment handling](attachment-handling.md)).
7. **Format and write** the note through `NoteFormatter` / `MessageFormatter` and
   `FileService`.
8. **Count** the outcome (Created / Updated / Recreated / Unchanged / Failed /
   Empty) for the import report.

Reconciliation must be idempotent and must always receive the full message list, or
a second import would re-add content the note already holds.

## Existing-note detection

`StorageService.scanExistingConversations()` scans Markdown below the configured
conversation folder. A note counts as an existing import when its frontmatter has
`nexus` equal to the plugin ID, a `conversation_id`, and parseable
`create_time`/`update_time`. The lookup key is the conversation ID; the provider is
recorded but is not part of the key. Legacy `Reports/` and `Attachments/` subtrees
are skipped.

Archive vs vault update times are compared after truncating to the minute
(`truncateToMinute`, `compareTimestampsIgnoringSeconds` in
[`src/utils.ts`](../../src/utils.ts)). An archive timestamp in the same minute or
older is treated as unchanged. A newer timestamp with no new messages still
advances the stored `update_time` so the conversation is not offered as "newer"
again.

## Error handling

Per-conversation errors are caught, added to the report's global error list, and —
for creation failures — recorded in the Failed table. One failing conversation does
not abort the batch. If report-folder creation or report writing fails, the plugin
shows a failure notice and a short "import completed" notice instead of the
completion dialog with a report link.
