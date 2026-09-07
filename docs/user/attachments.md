# Attachments

Nexus AI Chat Importer handles attachments on a **best-effort** basis: whatever is
present in the export is saved and linked; whatever is missing is shown as an
explicit placeholder rather than silently dropped. Every outcome is counted in the
[import report](reports.md).

## What happens to a file

| The export contains… | Result in the note |
|---|---|
| An image | Saved under `<Attachment folder>/<provider>/…` and **embedded** (`![[ ]]`) in the message. |
| A document or other file (PDF, `.docx`, code, …) | Saved and **linked** (`[[ ]]`) in the message. |
| Text extracted inline by the provider (e.g. Claude) | Shown directly in a collapsible attachment callout, no separate file. |
| A reference to a file whose bytes are **not** in the export | A placeholder callout: *"Not included in export"*, with a link to the original conversation when the provider gives one. |
| A file the provider never includes by design (e.g. ChatGPT voice audio) | A placeholder noting it is not part of the export. |
| A file present but unreadable / corrupted | Marked as failed, with the reason. |

Placeholder wording you may see: *Not included in export*, *Extraction failed*,
*File appears corrupted*, *Unsupported file format*.

The real file type of an unlabelled payload is detected from its content, so an
image saved by the provider without an extension still lands as `.png`, `.jpg`,
etc. Name collisions get a numeric suffix.

## Destinations

Files are organised per provider beneath the attachment folder, for example
`chatgpt/images/` and `chatgpt/documents/`. The exact set of subfolders depends on
the provider and what the export contained — there is no single fixed layout.

## Why an attachment can be missing

This is **provider- and export-dependent**, not a plugin fault:

- older exports from some providers did not include uploaded files at all;
- some providers only ever reference generated images/files by a remote URL and
  never bundle the bytes;
- some file types are intentionally excluded.

See the provider page for specifics:
[ChatGPT](providers/chatgpt.md#attachments-and-generated-content) ·
[Claude](providers/claude.md#attachments-and-artifacts) ·
[Mistral Vibe](providers/mistral-vibe.md#attachments) ·
[Perplexity](providers/perplexity.md#attachments).

## Recovering attachments later

If a newer export from your provider now includes files an earlier import could
not get, re-import that archive with **Reprocess** / **Rebuild** (see
[updates and rebuilds](importing.md#updates-and-rebuilds)). Placeholders are
replaced with the real files, and the operation does not create duplicates — but
note it **regenerates the whole note**, so any manual edits to those notes are
lost.

## Related

- [What gets created](output.md) · [Import reports](reports.md) ·
  [Importing conversations](importing.md) · [Troubleshooting](troubleshooting.md)
