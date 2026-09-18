# Custom ID property

An optional, user-named frontmatter property (for example `uid`) that carries a
conversation note's `conversation_id`. User-facing behaviour is documented in
[Settings → Properties](../user/settings.md#custom-id-property); this page covers
how it is built. Origin: issue #86, after PR #81 showed that `conversation_id`
itself cannot be renamed — every scan, deduplication and update keys on it.

## Where the code lives

| Piece | File |
|---|---|
| Name validation, line-by-line frontmatter editing | [`src/utils/custom-id-property.ts`](../../src/utils/custom-id-property.ts) |
| Finding conversation notes, running an operation over them | [`src/services/custom-id-property-service.ts`](../../src/services/custom-id-property-service.ts) |
| What committing the name field does (enable, rename, clear, cancel) | [`src/ui/settings/custom-id-property-controller.ts`](../../src/ui/settings/custom-id-property-controller.ts) |
| Settings section, dialogs, progress and summary | [`properties-settings-section.ts`](../../src/ui/settings/properties-settings-section.ts), [`custom-id-property-dialogs.ts`](../../src/dialogs/custom-id-property-dialogs.ts) |
| Writing the property on new and rebuilt notes | `NoteFormatter.generateHeader` in [`note-formatter.ts`](../../src/formatters/note-formatter.ts) |
| Writing the property on updated notes | `ConversationProcessor.ensureCustomIdProperty` in [`conversation-processor.ts`](../../src/services/conversation-processor.ts) |

Settings: `customIdProperty` (empty = off) and `customIdPropertyOverwrite`. A
stored name that no longer validates is treated as off, so a hand-edited
`data.json` cannot produce frontmatter that fails to parse.

## Why existing notes are edited line by line

`app.fileManager.processFrontMatter` was tested on Obsidian 1.13.7 before it was
ruled out. Setting a single key re-serializes the whole block and rewrites fields
that were not touched:

| Before | After |
|---|---|
| `plugin_version: "1.7.1"` | `plugin_version: 1.7.1` |
| `aliases: [a, b]` | a block list |
| `single: 'single quoted'` | `single: single quoted` |
| `# a YAML comment` | removed |
| `num: 007` | `num: 7` |
| CRLF frontmatter | LF frontmatter, CRLF body |

Vaults that use this setting are the ones most likely to run formatting tools on
their frontmatter, so the editor in `custom-id-property.ts` works on raw lines
instead:

- Every line keeps its own line ending; an inserted line takes the ending of the
  line before it.
- A property's extent is its key line plus the indented or column-0 `-`
  continuation lines that follow; trailing blank lines are not part of it.
- The value written is the raw text of the note's own `conversation_id` line, so
  both properties parse to the same value.
- "A value the plugin wrote" means a single-line scalar equal, once unquoted, to
  the note's `conversation_id`. Lists, maps and block scalars never match.

## Finding conversation notes

A conversation note has `nexus: <plugin id>` and a `conversation_id`, and no
`artifact_id` (Claude artifact notes carry the first two as well). The metadata
cache is used rather than reading every file, and notes are not restricted to the
conversation folder.

`getFileCache` returns `null` for a note written since the last index pass, until
Obsidian re-indexes it. Right after a vault-wide run, a second run would miss
those notes; this happened in testing (one note of 4,859 kept the property after
a rename immediately followed by a clear). Notes with no cache entry are therefore
read from disk.

## Running an operation

`CustomIdPropertyService.run` processes notes one at a time. Each note is read,
the edit computed, and a note with nothing to change is not written at all (no new
modification time for sync to pick up). Otherwise the edit is applied through
`vault.process`, recomputed on the content current at that moment. A note that
throws — no frontmatter, no `conversation_id` — is counted as failed and the run
continues.

Rename is not a literal key rename: the old property is removed only where its
value is the plugin's, and every note is then given the new property, following
the overwrite setting. A value the user had under the old name before enabling
the feature is left in place.

## Tests

- `custom-id-property.test.ts`: name validation; add, overwrite, rename and
  remove, including quoted, list and multi-line values, column-0 sequences, CRLF,
  missing frontmatter and missing `conversation_id`.
- `custom-id-property-service.test.ts`: note discovery (cached and not yet
  indexed), outcome counting, unchanged notes not written.
- `custom-id-property-controller.test.ts`: enable, rename and clear, Cancel and
  dismissal restoring the previous name, refused names.
- `note-formatter.test.ts` and `conversation-processor-reconciliation.test.ts`:
  the property on new, rebuilt and updated notes.
- `locale-parity.test.ts` covers the new strings in all ten locales.
