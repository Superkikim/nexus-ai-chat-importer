# ChatGPT export format (2026)

Maintainer reference for the ChatGPT data-export format seen in 2026. **OpenAI does
not document this format publicly**, so everything here is observation from real
exports and the fixtures under `local_resources/chatgpt/`, not a specification. It
can change without notice; treat it as "what the importer currently relies on".

Companion: [Attachment handling](../attachment-handling.md).

## ZIP contents

A 2026 export ZIP typically contains:

| Entry | Purpose |
|---|---|
| `conversations.json` | All conversations (the `mapping` graph of messages). Large exports split into `conversations-NNN.json`. |
| `chat.html` | Human-readable rendering. |
| `conversation_asset_file_names.json` | Maps each `<fileId>.dat` to its original name. |
| `library_files.json` | The user's file library / knowledge store (uploads, generated Canvas artifacts, and — since the August 2026 exports — generated images). |
| `export_manifest.json` | Lists every file in the export with its byte size. |
| `user.json`, `user_settings.json` | Account / settings. |
| `file_<id>.dat` / `file-<id>.dat` | Every attachment payload, with no name and no extension. |

## Attachment payloads: `.dat` files

All attachments — images, documents, and voice recordings — are stored at the ZIP
root as `file_<id>.dat` (underscore) or `file-<id>.dat` (hyphen). Resolution:

1. **Asset index** — `conversation_asset_file_names.json` maps `"<fileId>.dat"` to
   an original name. Values can be:
   - a plain name (`Screenshot.jpg`) — a user upload;
   - `dalle-generations/<uuid>.webp` — a generated image;
   - `<conv-uuid>/audio/<uuid>.wav` — a voice recording (skipped on import).
2. **Direct fallback** — when a referenced `fileId` is not in the index, the plugin
   tries `<fileId>.dat` directly (observed for some Canvas documents).
3. **Magic bytes** — the real extension is restored from the file header when
   missing.

See [`chatgpt-asset-index.ts`](../../../src/providers/chatgpt/chatgpt-asset-index.ts).

## How messages reference attachments

In `conversations.json`, retained node authors are `user` or `assistant`
(tool/system messages are stripped). Attachments are referenced two ways:

- **`message.metadata.attachments[]`** — user uploads:
  `{ id, name, mime_type, size, source, library_file_id }`. New uploads set
  `source: "library"`. This pipeline carries the original filename.
- **`image_asset_pointer` content parts** — images, with `asset_pointer` like
  `sediment://file_<id>` and pixel dimensions. Merged with `metadata.attachments`
  by `fileId`.

Observation: in current exports every attachment reference sits on a **user**
message. Assistant-generated images are not referenced inline at all — see below.

## `library_files.json`

A JSON array describing files in the user's library.
[`chatgpt-library-index.ts`](../../../src/providers/chatgpt/chatgpt-library-index.ts)
is the only module that reads the raw fields:

| Field | Meaning |
|---|---|
| `file_id` | Matches `<file_id>.dat` in the ZIP. |
| `id.id` | Library-internal id (`libfile_…`), used for deduplication. |
| `file_name` | Original name. |
| `mime_type` | MIME type. |
| `file_size_bytes` | Payload size. |
| `library_artifact_type` | See table below; `null` for plain user uploads. |
| `library_artifact_subtype` | Subtype, when present. |
| `library_file_category` | Coarse category (`image`, `text`, `pdf`, `other`). |
| `origination_message_id` | The message that produced/owns the file. |
| `origination_thread_id` | The **conversation** that owns the file — present even when the originating message was omitted from the export. |
| `image_gen_generation_id` | Generation id for assistant-generated images. Its presence is the strongest generated-image signal; ordinary uploads never carry one. |
| `created_at` (+ `record_creation_time`, `version_created_at`, `file_processed_time` fallbacks) | Creation timestamp, used to position an artifact chronologically when its message is missing. |
| `current_version_number`, `source_version_number` | File version info, when tracked. |

**Known `library_artifact_type` values:**

