# Nexus AI Chat Importer — CLI

A command-line interface for importing AI chat exports (ChatGPT, Claude, Le Chat, Perplexity) directly into an Obsidian vault, without opening Obsidian.

## Status

> **Best effort — Desktop only — Not verified by Obsidian**
>
> The CLI is a separate, optional tool. It is **not** part of the Obsidian plugin distribution and is **not** reviewed or verified by Obsidian. It requires Node.js and runs on desktop only (macOS, Linux, Windows).
>
> Installation is a voluntary, separate action from installing the plugin. The plugin works without the CLI.

## Prerequisites

- Node.js 18 or later
- An existing Obsidian vault with the Nexus AI Chat Importer plugin installed

## Installation

```bash
cd cli
npm install
npm run build
```

## Usage

```bash
node dist/nexus-cli.js --vault /path/to/vault --input export.zip
```

### Options

| Flag | Description |
|------|-------------|
| `--vault <path>` | Path to your Obsidian vault (required) |
| `--input <files...>` | One or more ZIP export files (required) |
| `--provider <name>` | Force provider: `chatgpt`, `claude`, `lechat`, `perplexity` |
| `--conversation-folder <path>` | Override conversations folder |
| `--attachment-folder <path>` | Override attachments folder |
| `--report-folder <path>` | Override reports folder |
| `--date-prefix` | Add date prefix to filenames |
| `--date-format <fmt>` | `YYYY-MM-DD` or `YYYYMMDD` |
| `--timestamp-format <fmt>` | Message timestamp format |
| `--dry-run` | Simulate import without writing files |
| `--verbose` | Show detailed output |

## Notes

- Settings are read from the vault's existing plugin config (`data.json`) and can be overridden by CLI flags
- Imported files are fully compatible with the plugin — you can use both interchangeably
- The CLI uses the same import engine as the plugin

## Relationship to the Plugin

The CLI depends on the plugin's service layer (`src/`). The plugin does **not** depend on the CLI — they are unidirectional: CLI → plugin. If you update the plugin, rebuild the CLI to stay in sync.

## License

GPL-3.0-or-later — see [LICENSE.md](../LICENSE.md)
