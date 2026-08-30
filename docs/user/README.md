# Nexus AI Chat Importer — user guide

Nexus AI Chat Importer brings your AI chat exports into your Obsidian vault as
plain Markdown notes: organised by provider and date, with attachments,
frontmatter metadata, and an import report you can review afterwards. Everything
runs locally in your vault.

## Supported providers

The plugin imports exports from exactly four providers:

- **[ChatGPT](providers/chatgpt.md)** (OpenAI)
- **[Claude](providers/claude.md)** (Anthropic)
- **[Mistral Vibe](providers/mistral-vibe.md)** (formerly Le Chat)
- **[Perplexity](providers/perplexity.md)**

## Start here

1. **[Getting started](getting-started.md)** — requirements, installation, and your first import.
2. Get your export from your provider: see the provider page above.
3. **[Importing conversations](importing.md)** — the import dialog, choosing conversations, updates, and rebuilds.

## Reference

| Page | Answers |
|---|---|
| [Settings](settings.md) | What can I configure — folders, filename date prefix, timestamp format. |
| [What Nexus creates](output.md) | The folder tree, file names, note structure, frontmatter, and what is left out of a note. |
| [Attachments](attachments.md) | How exported files are saved, embedded, or shown as missing. |
| [Import reports](reports.md) | The report files, what each section means, and the completion dialog. |
| [Command-line import](cli.md) | The optional desktop CLI (ChatGPT, Claude, Mistral Vibe). |
| [Privacy](privacy.md) | What data stays local, and the few times the plugin uses the network. |
| [Troubleshooting](troubleshooting.md) | Common failures and how to diagnose them safely. |

## Provider pages

Each provider page covers only what is specific to that provider — how to get the
export, which export layouts are recognised, how its attachments and generated
content behave, and its limitations. The shared import workflow is not repeated
there; it lives in [Importing conversations](importing.md).
