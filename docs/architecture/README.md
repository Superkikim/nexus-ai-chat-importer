# Architecture reference

Technical references for contributors and maintainers. These pages describe how the
plugin is built; they are **not** published as user documentation. For task-oriented
usage help, see [`docs/user/`](../user/README.md).

Verify version-sensitive claims against the current source before relying on them.
Where a page and the code disagree, the code wins — please fix the page.

| Page | Scope |
|---|---|
| [Import pipeline](import-pipeline.md) | End-to-end flow from ZIP selection to note creation, and the fixed per-conversation processing order. |
| [Archive pipeline](archive-pipeline.md) | The unified ZIP reader (`yauzl` on desktop, a custom central-directory reader on mobile), archive classification, and the large-archive strategy thresholds. |
| [Attachment handling](attachment-handling.md) | How attachment payloads are located across one or more archives, written to the vault, and reconciled with generated content. |
| [Link updates](link-updates.md) | How conversation and report links are rewritten when a configured folder is moved. |
| [Providers / ChatGPT export format](providers/chatgpt-export-format.md) | Observed structure of the 2026 ChatGPT export (undocumented by OpenAI) that the importer relies on. |
| [Providers / Claude export format](providers/claude-export-format.md) | Observed Claude export delivery and archive structure, and the data shape the adapter relies on. |

## The provider adapter model

Every provider converts its own export into the shared
[`StandardConversation`](../../src/types/standard.ts) shape before the rest of the
pipeline runs:

```
provider export  ->  ProviderAdapter  ->  StandardConversation  ->  formatters  ->  Markdown
```

The contract is [`ProviderAdapter<TChat>`](../../src/providers/provider-adapter.ts);
adapters are wired in [`provider-registry.ts`](../../src/providers/provider-registry.ts).
To add one, see [Adding a provider](../development/adding-a-provider.md).
