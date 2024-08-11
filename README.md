# Nexus AI Chat Importer Plugin for Obsidian

![Version](https://img.shields.io/badge/version-1.0.2b-blue)

## About

Master branch: [1.0.2b (Beta)](https://github.com/Superkikim/nexus-ai-chat-importer/tree/master) - Development in progress  
dev-modular branch: [2.0.0-alpha.1](https://github.com/Superkikim/nexus-ai-chat-importer/tree/dev-modular) - Refactoring in progress

The Nexus AI Chat Importer Plugin simplifies the process of importing conversations with your favorite AI chat application from export files into Obsidian.

**Archived Release:** Version 1.0.1b is now archived. Please use the master branch (Version 1.0.2b) for the latest features and improvements until a new release is available.

## Overview

The Nexus AI Chat Importer Plugin for Obsidian allows you to seamlessly import your AI chat conversations from export files into your Obsidian vault. This plugin organizes your ChatGPT conversations into readable Markdown files, making them easily accessible and searchable within Obsidian.

## Features

- Import conversations from export files directly into Obsidian
- Automatically organize conversations by date
- Create individual Markdown files for each conversation
- Update existing conversations with new messages
- Detailed import reports for tracking the import process
- Click on the conversation title to open the chat in the original web app

## Installation

⚠️ Due to a name change, old conversation records imported with version 1.0.1b and earlier cannot be accessed. Please delete any old data and re-import your conversations with the new version. Next versions will include an upgrade feature if required.

1. Download the contents of the `dist` folder from the repository.
2. In your Obsidian vault, navigate to the `.obsidian/plugins/` directory.
3. Create a new folder called `nexus-ai-chat-importer`.
4. Copy the downloaded files into the `nexus-ai-chat-importer` folder.
5. Open Obsidian and go to Settings > Community Plugins.
6. Disable Safe Mode if it's enabled.
7. Refresh the list of plugins.
8. Find "Nexus AI Chat Importer" in the list and enable it by toggling the switch.

Note: You may need to restart Obsidian after installing the plugin for it to appear.

***Disclaimer:*** Version 1.0.2b is a development in progress and might not work as expected. **Use at your own risk**.

***Keep your archives***. As long as the plugin is in Beta, I do not guarantee you won't have to reprocess all your conversation imports.

After installation, proceed to the Configuration section to set up the plugin.

## Configuration

1. Go to Settings > Nexus AI Chat Importer
2. Set the "Nexus AI Chat Importer Folder" to specify where imported conversations will be stored
3. Optionally, enable "Add Date Prefix to Filenames" and choose a date format

## Usage

## Important Note

From version 1.0.1b to 1.0.2b, new parameters (metadata) have been added and are required for new features to function correctly. Please ensure that your existing conversations are updated to include these new metadata fields.

### Exporting ChatGPT Data

1. Log in to ChatGPT (chat.openai.com)
2. Click on your user icon and select "Settings & Beta"
3. Go to "Data Controls" and click on "Export Data"
4. Click "Export" and wait for an email with the download link
5. Download the ZIP file containing your ChatGPT data

### Importing into Obsidian

1. In Obsidian, open the Command Palette (Cmd/Ctrl + P)
2. Search for and select "Nexus AI Chat Importer: Select export archive"
3. Choose the ZIP file you downloaded from ChatGPT
4. The plugin will process the file and import your conversations

### Import Results

- New conversations will be created as individual Markdown files
- Existing conversations will be updated with new messages (if any)
- An import report will be generated in the archive folder, detailing the results

### Resetting the Import Catalog

The plugin keeps a record of processed ZIP files to avoid unnecessary reprocessing. If you need to clear this record:

1. Open the Command Palette (Cmd/Ctrl + P)
2. Search for and select "Reset Nexus AI Chat Importer Catalogs: Reset Catalogs"
3. Confirm the action when prompted

Note: This action only clears the plugin's record of previously processed ZIP files. It does not affect your imported notes. After resetting, the plugin will no longer recognize previously imported ZIP files as already processed, allowing you to reimport them without warnings if needed.

## Understanding the Import Report

The import report provides a summary of the import process, including:

- Total number of existing conversations
- Number of new conversations imported
- Number of conversations updated
- Number of new messages added

It also includes detailed tables for:

- Created Notes: New conversations imported
- Updated Notes: Existing conversations that were updated
- Skipped Notes: Conversations that didn't need updating

Each table shows the conversation title, creation date, update date, and number of messages.

## Troubleshooting

- If the import fails, check the console log for error messages
- Ensure you have write permissions for your Obsidian vault
- Verify that the ZIP file is a valid ChatGPT export

## Known Issues

- Counters in Import Reports are inaccurate; they may not reflect the true number of conversations imported or updated.