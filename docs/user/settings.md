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

- **Off (default):** timestamps follow Obsidian's language setting (a localised
  date + time).
- **On:** choose a fixed format — a universal sortable format, US, European,
  German/Swiss, or Japanese style. A live preview is shown.

> **Known copy bug.** The plugin's own help text for this setting — in every
> language — claims that with Obsidian set to English it "enforces" a
> "US format (YYYY/DD/MM)". That is wrong: no code path forces this, and
> `YYYY/DD/MM` isn't a real format. When the setting is off, timestamps simply
> follow your Obsidian locale. Turn the custom format on if you want a layout
> that does not depend on the locale.

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

## Settings you might have read about elsewhere

Older documentation mentions toggles for disabling attachments, skipping missing
attachments, showing attachment details, or a default import mode. **These are not
part of the current plugin.** A leftover "auto-select all conversations" flag also
exists in the code but has no UI and cannot be enabled.

## Related

- [What gets created](output.md) · [Importing conversations](importing.md)
