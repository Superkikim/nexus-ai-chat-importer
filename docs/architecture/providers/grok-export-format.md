# Grok export format

Maintainer reference for the Grok (xAI) data export the importer consumes. xAI
publishes no format spec, so this is observation from one real contributor export
(256 conversations, 555 Imagine posts, 254 assets) plus the types the adapter
relies on. It can change without notice, and a single archive is thin evidence —
treat the counts below as what was seen, not as guarantees.

Companion: the user-facing page is
[docs/user/providers/grok.md](../../user/providers/grok.md).

## Delivery and archive layout

The user requests the export from Grok's **Data Controls → Download account
data** (`accounts.x.ai/data`) and receives a download link by email. The plugin
sees that `.zip` as downloaded.

Inside, the payload sits under folders whose names vary between exports: the
observed archive nested everything under `ttl/30d/export_data/<user id>/`, where
`30d` reads as a retention window. Nothing in the importer depends on that path.

| Entry | Role |
|---|---|
| `…/prod-grok-backend.json` | the whole export: conversations, Imagine posts, projects, tasks |
| `…/prod-mc-asset-server/<asset id>/content` | every file, with no name and no extension |
| `…/prod-mc-auth-mgmt-api.json`, `…/prod-mc-billing.json` | account and billing; never read |

The asset paths in the observed archive carry a **doubled slash**
(`prod-mc-asset-server//<id>/content`), which the lookup pattern tolerates.

## Recognition

Classification is in
[`zip-content-reader.ts`](../../../src/utils/zip-content-reader.ts): an archive is
Grok when any entry's base name is `prod-grok-backend.json` (case-insensitive) and
no root `conversations.json` is present. Depth and parent folders are irrelevant,
which is what keeps a differently nested export recognisable.

`extractRawConversations()` and `extractConversationsStream()` then read that one
file twice, streaming `conversations` and then `media_posts`
(`GROK_ITEM_ARRAYS`) through
[`StreamingJsonArrayParser`](../../../src/utils/streaming-json-array-parser.ts).
The parser takes the array key as an argument for this export, and holds only the
chunk it is scanning, so the second array can sit behind a large first one (16 MB
of conversations in the observed archive). A payload with no `media_posts` yields
its conversations alone.

Both arrays feed the same item stream, so **one adapter handles two kinds of
item**, told apart structurally
([`grok-types.ts`](../../../src/providers/grok/grok-types.ts):
`isGrokConversation`, `isGrokMediaPost`).

## Data shape

Types: [`grok-types.ts`](../../../src/providers/grok/grok-types.ts). Only the
fields the importer reads are declared; the export carries many more.

```
{ "conversations": [ { "conversation": { id, title, create_time, modify_time, … },
                       "responses":    [ { "response": { … } } ] } ],
  "projects": [ … ], "tasks": [ … ],
  "media_posts": [ { id, original_prompt, media_type, create_time, link } ] }
```

- **Conversation** — `id` (UUID), `title` (always filled in the observed
  archive), `create_time` / `modify_time` as ISO strings. `summary` exists but was
  empty everywhere. `leaf_response_id` was always `null`.
- **Response** — one message, human or assistant alike (the backend calls both a
  "response"): `_id` (UUID), `sender`, `message` (Markdown), `model`,
  `create_time` as a Mongo-style `{ $date: { $numberLong: "<ms>" } }`,
  `file_attachments[]` (asset ids), `card_attachments_json[]` (JSON strings),
  `generated_image_urls[]`, plus reasoning and tool fields that are ignored.
- **Media post** — an Imagine post: `id`, `original_prompt` (often empty),
  `media_type` (`image` | `video`), `create_time`, `link`.

### Facts the conversion depends on

- **`sender` is the only authority on authorship.** Values seen: `human`,
  `assistant`, and `ASSISTANT` (older rows, still present in 2026 conversations).
  `model` is filled on human messages too — it is the model the user selected, not
  the author — so it must never be used to infer a role.
- **Timestamps are milliseconds.** One tie was found in 2 180 responses, between a
  question and its answer, so the sort needs a tie-break beyond the timestamp.
- **`parent_response_id` is not needed.** Sorting by timestamp respected
  parent-before-child in 1 920 of 1 921 links (the exception being that tie).
- **`modify_time` lags.** In 26 of 256 conversations, responses were newer than the
  conversation's `modify_time`, by up to ~4.5 days.

## Conversion notes

[`grok-converter.ts`](../../../src/providers/grok/grok-converter.ts).

- **Ordering** — messages are sorted by millisecond timestamp, then by "human
  first", then by id. Regenerated answers are all kept, in order; the message tree
  is ignored.
- **Timestamps** — `parseMongoDate()` yields fractional unix seconds so the
  millisecond order survives; `getCreateTime()` / `getUpdateTime()` floor to whole
  seconds for the adapter contract. The conversation's update time is
  `max(modify_time, last message, create_time)`, because of the lag above.
