# Archive pipeline

The unified ZIP reading and classification layer. Every provider adapter and
attachment extractor goes through it; none of them buffer a whole archive in
memory.

Primary sources: [`src/utils/zip/`](../../src/utils/zip/) (re-exported through
[`src/utils/zip-loader.ts`](../../src/utils/zip-loader.ts)),
[`src/utils/zip-content-reader.ts`](../../src/utils/zip-content-reader.ts),
[`src/utils/container-archive.ts`](../../src/utils/container-archive.ts),
[`src/services/archive-mode-decider.ts`](../../src/services/archive-mode-decider.ts).

## Design principles

- **Desktop**: streaming reads via `yauzl` from the selected filesystem path. The
  central directory is indexed without decompression; a requested entry is
  decompressed on demand.
- **Mobile / browser**: random-access reads over the in-memory `File` via a custom
  end-of-central-directory + central-directory parser and `DecompressionStream`.
  If the archive cannot be parsed cleanly, the import fails with an explicit error
  rather than falling back to a full-buffer load.
- **One abstraction**: `ZipArchiveReader`, created by `createZipArchiveReader(file,
  shouldInclude?)`, which picks the desktop or mobile backend from whether the
  `File` carries a `path`.

## Reader API

[`src/utils/zip/types.ts`](../../src/utils/zip/types.ts):

| Member | Purpose |
|---|---|
| `ZipArchiveReader.listEntries()` | All entries as `{ path, size }` (metadata only). |
| `ZipArchiveReader.has(name)` | Entry-existence test. |
| `ZipArchiveReader.get(name)` | Open a `ZipEntryHandle`, or `null`. |
| `ZipEntryHandle.readText()` | Decompress and decode UTF-8. |
| `ZipEntryHandle.readBytes()` | Decompress to `Uint8Array`. |
| `ZipEntryHandle.readTextChunks?()` | Optional streaming text generator, used for very large conversation JSON. |
| `enumerateZipEntries(file, shouldInclude?)` | Convenience: create a reader and return `listEntries()`. |

An optional `shouldInclude(entryName, uncompressedSize)` predicate — supplied by a
provider adapter's `shouldIncludeZipEntry` — filters entries during indexing.

## Classification

[`classifyArchiveEntries()`](../../src/utils/zip-content-reader.ts) decides the
provider from entry names, with a content probe for the one case names cannot
resolve.

| Provider | Recognised payload |
|---|---|
| ChatGPT | root `conversations.json`, or numbered `conversations-NNN.json` (sorted and merged). Signature: a conversations JSON **without** `users.json`. |
| Claude | root `conversations.json` **plus** `users.json` (legacy combined export); **or** an archive whose only meaningful entry is `conversations.json` and whose head contains `chat_messages` and not ChatGPT `mapping` (newer split export — `users.json` not required). |
| Mistral Vibe | one or more root `chat-<hex/uuid>.json` files, each a top-level message array (one conversation per file). |
| Perplexity | JSON files whose basename starts with `perplexity_` (may sit below a directory). Two schemas are normalised downstream. |

Rules that public docs also state, kept here for reference:

- Loose JSON files are never imported; the payload must be inside a `.zip`.
- An archive that only wraps other ZIPs is not an importable provider archive. The
  sole exception is a recognised OpenAI Privacy Portal container
  (`expandContainerArchives`), which is unwrapped only when its inner conversation
  ZIP (`*-chatgpt-<digits>*.zip`) is **stored** (uncompressed) and classifies as
  supported. Sibling `Files__…` archives are ignored.
- Selecting a provider that does not match the archive raises a "wrong provider"
  error naming what the archive actually is; detection already knows.
- Companion Claude archives (project / memory / light-metadata) are rejected as
  non-conversation parts.

## Large-archive strategy

[`archive-mode-decider.ts`](../../src/services/archive-mode-decider.ts) classifies
an archive as "large" when it is at least **100 MiB** compressed, or a known
conversations JSON is at least **250 MiB** uncompressed. A conversation JSON at
least **32 MiB** uses the chunked streaming read path in both metadata extraction
and import.

These are strategy thresholds that switch on streaming and extra event-loop
yielding. They are **not** advertised hard maximum file sizes, and user
documentation must not present them as such.
