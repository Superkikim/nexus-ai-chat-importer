# Settings

Open **Settings → Nexus AI Chat Importer**. There are five sections, shown in this
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

## 🏷️ Properties

### Custom ID property

Adds an extra property to every conversation note, holding the same value as
`conversation_id`. Use it when your vault identifies notes by a property of its
own, such as `uid`. Empty by default, which adds nothing.

`conversation_id` itself always stays: the plugin relies on it to recognise its
notes. The custom property is a copy, never a replacement.

The name must start with a Latin letter (`A`–`Z`, `a`–`z`) or `_`, followed by
Latin letters, digits, `_` or `-`. These names are refused, in any capitalisation, and the field keeps the
name in effect:

- Obsidian's own properties: `tags`, `aliases`, `cssclasses`, `tag`, `alias`,
  `cssclass`.
- Obsidian Publish properties: `publish`, `permalink`, `description`, `image`,
  `cover`.
- Properties the plugin already writes: `nexus`, `plugin_version`, `provider`,
  `conversation_id`, `create_time`, `update_time`, `mode`, `models`.

The name is applied when you press Enter, leave the field, or close Settings —
not while you type. From then on, every import,
update and rebuild writes the property, right after `conversation_id`. What
happens to notes you already have depends on the change:

| Change | What the plugin does to existing notes |
|---|---|
| **Enable** (empty → a name) | Asks first, showing how many notes will get the property and how many already have one with that name. Then adds it to every note. |
| **Rename** (a name → another) | Asks first. Then removes the old property where its value is the note's conversation ID, and gives every note the new one. |
| **Clear** (a name → empty) | Asks what to do: remove the property where its value is the note's conversation ID (recommended), remove it from every note whatever its value, or keep it. |

**Cancel**, or closing the dialog, puts the previous name back in the field and
changes nothing. When there is nothing to update (no conversation notes yet, or
no note carrying the property you clear), the plugin saves the change without
asking. Each run ends with a summary: notes added, renamed, overwritten,
removed, left unchanged, and failed. A note that cannot be updated is listed
with the reason and left as it was; the others are still processed. A property
whose value spans several lines in an unusual layout (for example a list with a
comment between its items) is never cut short: that note is reported instead.

Only the property is ever changed: no note is deleted, renamed or moved, and
every other line of the frontmatter stays exactly as it was, comments, quotes
and line endings included.

On rename, an old property whose value is **not** the conversation ID is left in
place: it was there before the plugin used that name, so it is yours.

Keeping the property after clearing the field is not permanent: a
[rebuilt](importing.md#updates-and-rebuilds) note is regenerated without it.

### Overwrite existing values

The switch next to the name field, off by default. Decides what happens when a note already has a property with the
chosen name and a different value — on enabling, on renaming, and on every
later update:

- **Off:** the plugin leaves that property as it is.
- **On:** the plugin replaces its value with the conversation ID.

A property that already holds the conversation ID is left alone either way.

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

> **Files kept in the old location leave the plugin's scope.** The plugin only
> tracks the *configured* folders — left-behind notes and attachments get no
> further updates, deduplication, rebuilds, or link maintenance, and a later
> re-import creates a new note instead of updating the old one. Move them into
> the configured folder to restore that.

## Related

- [What gets created](output.md) · [Importing conversations](importing.md)
