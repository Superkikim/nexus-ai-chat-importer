# Getting started

## Requirements

- **Obsidian 1.6.6 or newer** (the plugin's declared minimum).
- **Desktop or mobile.** The plugin runs on both. On mobile, some steps are more
  limited — see [desktop vs mobile](importing.md#desktop-vs-mobile).
- A data export (`.zip`) from ChatGPT, Claude, Mistral Vibe, or Perplexity. Each
  [provider page](README.md#supported-providers) explains how to request one.

## Install

### From the community plugins browser (recommended)

1. Open **Settings → Community plugins** in Obsidian and turn off Restricted mode
   if needed.
2. **Browse**, search for *Nexus AI Chat Importer*, and **Install**.
3. **Enable** the plugin.

### Manually

1. Download `main.js`, `manifest.json`, and `styles.css` from the
   [latest GitHub release](https://github.com/Superkikim/nexus-ai-chat-importer/releases).
2. Copy them into
   `<your vault>/.obsidian/plugins/nexus-ai-chat-importer/`.
3. Reload Obsidian and enable the plugin under **Settings → Community plugins**.

## Your first import

Before importing, open **[Settings](settings.md)** and set the folder locations,
filename date prefix, and timestamp format the way you want them. Changing folders
afterwards means moving files and updating links, so it is easier to decide up
front.

1. Get your export from your provider and note where the `.zip` was saved — see
   [ChatGPT](providers/chatgpt.md#get-your-export),
   [Claude](providers/claude.md#get-your-export),
   [Mistral Vibe](providers/mistral-vibe.md#get-your-export), or
   [Perplexity](providers/perplexity.md#getting-a-compatible-export). Do **not**
   unzip it.
2. In Obsidian, run **Import AI conversations** — from the command palette, or the
   ribbon icon in the left sidebar.
3. Select the `.zip` file. The plugin detects the provider from the archive.
4. Pick a mode — **Import All** brings in everything, **Select Specific** lets you
   choose — then click **Continue**. See [Importing conversations](importing.md)
   for the difference.
5. When it finishes, the completion dialog summarises what changed. Click
   **View Report** for the full breakdown.

Your conversations are now under `Nexus/Conversations/<provider>/<year>/<month>/`,
attachments under `Nexus/Attachments/`, and reports under `Nexus/Reports/` — or
wherever you pointed those folders in Settings.

## Next steps

- [Importing conversations](importing.md) — selective imports, updates after new
  exports, and rebuilding notes.
- [What gets created](output.md) — how the notes and folders are structured.
- [Settings](settings.md) — folders, filename date prefix, timestamp format.
- [Command-line import](cli.md) — the optional desktop CLI (ChatGPT, Claude,
  Mistral Vibe).
