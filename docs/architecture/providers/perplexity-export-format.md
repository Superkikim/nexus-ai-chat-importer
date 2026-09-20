# Perplexity export formats

Maintainer reference for the three archives the Perplexity provider consumes.
Perplexity publishes no format spec, and two of these archives are produced by a
third-party browser extension, so this is observation from real exports plus the
types the adapter relies on. It can change without notice.

Companion: the user-facing page is
[docs/user/providers/perplexity.md](../../user/providers/perplexity.md).

## Two sources, three shapes

| Source | Archive | Payload shape |
|---|---|---|
| Perplexity's own export ("Export my data") | `user_data_export_<date>_<id>.zip` | one `conversations-<YYYYMMDD>_<HHMMSS>-<hash>.json`, `{ conversations: [...] }`, plus a `user-data-….xlsx` that is never read |
| *Perplexity Thread Exporter* extension, older shape | `perplexity_export_<ms>[_partNofM].zip` | one `perplexity_*.json` per thread, `{ metadata, conversations[] }` |
| Same extension, newer shape | same | one `perplexity_*.json` per thread, `{ status, entries[], thread_metadata? }` — close to a dump of Perplexity's own API response |

All three normalise to one internal shape before conversion
([`perplexity-normalizer.ts`](../../../src/providers/perplexity/perplexity-normalizer.ts)):
`{ metadata: { thread_id, thread_title, thread_url, … }, conversations: PerplexityTurn[] }`.

The normaliser tries the shapes in order — legacy, official, entries — because
the official export and the extension's newer shape both carry an `entries`
array; only the official one names the conversation at its root
(`context_uuid`).

## Recognition

Classification is in
[`zip-content-reader.ts`](../../../src/utils/zip-content-reader.ts):

| Archive | Recognition |
|---|---|
| Official | a file matching `^conversations-\d{8}_\d{6}-[0-9a-f]+\.json$` in any directory. The date-and-hash name is what keeps it apart from ChatGPT's `conversations-<n>.json`. |
| Extension | any `.json` whose base name starts with `perplexity_`, in any directory. |

The official file holds every conversation, so its `conversations` array is
streamed (`StreamingJsonArrayParser`), the way Grok's single payload is.
Extension files hold one thread each and are read whole, one at a time.

An outer `.zip` that only wraps the extension's part zips is refused with
guidance to extract it first.

## Data shape

Types: [`perplexity-types.ts`](../../../src/providers/perplexity/perplexity-types.ts).

**Official** — a conversation carries `context_uuid`, `context_title`,
`created_at`, `updated_at`, `mode` (`CONCISE` | `COPILOT`), `collection_uuid`
(null in every observed conversation) and `entries[]`. An entry carries
`entry_uuid`, `query`, `answer`, `created_at`, `label` (null | `reject`),
`query_status` and `engine_mode` (null | `auto` | `pro` | `deep_research`).
Nothing else: no sources, no model name, no attachment, no thread URL.

**Extension, older shape** — `metadata` names the thread (`thread_id`,
`thread_title`, `thread_url`, `exported_at`, …); a turn carries `uuid`, `query`,
`answer`, `model`, `mode`, `timestamp`, `language`, `related_queries[]` and,
when the answer searched the web, `sources[]` of `{ title, url, snippet }`.

**Extension, newer shape** — entries carry the API's own fields; the normaliser
reads `uuid` / `backend_uuid`, `context_uuid`, `thread_url_slug`, `query_str`,
`display_model` / `user_selected_model`, `mode`, the datetimes, the related
queries, and the answer from `blocks[].markdown_block.answer` (or its `chunks`).
No source collection is exposed in this shape.

## What the official export does not have

Measured on a real 493-conversation export (2 010 turns):

- **No title.** `context_title` repeats the first question in full: 492 of 493
  were identical to it, 99 ran past 200 characters, 106 spanned several lines.
  The note title is therefore a 50-character preview, on one line
  (`truncateTitlePreview`, shared with Mistral Vibe).
- **No sources**, while 1 490 answers cite `[1][2]`. Markers no source backs are
  removed from answers, outside code, links and reference definitions, and never
  from questions
  ([`perplexity-converter.ts`](../../../src/providers/perplexity/perplexity-converter.ts)).
- **No thread URL.** Perplexity serves a thread at `/search/<uuid>`, where the
  uuid is its **first** entry's — confirmed against two real thread links, and
  against the extension's `thread_url` in 10 threads held in both exports.
- **No model name.** `engine_mode` is a kind of search, not a model, and is null
  on 54 % of entries; it is not written to the note.
- **An `updated_at` that can predate its own last entry** (25 of 493), so the
  update time is the later of the two.
- `label: "reject"` marks 10 entries whose answers are complete; they are
  imported like any other.

## Reconciling the two sources

The two exports describe the same threads but not the same way. Across the ten
threads held in both:

| | Result |
|---|---|
| Conversation id (`context_uuid` = extension `thread_id`) | 10/10 identical |
| Turn count, questions, order | identical; all 48 questions matched character for character |
| **Message ids** | **0/10 matched** — the exports number answers differently |
| Timestamps | never equal: 2.5 s apart at best, 7 s typically, up to 30 minutes |
| Update time | the official export is the newer one 10/10 |

Matching by id therefore duplicated every message one way, and skipped the
archive entirely the other way. So the Perplexity adapter implements
`reconcileNoteMessages`
([`perplexity-note-merge.ts`](../../../src/providers/perplexity/perplexity-note-merge.ts)),
which is given the note's messages read back from its callouts
([`note-message-blocks.ts`](../../../src/utils/note-message-blocks.ts)) and
returns what the note is missing:

- a turn is recognised by the first 60 characters of its **question**, taken in
  order (7 threads of 493 hold two questions sharing that prefix; order settles
  them). The question is the stabler key: an answer loses its citation markers
  or gains a references section on the way into a note, while a question is only
  touched by the formatter's LaTeX conversion — which the key applies to both
  sides so they still meet;
- a turn the note does not hold is appended;
- a turn whose sources the note lacks is **rewritten whole** from the richer
  export — appending the list alone would point at markers that were stripped;
- anything else is left alone.

Two consequences elsewhere in the pipeline
([`conversation-processor.ts`](../../../src/services/conversation-processor.ts),
[`main.ts`](../../../src/main.ts)):

- Import All keeps conversations the vault is already level with when the
  provider reconciles by content, because the extension's archive is always the
  older one and still carries sources.
- Such a note keeps its own stamp rather than being dated back to the older
  archive, and is written only when something actually changed.

## Report and completion dialog

The provider-specific report column is **Turns**, the number of question and
answer pairs. It declares neither `countsImportedAttachments` nor
`countsArtifacts`, so the completion dialog shows no file cards for Perplexity:
these exports carry no attachment and no generated file.