| Value | Description | Handled by |
|---|---|---|
| `null` | Plain user upload — already in `metadata.attachments`. | Normal attachment path |
| `report` | Assistant-generated Canvas document (e.g. `.docx`) — **not** in `metadata.attachments`. | Library reconciliation |
| `writing_block` | User-pasted Canvas content — already in `metadata.attachments`. | Normal attachment path |
| `image` | Set on generated images, but classification relies on `image_gen_generation_id`; `image` alone is not a generation signal. | Library reconciliation (via generation id) |

**Classification (allowlist):** `classifyChatGPTLibraryArtifact()` maps an entry to
`generated_document` (`report`), `generated_image` (`image_gen_generation_id`
present), or `unsupported` (uploads, `writing_block`, anything unknown). Unknown
types are logged at debug level and skipped — a future OpenAI type must never fail
an import or create duplicates. New assistant-generated types are added to the
allowlist explicitly when observed.

### Library reconciliation

Supported artifacts are attached to their conversation by the pure reconciler
([`chatgpt-library-artifact-reconciler.ts`](../../../src/providers/chatgpt/chatgpt-library-artifact-reconciler.ts)),
invoked per conversation between conversion and attachment extraction
(`reconcileConversationMessages` in
[`chatgpt-adapter.ts`](../../../src/providers/chatgpt/chatgpt-adapter.ts)).
Attachment priority, first match wins:

1. **Already referenced** by an exported message (matched by `file_id`, library id,
   or generation id) — nothing to do; user uploads seen by both pipelines are
   never duplicated.
2. **`origination_message_id`** names a message present in the export → attach to it.
3. A **"generated image not in export" placeholder** is waiting → the real file
   replaces it in place, inheriting its position and prompt.
4. **`origination_thread_id`** matches the conversation but the message was omitted
   → a minimal synthetic assistant message (id `nexus-library-artifact-<key>`, no
   invented prose) is created at the artifact's library creation time.
5. **No match** → the entry is left alone (it belongs to a conversation absent from
   the export, or only to the global library). Debug counters only.

Entries whose `.dat` payload is absent are skipped (an existing placeholder stays).
Synthetic ids and identity keys are stable, so Reprocess and repeated
reconciliation are idempotent. The index is built once per ZIP (cached) and never
loads payloads.

## Canvas `:::writing` directives

Canvas ("textdoc") content is inlined in assistant text using CommonMark
generic/container directives:

```
:::writing{variant="document" id="38274"}
...body...
:::
```

Observed `variant` values: `social_post`, `document`, `email` (with
`subject="…"`), `standard`. This syntax is not rendered by Obsidian, so
[`chatgpt-canvas-directives.ts`](../../../src/providers/chatgpt/chatgpt-canvas-directives.ts)
converts each block into a collapsible `nexus_canvas` callout.

## Generated images: three export eras

The importer supports all three observed states:

1. **Legacy / DALL-E exports** — the image travels with the conversation as
   `dalle-generations/<uuid>.webp`, referenced by `image_asset_pointer` and
   `metadata.dalle`. Imported by the structured path
   ([`chatgpt-dalle-processor.ts`](../../../src/providers/chatgpt/chatgpt-dalle-processor.ts)).
2. **Omission period (observed mid-2026)** — generated images are entirely absent:
   no `image_asset_pointer`, no `.dat`, no asset-index entry, no `metadata.dalle`.
   An OpenAI-side regression. The plugin inserts a visible placeholder (heuristic
   in [`chatgpt-generated-image.ts`](../../../src/providers/chatgpt/chatgpt-generated-image.ts))
   so the loss is explicit.
3. **Library-based exports (observed August 2026)** — generated images return
   through `library_files.json`: the payload is a `.dat` at the ZIP root carrying
   `image_gen_generation_id`, `origination_thread_id`, and a creation timestamp.
   The message that presented the image is sometimes omitted from
   `conversations.json`; the reconciler then positions it via a synthetic
   assistant message.

The placeholder heuristic is suppressed whenever structured generated-image data
exists, and the reconciler replaces any placeholder once the real file is
available — so the three paths never conflict.

## Related issue

- [#62 — ChatGPT: export now packages attachments as .dat files](https://github.com/Superkikim/nexus-ai-chat-importer/issues/62)
