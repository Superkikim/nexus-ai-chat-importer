# Troubleshooting

## Import won't start / archive rejected

| Message | Cause and fix |
|---|---|
| Invalid or unsupported extension | The file is not a `.zip`. Import the archive as downloaded; don't unzip it. **Firefox on macOS** sometimes saves a Claude export as `.dat` — rename the extension to `.zip` (do not extract and re-compress). |
| Unsupported archive / wrong provider | The archive isn't a recognised export, or it belongs to a different provider than the one locked for this import. Import one provider at a time; check you downloaded the conversation export, not a companion archive. |
| Empty archive | The `.zip` has no conversation data. Re-download the export. |
| Corrupt archive / invalid central directory | The download is damaged. Download it again. |
| Nested ZIP / "extract the outer archive" | The file is a zip containing another zip. Extract the outer one and import the inner conversation zip. (The one exception Nexus unwraps automatically is an OpenAI privacy-portal container — see [importing](importing.md#openai-privacy-portal-container-archives).) |
| Missing expected conversation file | The archive is a `.zip` but doesn't contain the JSON the provider is expected to include. Re-download; check it's the right export type. |
| Mobile: "file handle lost" | Mobile can drop the reference to a picked file. Re-select the file and try again. |

## Nothing was imported

If the report shows everything as **Unchanged**, the archive had nothing newer
than what's already in your vault — that's normal. To force a refresh of existing
notes, use **Reprocess** / **Rebuild** (see
[updates and rebuilds](importing.md#updates-and-rebuilds)).

## An attachment is missing or shows a placeholder

This is usually the export, not the plugin — the file simply wasn't in the archive.
See [Attachments](attachments.md#why-an-attachment-can-be-missing) and your
provider page. If a newer export includes the file, re-import with Rebuild.

## Large archives

Nexus streams large archives rather than loading them whole, and switches to a
heavier-duty path when an archive is roughly 100 MB or more, or its conversation
JSON is very large. These are internal strategy switches, **not** a hard maximum —
there is no advertised size limit. A very large import can simply take a while,
especially on mobile, where you can import only one archive at a time.

## Getting more detail

Most archive, report, and attachment errors also print detail to Obsidian's
**developer console** (Ctrl/Cmd-Shift-I → Console). For deeper logging, set one of
these **before** the plugin loads and reload Obsidian:

- console: `window.NEXUS_LOG_LEVEL = "debug"`
- or localStorage key `nexus-ai-chat-importer:log-level` = `debug`

There is no settings toggle for log level.

## Still stuck

Check the configured [destination folders](settings.md) exist and aren't nested in
each other, then open an issue with the report summary and any console output:
[github.com/Superkikim/nexus-ai-chat-importer/issues](https://github.com/Superkikim/nexus-ai-chat-importer/issues).
