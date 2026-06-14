# ChatGPT 2026 Export Format

This is a maintainer reference for the ChatGPT data-export format introduced in 2026. OpenAI does not document it publicly, so this file captures what the plugin relies on. It complements [ATTACHMENT-HANDLING.md](ATTACHMENT-HANDLING.md).

## ZIP contents

A 2026 export ZIP typically contains:

| Entry | Purpose |
|-------|---------|
| `conversations.json` | All conversations (the `mapping` graph of messages). |
| `chat.html` | Human-readable rendering. |
| `conversation_asset_file_names.json` | Maps each `<fileId>.dat` to its original name. |
| `library_files.json` | The user's file library / knowledge store (uploads **and** generated Canvas artifacts). |
| `export_manifest.json` | Lists every file in the export with its byte size. |
| `user.json`, `user_settings.json` | Account/settings. |
| `file_<id>.dat` / `file-<id>.dat` | Every attachment payload, with no name or extension. |

## Attachment payloads: `.dat` files

All attachments — images, documents, and voice recordings — are stored at the ZIP root as `file_<id>.dat` (underscore) or `file-<id>.dat` (hyphen). They carry no original name and no extension. Resolution:

1. **Asset index** — `conversation_asset_file_names.json` maps `"<fileId>.dat"` → original name. Values can be:
   - a plain name (`Screenshot.jpg`) — a user upload;
   - `dalle-generations/<uuid>.webp` — a generated image;
   - `<conv-uuid>/audio/<uuid>.wav` — a voice recording (skipped on import).
2. **Direct fallback** — when a referenced `fileId` is not in the index, the plugin tries `<fileId>.dat` directly (observed for some Canvas documents).
3. **Magic bytes** — the real extension is restored from the file header when missing.

See [`chatgpt-asset-index.ts`](../src/providers/chatgpt/chatgpt-asset-index.ts).

## How messages reference attachments

In `conversations.json`, every node author is `user` or `assistant` (tool/system messages are stripped, and `recipient` is `null`). Attachments are referenced two ways:

- **`message.metadata.attachments[]`** — user uploads: `{ id, name, mime_type, size, source, library_file_id }`. New uploads set `source: "library"`.
- **`image_asset_pointer` content parts** — images, with `asset_pointer` like `sediment://file_<id>` and dimensions. Merged with `metadata.attachments` by `fileId` to restore the original name.

> **Observation:** in current exports, every attachment reference sits on a **user** message. Assistant-generated images are not referenced at all (see below).

## `library_files.json`

A JSON array describing files in the user's library. Relevant fields per entry:

| Field | Meaning |
|-------|---------|
| `file_id` | Matches `<file_id>.dat` in the ZIP. |
| `file_name` | Original name, e.g. `lettre_opposition_isabelle_bally.docx`. |
| `mime_type` | MIME type. |
| `library_artifact_type` | `report` for assistant-generated Canvas documents; `null` for uploads. |
| `origination_message_id` | The message that produced/owns the file. |

**Why it matters:** Canvas-generated documents (e.g. a `.docx`) appear here and in the ZIP, but are linked to a message only by `origination_message_id` — never in `metadata.attachments`. The adapter loads this index and attaches such files to the originating message (deduped against existing attachments, and only when the `.dat` exists). See [`chatgpt-library-index.ts`](../src/providers/chatgpt/chatgpt-library-index.ts) and the `processMessageAttachments` override in [`chatgpt-adapter.ts`](../src/providers/chatgpt/chatgpt-adapter.ts).

## Canvas `:::writing` directives

Canvas ("textdoc") content is inlined in assistant text using CommonMark generic/container directives:

```
:::writing{variant="document" id="38274"}
...body...
:::
```

Observed `variant` values: `social_post`, `document`, `email` (with `subject="…"`), `standard`. This syntax is experimental (remark-directive) and not rendered by Obsidian, so [`chatgpt-canvas-directives.ts`](../src/providers/chatgpt/chatgpt-canvas-directives.ts) converts each block into a collapsible `nexus_canvas` callout.

## Generated images are often omitted

In current 2026 exports, AI-generated images can be **entirely absent**: no `image_asset_pointer`, no `.dat`, no asset-index entry, no `metadata.dalle`. Only the conversation text remains. This is an OpenAI-side regression (also reported in the [OpenAI developer community](https://community.openai.com/t/data-export-does-not-export-images-and-other-files-anymore/1248361)).

Because availability is **inconsistent between exports** (some still include `dalle-generations/*.webp`), the plugin:

- imports the generated image when it is present (structured path), and
- inserts a placeholder when it is absent (heuristic in [`chatgpt-generated-image.ts`](../src/providers/chatgpt/chatgpt-generated-image.ts)).

The heuristic is suppressed whenever structured generated-image data exists, so older/DALL-E exports are never affected.

## Related issue

- [#62 — ChatGPT: export now packages attachments as .dat files](https://github.com/Superkikim/nexus-ai-chat-importer/issues/62)
