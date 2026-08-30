# Settings

Open **Settings → Nexus AI Chat Importer**. There are four sections, shown in this
order.

## 💝 Support & Help

Links to the documentation, release notes, GitHub issues, and the community forum
thread. No configurable options.

## 📅 Date Prefix

**Add date prefix to filenames** — off by default. When on, each conversation
filename is prefixed with its creation date. The format is **`YYYY-MM-DD`** or
**`YYYYMMDD`** (default `YYYY-MM-DD`). The date uses your computer's local
timezone.

## 📅 Message Date Format

Controls how the timestamp on each message is displayed in a note. It does **not**
affect frontmatter, which is always stored in ISO 8601 UTC.

- **Off (default):** timestamps follow Obsidian's language setting — a localised
  short date and time.
- **On:** choose a fixed format — a universal sortable format, US, European,
  German/Swiss, or Japanese style. A live preview is shown. Use this if you want
  a layout that does not depend on the Obsidian language.

## 📁 Folder Structure

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

If you change a folder that already contains files, the plugin asks whether to move the
existing files:

- **Yes, move files** — the files are moved to the new location. The destination
  must be empty.
- Moving **conversations** or **attachments** also **updates the links** in the
  notes and reports that referenced them, so nothing breaks.
- **No, keep files in the old location** — old files stay where they are and are
  not touched by future imports.
- Report moves are a plain move (nothing links into reports).

The new path may not be located **inside** one of the other two configured folders.

> **If you change a folder path but do not move the existing files, those files
> leave the plugin's scope.** The plugin only ever looks inside the *configured*
> folders. Notes and attachments left behind at the old path are no longer
> tracked: they will not be found for incremental updates, deduplication, or
> rebuilds, their links are not maintained, and re-importing the same
> conversation later creates a fresh note in the new location instead of updating
> the old one. There is no guarantee about their state going forward. To bring
> them back under management, move them into the configured folder (via this
> dialog, or manually).

## Settings you might have read about elsewhere

Older documentation mentions toggles for disabling attachments, skipping missing
attachments, showing attachment details, or a default import mode. **These are not
part of the current plugin.** A leftover "auto-select all conversations" flag also
exists in the code but has no UI and cannot be enabled.

## Related

- [What gets created](output.md) · [Importing conversations](importing.md)
