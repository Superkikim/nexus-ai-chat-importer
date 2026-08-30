# Privacy

## The import itself is local

Importing reads the `.zip` files you select and writes Markdown and attachment
files into your vault through Obsidian's normal file API. During an import the
plugin does **not** upload your conversations anywhere, contact your AI provider,
or send any telemetry or analytics. Provider chat and media URLs that appear in
your notes are ordinary links — nothing is fetched from them at import time.

## When the plugin does use the network

It is not accurate to say the plugin never makes a network request. Two cases,
both for its own UI and both with a local fallback if offline:

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
  modification time, import date) — this is not a content hash and is not
  currently used to skip re-imports;
- upgrade history.

Your conversation content lives only in the vault notes, attachments, and reports
that the import creates — not in the plugin data file.

## Deduplication does not require tracking

Nexus decides whether a conversation already exists by reading the
`conversation_id` in the frontmatter of your existing notes. It does not need, and
does not keep, a separate index of your conversations.

## Reports are local, but not contentless

The [import reports](reports.md) contain archive filenames, conversation titles,
links to your notes, outcome counts, and error details. "Stored locally" does not
mean "contains nothing sensitive" — treat reports like any other vault note when
you share or sync your vault.

## Folder moves read more than Nexus's own files

When you move a configured folder and let Nexus update links, it reads **every**
Markdown file under the *other* Nexus roots to fix links that pointed at the moved
location — moving the attachment folder scans your conversation notes; moving the
conversation folder scans your reports and the `claude/artifacts` area of the
attachment folder. It cannot tell which of those files it originally created, so
keep unrelated notes out of the Nexus folders if that matters to you.

## Related

- [Import reports](reports.md) · [Settings](settings.md) ·
  [What Nexus creates](output.md)
