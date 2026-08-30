# Attachment handling

How the importer locates attachment payloads across one or more archives, writes
them to the vault, and reconciles assistant-generated content that lives outside
the conversation payload.

User-facing behaviour (status meanings, embeds vs links, what a missing attachment
looks like) is in [docs/user/attachments.md](../user/attachments.md). Report
counters are in [docs/user/reports.md](../user/reports.md). This page is the
implementation view.

Primary sources:
[`src/services/attachment-map-builder.ts`](../../src/services/attachment-map-builder.ts),
[`src/utils/attachment-target.ts`](../../src/utils/attachment-target.ts),
[`src/utils/zip/attachment-lookup-index.ts`](../../src/utils/zip/attachment-lookup-index.ts),
[`src/formatters/message-formatter.ts`](../../src/formatters/message-formatter.ts),
and each provider's `*-attachment-extractor.ts`.

## Best-effort model

- Payload present in the archive → extracted and linked/embedded.
- Payload absent → an informative placeholder callout, with a link back to the
  original conversation where the provider exposes one.
- Every outcome is counted for the import report.

There is currently **no** user setting to disable attachments or skip missing
ones; the dormant `attachment-settings-section.ts` is not mounted.

## Lookup index

Each archive builds a metadata-only index at load time
(`buildAttachmentLookupIndex`):

| Map | Resolves |
|---|---|
| `byExactPath` | exact entry path (primary) |
| `byBaseName` | basename, when the path prefix differs |
| `byFileId` | `<fileId>.dat` for the 2026+ ChatGPT format, keyed under both the prefixed (`file-…`, `file_…`) and bare id |
| `byDalleId` | DALL-E asset pointers in legacy ChatGPT exports |

For 2026+ ChatGPT exports, `conversation_asset_file_names.json` is also loaded and
merged, mapping each opaque `.dat` back to its original name and flagging DALL-E and
voice assets.

## Cross-archive resolution

When Import All processes several ChatGPT archives at once, the UI builds a unified
map so an attachment referenced in archive A can be found in archive B
(`ImportService.buildAttachmentMapForMultiZip`, driven from
[`src/main.ts`](../../src/main.ts)). The CLI does not build this map; it imports one
archive's attachments at a time.

## Format detection

`.dat` payloads carry no extension. The real type is restored from magic bytes
(PNG, JPEG, GIF, WebP, PDF, RIFF/WAVE). RIFF/WAVE `.dat` files are voice recordings
and are deliberately **not** written to the vault — the transcription text is
already in the conversation. Audio transcription text and voice audio are separate
behaviours; only the audio is dropped.

## Destinations

Targets are provider-scoped, resolved by
[`attachment-target.ts`](../../src/utils/attachment-target.ts) beneath
`<attachment folder>/<provider>/…` (for example `images/`, `documents/`). There is
no single universal set of subfolders — do not document one. Filename collisions
get a numeric suffix.

Images are embedded (`![[…]]`); other local files are linked (`[[…]]`).
`sandbox://` URLs are never linked (they do not resolve in Obsidian); the message
explains the file must be viewed in the original conversation instead.

## Long content

Independent of attachments, `LongContentExtractor` externalises oversized inline
content: any message line over 10,000 characters, and extracted attachment blocks
over 20 KiB, are written to
`<attachment folder>/<provider>/documents/<conversation filename>/` under stable
content-derived `attachment-<8 hex>.<ext>` names. If the write fails, the original
content stays in the note.

## Generated-content reconciliation

Providers whose exports ship assistant-generated files outside the message payload
implement `reconcileConversationMessages()`, which runs per conversation between
conversion and extraction (see [Import pipeline](import-pipeline.md)). ChatGPT is
the current user of this hook — see
[ChatGPT export format](providers/chatgpt-export-format.md) for `library_files.json`
reconciliation, the artifact allowlist, and the synthetic-message rules. The pass
is idempotent, so a rebuild never produces duplicates.
