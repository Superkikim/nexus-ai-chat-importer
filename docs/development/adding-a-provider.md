# Adding a provider

How to add support for a new AI chat export source. This is a concise, current
guide; read the referenced source rather than copying older example code.

## The model

Every provider converts its own export into the shared
[`StandardConversation`](../../src/types/standard.ts) shape:

```
provider export  ->  ProviderAdapter  ->  StandardConversation  ->  formatters  ->  Markdown
```

Two independent detection layers exist:

1. **Archive classification** — filename/schema based, in
   [`classifyArchiveEntries()`](../../src/utils/zip-content-reader.ts). This is what
   locks the import to a provider from the selected ZIP.
2. **Structural adapter detection** — `ProviderAdapter.detect(rawConversations)`,
   which validates the extracted data.

There is **no** provider-picker dialog: the user selects ZIP files and the plugin
auto-detects. Do not add a selection step.

## Files to create

Put them in `src/providers/<name>/`. Use an existing small provider
(`src/providers/perplexity/`, `src/providers/vibe/`) as the reference shape:

| File | Responsibility |
|---|---|
| `<name>-types.ts` | Types for the raw export payload. |
| `<name>-adapter.ts` | Implements [`ProviderAdapter<TChat>`](../../src/providers/provider-adapter.ts). |
| `<name>-converter.ts` (and/or `<name>-normalizer.ts`) | Raw chat → `StandardConversation` / `StandardMessage[]`. |
| `<name>-attachment-extractor.ts` | Only if the export carries attachment payloads. |
| `<name>-report-naming.ts` | Implements [`ReportNamingStrategy`](../../src/types/standard.ts) — folder name plus the provider-specific report column. |
| `*.test.ts` alongside each | Unit tests with small inline fixtures. |

## `ProviderAdapter` contract

Required members ([`provider-adapter.ts`](../../src/providers/provider-adapter.ts)):

- `detect(rawConversations)` — structural recognition.
- `getId` / `getTitle` / `getCreateTime` / `getUpdateTime` — basic accessors
  (times in unix **seconds**).
- `convertChat(chat)` → `StandardConversation` (may be async).
- `getProviderName()` — the folder/key name, e.g. `"perplexity"`.
- `getNewMessages(chat, existingMessageIds)` — for incremental updates.
- `getReportNamingStrategy()`.

Optional members:

- `reconcileConversationMessages(messages, conversationId, zip)` — a whole-
  conversation pass between conversion and attachment extraction, for content that
  ships outside the message payload. Must be idempotent and receive the full
  message list. See [Import pipeline](../architecture/import-pipeline.md).
- `processMessageAttachments(messages, conversationId, zip)` — best-effort
  attachment extraction.
- `shouldIncludeZipEntry(entryName, uncompressedSize)` — skip entries during ZIP
  indexing (e.g. large media on mobile).

All ZIP access goes through
[`ZipArchiveReader`](../../src/utils/zip/types.ts) — never Node `fs`. See
[Archive pipeline](../architecture/archive-pipeline.md).

## Wiring

1. **Register** the adapter in
   [`provider-registry.ts`](../../src/providers/provider-registry.ts).
2. **Classify** the archive: add the recognition rule and the
   `SupportedArchiveProvider` union entry in
   [`zip-content-reader.ts`](../../src/utils/zip-content-reader.ts).
3. **Chat URL** (optional): add a generator to `URL_GENERATORS` in
   [`standard.ts`](../../src/types/standard.ts) so notes get a "Chat URL" header.
4. **Localise**: add `archive_messages.provider_names.<name>` and any new notice
   keys to every file in [`src/i18n/locales/`](../../src/i18n/locales/); the
   locale-parity tests enforce coverage.
5. **CLI** (optional): add the id to `VALID_PROVIDERS` in
   [`cli/src/index.ts`](../../cli/src/index.ts) if the provider works without
   UI-only steps.

## Validation

```bash
npm run type-check
npm run test:run
npx eslint src/
npm run build
```

Add a user page under `docs/user/providers/` and link it from
`docs/user/README.md`. Keep provider pages to provider-specific behaviour and link
back to the shared workflow pages (see the existing four).
