# ZIP Pipeline

This document describes the unified ZIP reading pipeline used by the plugin.

## Design principles

- **Desktop**: lazy reading via `yauzl` — entries are indexed without decompression; only the requested entry is read on demand.
- **Mobile**: random-access reading via `File.slice` + `DecompressionStream` — no full archive buffered in memory.
- One internal abstraction: `ZipArchiveReader`, used by all provider adapters and attachment extractors.
- One binary entry decompressed at the time of writing — no intermediate in-memory accumulation.

## Internal API

Import code and extractors use:

- `ZipArchiveReader.listEntries()` — enumerate all entries (metadata only)
- `ZipArchiveReader.has(path)` — test for entry existence
- `ZipArchiveReader.get(path)` — open an entry handle
- `ZipEntryHandle.readText()` — decompress and decode as UTF-8
- `ZipEntryHandle.readBytes()` — decompress as raw bytes (Uint8Array)

Extractors no longer depend on the full `JSZip` in-memory object.

## Backends

### Desktop

- Reads the Central Directory via `yauzl`
- Indexes all entries (path → offset) without decompression
- Decompresses one entry at a time, on demand

### Mobile

- Reads the EOCD and Central Directory using `FileReader` + `File.slice`
- Resolves local headers for individual entries
- Decompresses per-entry using `DecompressionStream`

If the archive cannot be parsed cleanly on mobile, the import fails with an explicit error rather than falling back to a risky full-buffer load.

## Attachment lookup index

Each archive builds a metadata-only index at load time:

| Index key | Purpose |
|-----------|---------|
| `byExactPath` | Fast exact-path lookup (primary) |
| `byBaseName` | Fallback when path prefix differs |
| `byFileId` | Resolves `<fileId>.dat` for ChatGPT 2026+ exports |
| `byDalleId` | Resolves DALL-E asset pointers (legacy format) |

The asset-index file `conversation_asset_file_names.json` (ChatGPT 2026+) is also loaded and merged into the lookup, mapping each `.dat` filename to its original name and type.

## Attachment extraction path

The nominal path per attachment:

1. Locate the entry via the index
2. Open one `ZipEntryHandle`
3. Read the content once (text or bytes)
4. Write immediately to the vault via `FileService`
5. Release the local reference

This design avoids relying on GC pauses for memory safety.

## Conversation parsing

Conversations are read as text entries and parsed as JSON. Each provider adapter handles its own entry discovery pattern:

| Provider | Entry pattern |
|----------|--------------|
| ChatGPT | `conversations.json` (root) |
| Claude | `conversations.json` (root) |
| Vibe (Mistral) | `chat-<uuid>.json` (one per conversation) |
| Perplexity | `threads.json` (root) |
