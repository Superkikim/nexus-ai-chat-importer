# Troubleshooting

Common failures when importing with Nexus AI Chat Importer, and how to diagnose
them safely.

## Import won't start / archive rejected

The exact message wording can change between versions; match on the gist.

| Message you see | Cause and fix |
|---|---|
| *"Only ZIP files are supported. The file must have a .zip extension."* | The file is not a `.zip`. Import the archive as downloaded; don't unzip it. The same dialog notes: downloading a Claude export with **Firefox on Mac** can produce a `.dat` file — just rename it to `.zip` (do **not** extract and re-compress). |
| *"This ZIP file does not match any supported export format."* / *"…does not look like a supported export or is not a valid ZIP archive."* | The archive isn't a recognised export. Check you downloaded the conversation export, not a companion archive (Claude project/memory parts, ChatGPT `Files__…` parts). |
| *"This ZIP is a &lt;X&gt; export, not a &lt;Y&gt; one. Pick the matching provider to import it."* | The selection locked onto a different provider. Import one provider at a time. |
| *"The ZIP file contains no files…"* | The `.zip` has no data. Re-download the export. |
| *"The file appears to be corrupted or is not a valid ZIP file. Please try downloading the export again…"* | The download is damaged. Download it again. |
| *"This ZIP contains other ZIP files. Extract the outer ZIP and import the inner ZIP files directly."* | A zip inside a zip. Extract the outer one and import the inner conversation zip(s). The one case the plugin unwraps by itself is an OpenAI privacy-portal container — see [importing](importing.md#openai-privacy-portal-container-archives). |
| *"No supported &lt;provider&gt; archives were found…"* | None of the selected files matched. Check the export type. |
| *"The mobile webview could no longer access this file. Please reselect this ZIP and retry."* | Mobile dropped the file reference. Re-select the file and try again. |
| *"On mobile, only one ZIP can be imported at a time…"* | Expected on mobile — select a single `.zip`. |

## Nothing was imported

If the report shows everything as **Unchanged**, the archive had nothing newer
than what's already in your vault — that's normal. To force a refresh of existing
notes, use **Reprocess** / **Rebuild** (see
[updates and rebuilds](importing.md#updates-and-rebuilds)).

## An attachment is missing or shows a placeholder

This is usually the export, not the plugin — the file simply wasn't in the archive.
See [Attachments](attachments.md#why-an-attachment-can-be-missing) and your
provider page. If a newer export includes the file, re-import with **Rebuild** —
which [regenerates the whole note](importing.md#updates-and-rebuilds), so manual
edits to it are lost.

## A conversation shows as "Failed" in the report

One conversation failing does not stop the import — the rest still run. The
[report](reports.md) lists the failed conversation and the reason, and more
detail is printed to the developer console (below). Common causes are a write
that Obsidian rejected (permissions, no disk space, an invalid path) or a
malformed conversation in the export. Fix the underlying cause and re-import; a
previously failed conversation is retried on the next run.

## Large archives

The plugin streams large archives rather than loading them whole, and switches to a
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
