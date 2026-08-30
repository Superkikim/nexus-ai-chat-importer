# Claude export format

Maintainer reference for the Claude (Anthropic) data export the importer consumes.
Anthropic does not publish a format spec, so this is observation from real exports
and the fixtures under `local_resources/claude/`, plus the types the adapter
relies on. It can change without notice.

Companion: the user-facing page is
[docs/user/providers/claude.md](../../user/providers/claude.md).

## Delivery

The plugin only ever sees the final conversations `.zip`. How the user gets there
has changed:

- **Older exports** arrived as a single downloadable `.zip`.
- **Recent exports** are delivered as a small **JSON file** listing four download
  links (conversations plus other account data such as projects). The user must
  open the JSON, follow the **conversations** link, and download that `.zip`
  themselves before importing it.

The plugin does not read the JSON index and has no knowledge of it; document it only so
users know which file to hand the plugin.

The export UI also offers a **time range** (All / 30 days / 90 days / custom).
Smaller windows produce smaller archives; overlapping windows are safe because
existing-note detection is by `conversation_id`.

## Recognised archive layouts

Classification is in
[`zip-content-reader.ts`](../../../src/utils/zip-content-reader.ts):

| Layout | Recognition |
|---|---|
| Legacy combined | root `conversations.json` **and** `users.json`. |
| Newer split | a `.zip` whose only meaningful entry is `conversations.json`; a content probe confirms Claude when the head contains `chat_messages` and not ChatGPT `mapping`. `users.json` lives in a separate part and is not required. |

Companion archives (project / memory / light-metadata parts) are explicitly
rejected as non-conversation imports; `zip-content-reader.test.ts` pins
representative examples.

## Data shape

Types: [`claude-types.ts`](../../../src/providers/claude/claude-types.ts).
Adapter detection requires `uuid`, a `name` field, a `chat_messages` array, and
`created_at` / `updated_at`
([`claude-adapter.ts`](../../../src/providers/claude/claude-adapter.ts)).

- **`ClaudeConversation`** — `uuid`, `name`, `account.uuid`, `created_at`,
  `updated_at`, `chat_messages[]`, optional `summary`, `model`.
- **`ClaudeMessage`** — `uuid`, `text`, `sender` (`human` | `assistant`),
  `created_at`, `content[]` (typed blocks), `attachments[]`, `files[]`.
- **`ClaudeContentBlock`** — `type` is `text` | `thinking` | `tool_use` |
  `tool_result`; carries `text`, `thinking`, `citations[].details.{url,title}`,
  and tool fields (`name`, `input`, `content[]`).
- **`ClaudeAttachment`** — `file_name` (often empty), `file_size`, `file_type`,
  and `extracted_content` (the full extracted text of an uploaded file).
- **`ClaudeFile`** — `file_name` and optional `file_uuid` for a referenced
  physical file (typically an image).

## Conversion notes

[`claude-converter.ts`](../../../src/providers/claude/claude-converter.ts),
[`claude-message-filter.ts`](../../../src/providers/claude/claude-message-filter.ts).

- Only exportable human/assistant messages survive; empty or internal
  tool-only messages are dropped.
- **Inline attachments** — `attachments[].extracted_content` is rendered in a
  collapsible callout, formatted by inferred type. Long extracts are externalised
  (see [attachment handling](../attachment-handling.md)).
- **Named files** — `files[]` entries are looked up in several conventional ZIP
  locations; a present payload is extracted (image / text / document), an absent
  one becomes an "unavailable" placeholder with a Claude link.
- **Artifacts** — two shapes are supported:
  - old format: `tool_use` blocks named `artifacts` carrying a `command`
    (`create` / `update` / `rewrite`, `view` skipped) and a `version_uuid`;
  - new format: `create_file` (initial) and `str_replace` (edits) tool blocks.

  Both produce versioned Markdown artifacts. Blocks that only exist to generate a
  binary output referenced by a `computer:///` link are intentionally **not**
  turned into artifacts; those outputs stay placeholders.
- **Citations** — `buildReferencesSection()` scans a message's `text` blocks for
  `citations[].details.url`, de-duplicates by URL **within that message**, and
  appends a `### References` numbered list (`[title || url](url)`). The citation
  `start_index` / `end_index` offsets are intentionally ignored; snippets are not
  reproduced. A citation with no URL is skipped.
