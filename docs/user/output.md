# What gets created

What Nexus AI Chat Importer writes into your vault during an import: the folder
tree, file names, note structure, and the parts of a conversation it leaves out.

## Folder tree

```
<Conversation folder>/<provider>/<YYYY>/<MM>/<title>.md
<Attachment folder>/<provider>/…                       (images, documents, …)
<Report folder>/<provider>/<YYYYMMDD-HHmmss> - import summary.md
                                             - index heavy.md
                                             - index mobile.md
```

The folders default to `Nexus/Conversations`, `Nexus/Attachments`, and
`Nexus/Reports`, and are configurable in [Settings](settings.md). `<provider>` is
one of `chatgpt`, `claude`, `vibe`, `perplexity`. The year and month come from the
conversation's creation date **in your computer's local timezone**.

## File names

The note name is built from the conversation title:

- Characters a filesystem cannot use, and line breaks, are removed; runs of
  whitespace are collapsed.
- Latin accents are stripped (`é` → `e`); non-Latin scripts (e.g. Chinese,
  Japanese, Cyrillic) are kept as-is.
- An untitled conversation becomes `Untitled`.
- The whole `.md` name is capped at 120 bytes (UTF-8). If two notes would collide,
  a counter is added: ` (1)`, ` (2)`, …
- If the operating system still rejects the name as too long, the plugin retries with
  `conversation-<id>.md`.
- With the [date prefix](settings.md#date-prefix) enabled, the name is prefixed
  with the creation date.

## Note structure

### Frontmatter

Always present:

```yaml
---
nexus: nexus-ai-chat-importer
plugin_version: "1.7.0"
provider: chatgpt
aliases: <safe title>
conversation_id: <id>
create_time: 2026-01-15T14:30:22.000Z
update_time: 2026-01-16T09:05:00.000Z
---
```

Added only when the export provides them:

- `mode:` — the provider's conversation mode, when it has one.
- `models:` — a list of the model(s) used in the conversation.

Timestamps in frontmatter are **always ISO 8601 UTC**.

### Body

- A header block: the original title, a localised **Created** and **Last Updated**
  line, and a **Chat URL** back to the original conversation when one is available.
- The messages, in chronological order.
- A **Related Queries** list at the end, for providers that export follow-up
  suggestions (Perplexity).

### Messages

Each message is an Obsidian callout:

| Callout | Used for |
|---|---|
| `nexus_user` | Your messages |
| `nexus_agent` | Assistant replies (the model name is shown when known) |
| `nexus_attachment` | A file attached to a message |
| `nexus_artifact` | A Claude artifact |
| `nexus_prompt` | A system prompt |
| `nexus_canvas` | A ChatGPT Canvas / Mistral canvas document |

Assistant messages are followed by a horizontal rule. Math written with
`\( … \)` or `\[ … \]` is converted to Obsidian's `$ … $` / `$$ … $$` syntax
(code blocks are left alone).

## What is left out of a note

The plugin imports the human and assistant turns as they appear in the export. It
deliberately does **not** include:

- system, tool, and hidden messages;
- content the provider did not put in the export (see [Attachments](attachments.md)
  and each provider page for what that means for that provider).

A note therefore reflects **what the export contained**, which is not always the
complete history visible in your provider account.

## Long content

To keep a note readable, a very long block — a single message line of roughly
10,000+ characters, or a large extracted text attachment — is moved to a file
under `<Attachment folder>/<provider>/documents/<note name>/` and linked from the
message instead of inlined. If the file cannot be written, the content stays in
the note.

## Related

- [Attachments](attachments.md) · [Settings](settings.md) ·
  [Import reports](reports.md) · [Importing conversations](importing.md)
