# Importing conversations

This page covers the shared import workflow for every provider. Provider-specific
export steps and behaviour are on the [provider pages](README.md#provider-pages).

## Running an import

Run **Import AI conversations** from the command palette or the ribbon icon, then
pick one or more `.zip` files. The picker accepts `.zip` only — never a loose JSON
file, and never an archive you have unzipped yourself.

### Provider is detected, then locked

You do not choose the provider. The plugin reads the selected archives, sorts them
(by a timestamp embedded in the filename when present, otherwise by
last-modified date, then by name), and **locks the import to the first supported
archive**. Any later archive that belongs to a different provider, or is not a
recognised export, is skipped and listed in the report rather than imported under
the wrong provider.

**Import one provider at a time.** Mixing providers in a single selection just
means the others are ignored.

### OpenAI "Privacy Portal" container archives

If you request a ChatGPT export through OpenAI's privacy portal, the download is
sometimes an outer `.zip` that contains the real conversation `.zip` inside it.
Nexus recognises this specific case and unwraps it automatically. For any other
"a zip inside a zip" archive, extract the outer file yourself and import the inner
one — the plugin will tell you when this is needed.

## Import All vs Select Specific

The first dialog offers two modes.

### Import All (default)

Imports every new and updated conversation from the selected archive(s).

- On **desktop**, all selected archives are analysed together: duplicate
  conversations that appear in more than one archive are removed, and each
  conversation is compared against your vault.
- Conversations that already exist and have not changed are skipped, unless you
  tick **Reprocess existing notes** (see [rebuilding](#updates-and-rebuilds)).

### Select Specific

Analyses the archive and lets you choose conversations before importing.

- Search by title; filter with the **New / Updated / Unchanged** chips (default:
  New + Updated); sort by title, creation time, update time, or message count
  (default: update time, newest first).
- Nothing is selected by default. **Select All** selects every conversation that
  matches the current filter, across all pages — not just the visible page.
- Page size is 10 / 20 / 50 / 100; your last choice is remembered (starts at 50).

## Updates and rebuilds

Nexus identifies an existing note by the `conversation_id` in its frontmatter, not
by its file path or title. Re-importing is how you keep notes current.

| You want to… | Do this | Result |
|---|---|---|
| Add new messages from a fresh export | Re-import (Import All, or Select Specific with the conversation ticked) | New messages are **appended**; earlier messages, formatting, and your manual edits are left untouched. The note is recorded as **Updated**. |
| Rebuild notes after a plugin update, to pick up new features | Import All with **Reprocess existing notes** ticked | Each existing note is **regenerated from scratch** from the archive. Recorded as **Recreated**. |
| Rebuild only specific notes | Select Specific → tick the conversations → tick **Rebuild selected notes if they exist** | Only those notes are regenerated. |

> **Rebuilding replaces the whole note.** Any manual edits you made to a rebuilt
> note are lost. A normal update never does this.

Notes on update behaviour:

- A conversation whose export timestamp is in the same minute as the stored one,
  or older, counts as **Unchanged** and is skipped.
- An export that is newer but has no new messages still refreshes the note's
  metadata so it is not offered as "newer" again.
- If a catalogued note has been deleted from the vault, re-importing recreates it
  at its original path.

## "Nothing new" is not an error

If an archive contains no new or updated conversations — or you import Select
Specific and choose nothing — that is a normal outcome. Nexus shows a notice and
still writes the [import report](reports.md).

## Desktop vs mobile

| | Desktop | Mobile |
|---|---|---|
| Files per import | Multiple `.zip`, drag-and-drop supported | **One `.zip`** (the file input is single-select, and later steps keep only the first) |
| Import All | Cross-archive analysis and deduplication | The single archive is imported directly, without the separate analysis phase |
| Select Specific, Reprocess, rebuild | Available | Available |

For very large archives, see
[large archives](troubleshooting.md#large-archives).

## Related

- [What Nexus creates](output.md) · [Attachments](attachments.md) ·
  [Import reports](reports.md) · [Troubleshooting](troubleshooting.md)
