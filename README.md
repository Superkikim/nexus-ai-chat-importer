# Nexus AI Chat Importer

[![Obsidian](https://img.shields.io/badge/Obsidian-1.6.6+-purple?logo=obsidian)](https://obsidian.md/) [![GitHub release (latest by date)](https://img.shields.io/github/v/release/superkikim/nexus-ai-chat-importer)](https://github.com/Superkikim/nexus-ai-chat-importer/releases/latest) [![Downloads](https://img.shields.io/badge/dynamic/json?url=https://raw.githubusercontent.com/Superkikim/nexus_stats/main/summary.json&query=%24.total_downloads&label=downloads&color=blue)](https://github.com/Superkikim/nexus-ai-chat-importer/releases) [![License](https://img.shields.io/badge/license-GPL--3.0--or--later-green)](LICENSE)

Import your AI chat exports into your Obsidian vault as plain Markdown — organised
by provider and date, with attachments, frontmatter metadata, and a reviewable
import report. Everything runs locally in your vault.

## Supported providers

**ChatGPT** · **Claude** · **Mistral Vibe** (formerly Le Chat) · **Perplexity**

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
- **Localised UI** in 10 languages, with an optional desktop [CLI](docs/user/cli.md).

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
| [`docs/user/`](docs/user/README.md) | Everyone | Canonical user guide: [getting started](docs/user/getting-started.md), [importing](docs/user/importing.md), [settings](docs/user/settings.md), [what Nexus creates](docs/user/output.md), [attachments](docs/user/attachments.md), [reports](docs/user/reports.md), [CLI](docs/user/cli.md), [privacy](docs/user/privacy.md), [troubleshooting](docs/user/troubleshooting.md), and a page per provider. |
| [`docs/development/`](docs/development/README.md) | Contributors | Adding a provider, issue workflow, release workflow. |
| [`docs/architecture/`](docs/architecture/README.md) | Contributors | Import pipeline, archive pipeline, attachment handling, link updates, ChatGPT export format. |
| [`RELEASE_NOTES.md`](RELEASE_NOTES.md) | Everyone | The changelog. |

## Support

I maintain Nexus in my own time, and testing new providers means paying for their
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
- **Special Thanks**: To all users who report issues and suggest improvements

## Links

[Issues](https://github.com/Superkikim/nexus-ai-chat-importer/issues) ·
[Obsidian forum thread](https://forum.obsidian.md/t/plugin-nexus-ai-chat-importer-import-chatgpt-and-claude-conversations-to-your-vault/71664) ·
[Releases](https://github.com/Superkikim/nexus-ai-chat-importer/releases)
