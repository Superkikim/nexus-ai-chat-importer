# Link updates

When a user changes a configured folder path in settings and chooses to move the
existing files, the plugin rewrites the wikilinks and Markdown links that pointed
into the old location so nothing breaks.

Primary sources:
[`src/services/link-update-service.ts`](../../src/services/link-update-service.ts),
[`src/dialogs/enhanced-folder-migration-dialog.ts`](../../src/dialogs/enhanced-folder-migration-dialog.ts),
[`src/dialogs/folder-migration-dialog.ts`](../../src/dialogs/folder-migration-dialog.ts),
[`src/ui/settings/folder-settings-section.ts`](../../src/ui/settings/folder-settings-section.ts),
[`src/utils.ts`](../../src/utils.ts) (`moveAndMergeFolders`).

## When it runs

| Folder changed | Dialog | Link updates |
|---|---|---|
| Conversation folder | enhanced migration dialog | updates references in reports and attachment notes that point at the moved conversations |
| Attachment folder | enhanced migration dialog | updates references in every conversation note that embeds/links the moved attachments |
| Reports folder | standard migration dialog | none needed (nothing links **into** reports) |

The destination folder must be empty. Moving is opt-in: the dialog also offers
"keep files in the old location", in which case old files are left untouched and
are not affected by future updates.

## What gets rewritten

The service reads every Markdown file whose path falls under the affected
configured root and rewrites matching links only. It does not, and cannot,
distinguish notes it created from notes the user placed in the same folder — any
Markdown under the configured root is in scope for a matching-link rewrite.

Recognised link shapes:

- Markdown image and file links: `![alt](oldRoot/…)`, `[text](oldRoot/…)`
- Obsidian embeds and links: `![[oldRoot/…]]`, `[[oldRoot/…]]`, including the
  `[[oldRoot/…|alias]]` form

Old paths are regex-escaped before substitution to prevent pattern injection.

## Processing

- Conversation and artifact files are processed in batches of **10**; report files
  in batches of **5**.
- A **10 ms** yield separates batches to keep the UI responsive.
- A per-file error is recorded and skipped; it does not stop the run.
- Progress callbacks report percentage and current file to the progress modal.
  They are progress-reporting only — the migration itself has no cancellation
  signal once it starts.
