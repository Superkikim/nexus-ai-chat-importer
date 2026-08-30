# Command-line import

Nexus AI Chat Importer ships an optional command-line importer for **desktop**
use, for scripting and batch runs. It is a separate package in the repository's
`cli/` folder and is **not** part of the Obsidian plugin you install from the
community browser.

## Scope

- Providers: **ChatGPT, Claude, Mistral Vibe** only. Perplexity is not available
  in the CLI, and there is no auto-detection — you pass `--provider` explicitly.
- No Select Specific, no conversation preview. It imports every new and updated
  conversation, like Import All.
- No dialogs, no report files (it prints a short summary to the terminal).

## Build and run

From the repository, in `cli/`:

```bash
npm install
npm run build          # produces cli/dist/nexus-cli.js
node dist/nexus-cli.js --help
```

It targets Node 18+.

## Usage

```
nexus-cli import --vault <path> --input <files...> --provider <provider> [options]
```

| Option | Notes |
|---|---|
| `--vault <path>` | Required. Must be an existing Obsidian vault (contains `.obsidian/`). |
| `--input <files...>` | Required. One or more `.zip` export files. |
| `--provider <provider>` | Required. `chatgpt`, `claude`, or `vibe`. |
| `--conversation-folder <dir>` | Override the conversation folder. |
| `--attachment-folder <dir>` | Override the attachment folder. |
| `--date-prefix` | Add the creation-date prefix to filenames. |
| `--date-format <fmt>` | `YYYY-MM-DD` or `YYYYMMDD`. |
| `--timestamp-format <fmt>` | `locale`, `iso`, `us`, `eu`, `de`, or `jp`. |
| `--dry-run` | Validate paths and print what would be imported. Writes nothing. |
| `--verbose` | Print the config source, vault, provider, and each processed file. |

Example:

```bash
node dist/nexus-cli.js import \
  --vault "/path/to/Vault" \
  --input ~/Downloads/chatgpt-export.zip \
  --provider chatgpt
```

The CLI layers its configuration as: built-in defaults → any existing
`data.json` in the vault's plugin folder → your command-line flags.

## Known limitations

These are current behaviours of the CLI — plan around them:

- **No report files.** The CLI prints a summary to the terminal; it does not
  write the Markdown [import reports](reports.md) that the plugin produces.
- **`--dry-run` checks paths only.** It does not open the archive or predict which
  notes or outcomes you would get.
- **Flag overrides are persisted.** A real import writes the effective settings
  (including your `--*-folder` and format flags) back into the vault's
  `data.json`. They are not one-shot.
- **OpenAI "Privacy Portal" container archives are not unwrapped.** Extract the
  outer `.zip` yourself and pass the inner conversation `.zip`. Multi-archive
  ChatGPT imports also do not share attachments across archives the way the
  plugin's Import All does.

The process exits non-zero when an import hits an error or a conversation fails.

For anything interactive — choosing conversations, Perplexity, mobile — use the
plugin. See [Importing conversations](importing.md).