- **Dropped responses** — a response with no text and no file is skipped (23 in
  the observed archive: interrupted, partial or errored answers). A conversation
  left with no message is declined as `"no messages"` (see below).
- **Cards** — `card_attachments_json[]` holds one JSON card per entry, keyed by
  `id`; the message text references them as
  `<grok:render card_id="…" …><argument …>…</argument></grok:render>`. Every one of
  the 741 references resolved in the observed archive. `citation_card` becomes
  ` [<host>](url)`, `image_card` becomes ` [🖼️ <title>](link)` (a link to the
  page, never a remote embed), and an unresolved tag is dropped.
- **Artifacts** — `<xaiArtifact artifact_id … artifact_version_id … title …
  contentType …>…</xaiArtifact>` is inline in the message, so it is rendered in
  place as a collapsed callout
  ([`renderCollapsedCallout`](../../../src/utils/collapsed-callout.ts), shared with
  Vibe canvases), fenced for anything that is not Markdown or plain text. No
  artifact files are written and no versioning is needed: the export carries one
  body per artifact, and the asset store holds a copy of the same text under
  `artifact_version_id`, which is therefore ignored.
- **Ignored by design** — `thinking_trace`, `agent_thinking_traces`, `steps[]`
  (tool calls and their search results), `web_search_results[]`, `projects`,
  `tasks`.

## Imagine posts

An Imagine post is not a conversation: it has a prompt and a generated medium, and
nothing links it back to a chat. It is converted to a two-message note (prompt,
then media), titled `Imagine - ` plus the prompt truncated by
[`truncateTitlePreview`](../../../src/utils/title-preview.ts), whitespace
collapsed so the title stays on one line.

- A post whose `original_prompt` is empty (160 of 555) is declined as
  `"empty prompt"`: nothing to show but a link.
- `media_type: "video"` is converted like an image; no video payload was present
  in the observed archive.
- The note links to `link`, falling back to
  `grok.com/imagine/post/<id>`.

Only one post in the observed archive was referenced from a conversation (an image
the user attached, which the post had generated), so a post cannot be used to find
its conversation.

## Item categories and exclusions

The two kinds of item use the generic report hooks
([`provider-adapter.ts`](../../../src/providers/provider-adapter.ts)):

| Hook | Grok's answer |
|---|---|
| `getItemCategory()` | `"Conversations"` (`DEFAULT_ITEM_CATEGORY`) or `"Imagine"` |
| `getExclusionReason()` | `"empty prompt"` for a post with no prompt, `"no messages"` for a conversation whose every response was dropped, else `null` |

The analysis reads Grok metadata through the adapter
(`extractMetadataThroughAdapter` in
[`conversation-metadata-extractor.ts`](../../../src/services/conversation-metadata-extractor.ts)),
so the archive analysis and the import apply the same rules. The report then
counts each category in its own column and lists exclusions with their reason.

## Assets

[`grok-attachment-extractor.ts`](../../../src/providers/grok/grok-attachment-extractor.ts).

An asset is identified only by its id: no name, no MIME type, no extension. Two
indexes are built per archive, both cached in a `WeakMap` keyed by the ZIP reader:

1. **asset id → ZIP path**, from one entry listing.
2. **Imagine post id → signed images**, read lazily and only when an Imagine post
   needs it, because it decompresses every asset once.

The second index exists because Grok writes the post id into the **EXIF `Artist`**
tag of the images it generates.
[`jpeg-exif.ts`](../../../src/utils/jpeg-exif.ts) reads that one tag (APP1, IFD0,
tag `0x013b`) and nothing else. In the observed archive this recovered 44 images
for 32 posts that had no other reference; those files also carry a
`Signature: <base64>` string in `ImageDescription` / `UserComment`, which the
importer does not read.

What each group of the 254 observed assets was:

| Group | Count | How it is found |
|---|---|---|
| Conversation uploads | 83 | `file_attachments[]` |
| Imagine post's own file | 67 | asset id equals the post id |
| Imagine variants | 44 | EXIF `Artist` equals the post id |
| Artifact bodies | 5 | asset id equals `artifact_version_id`; unused (the text is inline) |
| Unreferenced | 55 | nothing — not imported |

Writing goes through the shared
[`writeZipEntryToVault`](../../../src/utils/zip/write-zip-entry-to-vault.ts), so
the type comes from magic bytes (`detectFileFormat`) and the target from
`resolveAttachmentTarget`. The vault name is
`grok_<conversation 8>_<message 8>_<asset 8>.<detected ext>` — stable across
re-imports, which is what keeps a rebuild from duplicating files.

A missing asset stays visible: a conversation upload becomes
`missing_from_export` with a link to the chat; missing Imagine media reuses
[`createMissingGeneratedImageAttachment`](../../../src/utils/generated-image-placeholder.ts)
with a link to the post, labelled image or video. Images Grok generated or edited
inside a conversation were never present (12 of 95 `file_attachments` in the
observed archive), so they take the same path.

## Scope

This covers exports from grok.com (xAI account). Grok inside X (X account) has a
separate data export and is not handled.
