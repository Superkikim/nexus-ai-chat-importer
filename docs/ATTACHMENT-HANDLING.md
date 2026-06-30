# Attachment Handling

This document explains how Nexus AI Chat Importer handles the different attachment types found in ChatGPT and Claude exports.

## Overview

The plugin uses a **best-effort** strategy for attachments:

- If the file exists in the ZIP archive, it is extracted and linked.
- If the file is missing, an informative placeholder is written instead.
- Attachment statistics are summarized in the import report.

## Supported Attachment Types

### ✅ User-uploaded images

- **Source**: present in the ZIP archive.
- **Handling**: extracted to `Attachments/chatgpt/images/` or `Attachments/claude/images/`.
- **Formats**: PNG, JPEG, GIF, WebP.
- **Special detection**: magic bytes for `.dat` files (the correct extension is restored automatically).

### ⚠️ Generated images (ChatGPT) — no longer included by OpenAI

- **Current status**: as of 2026, OpenAI **no longer includes AI-generated images** in the data export. No `.dat` file, no asset index entry, no DALL-E metadata. This is an OpenAI-side regression — the plugin cannot recover images that are absent from the export.
- **Older exports** (pre-2026): generated images were shipped as `dalle-generations/<uuid>.webp` inside the ZIP and are still imported correctly when present.
- **What the plugin does**: when an image-generation turn is detected and no image is present, a visible placeholder callout is inserted (with the generation prompt when recoverable) so the omission is explicit rather than silent. See [Generated image omission](#generated-image-omission-2026-regression).
- **Format** (when present): PNG or WebP, real extension restored via magic bytes.

### ✅ Canvas documents (ChatGPT, 2026+)

- **Source**: assistant-generated Canvas artifacts (e.g. a `.docx` "report") described in `library_files.json` and linked to a message through `origination_message_id` — **not** through the usual `metadata.attachments`.
- **Handling**: the document is imported and linked like any other document, **and** its body (when inlined as a `:::writing` block) is rendered as a callout. See [Canvas content](#canvas-content-writing-directives).

### ✅ Inline text files (scripts, Markdown, code, etc.)

- **Source**: content embedded directly in the message JSON.
- **Handling**: rendered inline in the message (no separate file), as a syntax-highlighted code block.

### ✅ Uploaded documents (PDF, etc.) — ChatGPT

- **Source**: referenced in a message's `metadata.attachments`; present in the archive as `<fileId>.dat` (2026+ format).
- **Handling**: extracted to `Attachments/chatgpt/documents/` under their original name.
- **Note**: older exports often did not include these files — in that case they are marked missing with an explanatory note.

### ❌ Voice recordings (oral mode)

- **Source**: may be present in the archive (`.dat` in RIFF/WAVE format).
- **Handling**: **intentionally skipped.**
- **Detection**: via the `conversation_asset_file_names.json` index (paths like `<conv-uuid>/audio/<uuid>.wav`) or by RIFF/WAVE magic bytes.
- **Why**: large file size, the transcription is already in the conversation text, and it avoids cluttering the vault.

## ChatGPT 2026+ Export Format

Since mid-2026, ChatGPT exports package **all attachments** as `<fileId>.dat` files at the ZIP root (e.g. `file-0HDUFW2JaMMvCvhqOQsPCGxF.dat` or `file_00000000aad871f49969859f2bccd6cb.dat`), with no original name or extension.

A `conversation_asset_file_names.json` index maps each `.dat` to its original name:

```json
{
  "file-12aRihqTCNon1VFE6ZpQqx.dat": "Screenshot_20250827_125754.jpg",
  "file-0HDUFW2JaMMvCvhqOQsPCGxF.dat": "dalle-generations/bdd53f7d-....webp",
  "file_0000000005987246b06f11c12c4e779f.dat": "<conv-uuid>/audio/<uuid>.wav"
}
```

The plugin:

1. Loads this index (when present) and resolves each attachment directly to its `.dat`.
2. Restores the **original name** for the vault file.
3. Restores the **real extension** via magic bytes when missing.
4. Skips voice recordings (`audio/*.wav` index values).
5. Falls back to the legacy lookup strategies when the index is absent (older exports).

For a full description of the new files (`library_files.json`, `export_manifest.json`, `sediment://` pointers, Canvas directives), see [CHATGPT-2026-FORMAT.md](CHATGPT-2026-FORMAT.md).

### Canvas content (`:::writing` directives)

Canvas ("textdoc") content is inlined in the export using CommonMark generic directives:

```
:::writing{variant="document" id="38274"}
...document body...
:::
```

This experimental syntax is not rendered by Obsidian, so the plugin converts each block into a collapsible `nexus_canvas` callout. Known `variant` values map to labels: `social_post` → *Social post*, `document` → *Document*, `email` → *Email* (with subject), `standard` → *Draft*; anything else → *Canvas*.

### Generated image omission (2026 regression)

In some 2026 exports, AI-generated images are absent entirely. The importer detects the generation turn — a user request (e.g. *"génère une image…"* / *"generate an image…"*) or an assistant claim (e.g. *"voici l'image…"* / *"generated image"*) — and, when no image is present, inserts a placeholder callout (including the prompt when available). The heuristic is intentionally conservative and is suppressed whenever the conversation still carries structured generated-image data, so older/DALL-E exports are unaffected.

### Reprocessing existing imports

To recover attachments for archives imported with an older plugin version, re-import the same ZIP and choose **Reprocess** in the dialog — the notes are regenerated with attachments.

## File Organization

```
Nexus AI Chat Imports/
├── Attachments/
│   ├── chatgpt/
│   │   ├── images/          # Uploaded + generated images
│   │   ├── documents/       # Documents (incl. Canvas docs)
│   │   ├── audio/           # Audio (skipped)
│   │   └── files/           # Other files
│   └── claude/
│       ├── images/          # Uploaded images
│       ├── documents/       # Documents (when available)
│       └── files/           # Other files
└── Conversations/
    ├── chatgpt/             # ChatGPT conversations
    └── claude/              # Claude conversations
```

### Conflict handling

- **Duplicate file names**: a numeric suffix is appended (`image_1.png`, `image_2.png`).
- **Wrong extensions**: the real format is detected via magic bytes.
- **Corrupted files**: marked "failed" with an error message.

## Format Detection

The plugin detects the real format of `.dat` files via magic bytes:

| Format | Magic Bytes | Extension |
|--------|-------------|-----------|
| PNG | `89 50 4E 47` | `.png` |
| JPEG | `FF D8 FF` | `.jpg` |
| GIF | `47 49 46 38` | `.gif` |
| WebP | `52 49 46 46…57 45 42 50` | `.webp` |
| WAV | `52 49 46 46…57 41 56 45` | `.wav` (skipped: voice recording) |
| PDF | `25 50 44 46` | `.pdf` |

## Import Report Statistics

The report summarizes attachments into these buckets:

| Bucket | Meaning |
|--------|---------|
| ✅ Extracted to vault | Saved as a file (uploads, generated images, Canvas docs) |
| 📄 Inline (embedded) | Content embedded in the note, no separate file |
| ℹ️ Not provided by export | Intentionally absent (voice recordings, omitted generated images) |
| ⚠️ Missing from export | Expected but absent from the archive |
| (failed) | Present but could not be extracted |

## Vibe (Mistral) Export Format

Vibe exports each conversation as an individual `chat-{uuid}.json` file (an array of messages). Attached files are stored in a `chat-{uuid}-files/` sibling directory.

### User-uploaded files

Files attached by the user are listed in `message.files[]` (`{ name, type }`). They are extracted from the `chat-{uuid}-files/` directory and linked in the note.

### Generated images (`image_url` chunks)

When the assistant generates an image, it appears as an `image_url` content chunk:

```json
{ "type": "image_url", "imageUrl": "https://mistralaichatupprodswe.blob.core.windows.net/…/image.jpg" }
```

The image is hosted on Mistral's servers and is **not** included in the ZIP export. A `nexus_attachment` placeholder is inserted with a link to the original conversation.

### Generated file references (`file_reference` chunks)

When the assistant generates a file (e.g. a `.docx` summary), it appears as a `file_reference` content chunk:

```json
{
  "type": "file_reference",
  "fileReference": "resume.docx",
  "fileAlt": "Télécharger le résumé",
  "fileUrl": "https://mistralaichatupprodswe.blob.core.windows.net/…/resume.docx"
}
```

The file is hosted on Mistral's servers and is **not** included in the ZIP export. A `nexus_attachment` placeholder is inserted (using `fileAlt` as display name when available) with a link to the original conversation.

### Canvas items (`canvas[]` field)

The `canvas` field on each message holds a list of canvas items produced during the conversation. Two types are supported:

| Type | Content | Rendering |
|------|---------|-----------|
| `slides` | Marp-formatted slide deck | Collapsible `nexus_canvas` callout with content in a code block (preserves `---` slide separators) |
| `text/markdown` | Markdown document | Collapsible `nexus_canvas` callout with the document rendered directly |

The `canva` content chunk type is a reference marker pointing to a canvas item and is silently skipped (the content comes from `message.canvas[]`).

## Troubleshooting

### Missing attachments

Possible causes: the file was not included in the original export; the conversation predates the provider storing files; or the file type is not included by the export. The plugin writes an explanatory placeholder — this is expected.

### Failed attachments

Possible causes: a corrupted file in the archive, insufficient permissions, or insufficient disk space. Check the error logs and available disk space.

### Generated images not appearing

Recent ChatGPT exports may omit generated images entirely (see [above](#generated-image-omission-2026-regression)). The plugin cannot recover a file that the export does not contain; it surfaces a placeholder so the loss is visible. Open the original conversation to view the image.
