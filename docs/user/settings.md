# Settings

Open **Settings → Nexus AI Chat Importer**. There are four sections.

## Folder structure

Three folders, each chosen with **Browse** (you can create a new folder from the
picker). The path field itself is read-only.

| Setting | Default | Holds |
|---|---|---|
| Conversation folder | `Nexus/Conversations` | Imported conversation notes |
| Reports folder | `Nexus/Reports` | [Import reports](reports.md) |
| Attachment folder | `Nexus/Attachments` | Extracted attachment files |

Consider **excluding the attachment folder from sync** (Obsidian Sync or your
other sync tool) so large files are not uploaded.

### Moving a folder

If you change a folder that already contains files, Nexus asks whether to move the
existing files:

- **Yes, move files** — the files are moved to the new location. The destination
  must be empty.
- Moving **conversations** or **attachments** also **updates the links** in every
  note and report that referenced them, so nothing breaks.
- **No, keep files in the old location** — old files stay where they are and are
  not touched by future imports.
- Report moves are a plain move (nothing links into reports).

The new path may not be located **inside** one of the other two Nexus folders.

## Date prefix

**Add date prefix to filenames** — off by default. When on, each conversation
filename is prefixed with its creation date. The format is **`YYYY-MM-DD`** or
**`YYYYMMDD`** (default `YYYY-MM-DD`). The date uses your computer's local
timezone.

## Message date format

Controls how the timestamp on each message is displayed in a note. It does **not**
affect frontmatter, which is always stored in ISO 8601 UTC.

- **Off (default):** timestamps follow Obsidian's language setting (a localised
  date + time).
- **On:** choose a fixed format — a universal sortable format, US, European,
  German/Swiss, or Japanese style. A live preview is shown.

> The setting's description text mentions a "US format (YYYY/DD/MM)" being forced
> for English. That wording is inaccurate; the actual default follows your
> Obsidian locale. Turn the custom format on if you want a guaranteed layout.

## Support & help

Links to the documentation, release notes, GitHub issues, and the community forum
thread. No configurable options.

## Settings you might have read about elsewhere

Older documentation mentions toggles for disabling attachments, skipping missing
attachments, showing attachment details, a default import mode, or auto-selecting
conversations. **These are not part of the current plugin** and have no effect.
