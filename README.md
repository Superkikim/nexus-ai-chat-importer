# Nexus AI Chat Importer

[![Obsidian](https://img.shields.io/badge/Obsidian-1.6.6+-purple?logo=obsidian)](https://obsidian.md/) [![GitHub release (latest by date)](https://img.shields.io/github/v/release/superkikim/nexus-ai-chat-importer)](https://github.com/Superkikim/nexus-ai-chat-importer/releases/latest) [![Downloads](https://img.shields.io/badge/dynamic/json?url=https://raw.githubusercontent.com/Superkikim/nexus_stats/main/summary.json&query=%24.total_downloads&label=downloads&color=blue)](https://github.com/Superkikim/nexus-ai-chat-importer/releases) [![License](https://img.shields.io/badge/license-GPL--3.0--or--later-green)](LICENSE)

Import your AI chat exports into your Obsidian vault as plain Markdown — organised
by provider and date, with attachments, frontmatter metadata, and a reviewable
import report. Everything runs locally in your vault.

> 🌍 **Translated docs** — the user guide is also published on **[nexus-prod.dev](https://nexus-prod.dev/nexus-ai-chat-importer/)** in [Deutsch](https://nexus-prod.dev/de/nexus-ai-chat-importer/) · [Español](https://nexus-prod.dev/es/nexus-ai-chat-importer/) · [Français](https://nexus-prod.dev/fr/nexus-ai-chat-importer/) · [Italiano](https://nexus-prod.dev/it/nexus-ai-chat-importer/) · [日本語](https://nexus-prod.dev/ja/nexus-ai-chat-importer/) · [한국어](https://nexus-prod.dev/ko/nexus-ai-chat-importer/) · [Português](https://nexus-prod.dev/pt/nexus-ai-chat-importer/) · [Русский](https://nexus-prod.dev/ru/nexus-ai-chat-importer/) · [中文](https://nexus-prod.dev/zh/nexus-ai-chat-importer/)

> **Note:** the optional command-line importer has moved to its own repository,
> [nexus-ai-chat-importer-cli](https://github.com/Superkikim/nexus-ai-chat-importer-cli).
> The Obsidian plugin is unaffected.

## Supported providers

**ChatGPT** · **Claude** · **Mistral Vibe** (formerly Le Chat) · **Perplexity** · **Grok**

## Features

- **Import all, or select conversations** with an interactive preview and filters.
- **Incremental updates** — re-import a newer export and only new messages are
  appended; your edits are kept. Or explicitly rebuild notes to pick up new
  features.
- **Smart deduplication** across multiple export archives.
- **Best-effort attachments** — images, documents, and generated content are
  extracted when the export contains them; anything missing is shown explicitly.
- **Structured Markdown** — role callouts, ISO 8601 UTC frontmatter, per-provider
  folders, and a detailed import report.
- **Localised UI** in 10 languages, with [translated documentation](https://nexus-prod.dev/nexus-ai-chat-importer/) and an optional desktop [CLI](docs/user/cli.md).

## What's new in 1.8.0

- **Grok is supported** — import the ZIP from your Grok data export as-is. Conversations keep every regenerated answer, citations become links to their source, and Imagine posts become notes with their images.
- **Perplexity's official export is supported** — import the ZIP from *Export my data*. Every conversation becomes a note, titled with the start of its first question.
- **Perplexity: the official export and the Thread Exporter extension work together** — import either over notes created from the other: it adds what a note lacks, and an extension archive fills in sources, models and citation markers, without duplicating anything.
- **Custom ID property** — Settings → Properties adds a property of your choice (for example `uid`) holding the conversation ID to every note, and updates your existing notes.
- **A rebuild keeps the properties you added**, such as `tags`. Edits to the note body are still lost.
- **Settings appear in Obsidian's settings search** (Obsidian 1.13+), with a consistent layout.
- **Reports say what was left out, and why.**
- Plus fixes: Perplexity updates no longer lose new messages, orphan citation markers are gone, the completion dialog no longer counts Perplexity turns as artifacts, and a long block moved to a file is no longer folded.

[Full release notes →](https://github.com/Superkikim/nexus-ai-chat-importer/blob/master/RELEASE_NOTES.md)

## Install

**From Obsidian:** Settings → Community plugins → Browse → search *Nexus AI Chat
Importer* → Install → Enable. Requires Obsidian **1.6.6+**; works on desktop and
mobile.

**Manually:** download `main.js`, `manifest.json`, and `styles.css` from the
[latest release](https://github.com/Superkikim/nexus-ai-chat-importer/releases)
into `<vault>/.obsidian/plugins/nexus-ai-chat-importer/`, then enable the plugin.

Then run **Import AI conversations** from the command palette or the ribbon icon.
See [Getting started](docs/user/getting-started.md).

## Documentation

Full documentation lives in [`docs/`](docs/README.md):

| Location | For | Contents |
|---|---|---|
| [`docs/user/`](docs/user/README.md) | Everyone | Canonical user guide: [getting started](docs/user/getting-started.md), [importing](docs/user/importing.md), [settings](docs/user/settings.md), [what gets created](docs/user/output.md), [attachments](docs/user/attachments.md), [reports](docs/user/reports.md), [CLI](docs/user/cli.md), [privacy](docs/user/privacy.md), [troubleshooting](docs/user/troubleshooting.md), and a page per provider. |
| [`docs/development/`](docs/development/README.md) | Contributors | Adding a provider, issue workflow, release workflow. |
| [`docs/architecture/`](docs/architecture/README.md) | Contributors | Import pipeline, archive pipeline, attachment handling, link updates, ChatGPT export format. |
| [`RELEASE_NOTES.md`](RELEASE_NOTES.md) | Everyone | The changelog. |

## Support

I maintain Nexus AI Chat Importer in my own time, and testing new providers means paying for their
subscriptions. If it is useful to you, please consider a one-time or monthly
donation — thank you to everyone already supporting the project.

[![Support my work](https://img.shields.io/badge/☕_Support_my_work-nexus--prod.dev-FF5E5B?style=for-the-badge)](https://nexus-prod.dev/nexus-ai-chat-importer/support)

The plugin invites you to donate after your first import and every few imports
after that; you can always dismiss the dialog.

## License

**GNU General Public License v3.0 or later** (GPL-3.0-or-later), since version
1.3.0. Versions ≤ 1.2.0 remain under their original MIT license. You may use,
modify, and redistribute the plugin; derivative works must also be GPL-3.0 and
provide their source. See [LICENSE](LICENSE) for the full text.

## Credits

- **Developer**: [Superkikim](https://github.com/Superkikim)
- **Contributors**:
  - [@caseyg](https://github.com/caseyg) — CLI for bulk importing (PR #33), Claude formatting feedback (PR #34)
  - [@chuckfs](https://github.com/chuckfs) — iOS support (PR #15)
  - [@baron](https://github.com/baron) — Large archive handling research (PR #27)
  - [@lstsavr](https://github.com/lstsavr) — Unicode filename preservation (PR #70)
  - [@nelsonlove](https://github.com/nelsonlove) — Line-ending handling fix, so pasted content with bare CR line endings stays inside its callout and code fence (PR #80); also identified, diagnosed, and proposed a fix for notes named with wikilink-structural characters (PR #80, fixed differently in #83)
- **Special Thanks**: To all users who report issues and suggest improvements

## Links

[Issues](https://github.com/Superkikim/nexus-ai-chat-importer/issues) ·
[Obsidian forum thread](https://forum.obsidian.md/t/plugin-nexus-ai-chat-importer-import-chatgpt-and-claude-conversations-to-your-vault/71664) ·
[Releases](https://github.com/Superkikim/nexus-ai-chat-importer/releases)
