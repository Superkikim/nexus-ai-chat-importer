# Privacy

## The import itself is local

When Nexus AI Chat Importer runs an import, it reads the `.zip` files you select
and writes Markdown and attachment files into your vault through Obsidian's normal
file API. During an import the plugin does **not** upload your conversations
anywhere, contact your AI provider, or send any telemetry or analytics. Provider
chat and media URLs that appear in your notes are ordinary links — nothing is
fetched from them at import time.

## When the plugin does use the network

The plugin makes a small number of network requests, all for its own UI and all
with a local fallback when offline:

- **Welcome and "what's new" dialogs** fetch the project's README / release-note
  content from GitHub so the dialog shows current text. If the request fails, a
  bundled English fallback is shown instead.
- A legacy upgrade path (for very old installs moving off v1.3) queried the GitHub
  releases API.

Beyond that, links you click — documentation, support, GitHub, the Obsidian forum
— open in your browser as normal.

## What the plugin stores

In the vault's plugin data file
(`.obsidian/plugins/nexus-ai-chat-importer/data.json`):

- your settings;
- lightweight metadata about archives you have imported (filename, size,
  modification time, import date);
- upgrade history.

Your conversation content lives only in the vault notes, attachments, and reports
that the import creates — not in the plugin data file.

## Deduplication does not require tracking

The plugin decides whether a conversation already exists by reading the
`conversation_id` in the frontmatter of your existing notes. It does not need, and
does not keep, a separate index of your conversations.

## Reports are local, but not contentless

The [import reports](reports.md) contain archive filenames, conversation titles,
links to your notes, outcome counts, and error details. "Stored locally" does not
mean "contains nothing sensitive" — treat reports like any other vault note when
you share or sync your vault.

## Folder moves read more than the plugin's own files

When you move a configured folder and let the plugin update links, it reads
**every** Markdown file under the *other* configured folders to fix links that
pointed at the moved location — moving the attachment folder scans your
conversation notes; moving the conversation folder scans your reports and artifact
notes. It cannot tell which of those files it originally created, so keep
unrelated notes out of the plugin's folders if that matters to you.

## Related

- [Import reports](reports.md) · [Settings](settings.md) ·
  [What gets created](output.md)
