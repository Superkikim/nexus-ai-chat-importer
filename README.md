# Nexus AI Chat Importer Plugin for Obsidian

![Version](https://img.shields.io/badge/version-1.0.2-blue)

## Table of Contents
<ol>
  <li><a href="#about">About</a></li>
  <li><a href="#overview">Overview</a></li>
  <li><a href="#features">Features</a></li>
  <li><a href="#installation">Installation</a></li>
  <li><a href="#configuration">Configuration</a></li>
  <li>
    <a href="#usage">Usage</a>
    <ol>
      <li><a href="#exporting-chatgpt-data">Exporting ChatGPT Data</a></li>
      <li><a href="#importing-into-obsidian">Importing into Obsidian</a></li>
      <li><a href="#import-results">Import Results</a></li>
      <li><a href="#resetting-the-import-catalog">Resetting the Import Catalog</a></li>
    </ol>
  </li>
  <li><a href="#understanding-the-import-report">Understanding the Import Report</a></li>
  <li>
    <a href="#more-features">More Features</a>
    <ol>
      <li><a href="#opening-conversation-in-its-original-webapp">Opening Conversation in its Original Webapp</a></li>
    </ol>
  </li>
  <li><a href="#troubleshooting">Troubleshooting</a></li>
  <li><a href="#important-notes">Important Notes</a></li>
</ol>


## About

Master branch: [1.0.2 (Stable Release)](https://github.com/Superkikim/nexus-ai-chat-importer/tree/master)  
dev-modular branch: [2.0.0-alpha.1](https://github.com/Superkikim/nexus-ai-chat-importer/tree/dev-modular) - Refactoring in progress

The Nexus AI Chat Importer Plugin simplifies the process of importing ChatGPT conversations from export files into Obsidian.

## Overview

The Nexus AI Chat Importer Plugin for Obsidian allows you to seamlessly import your AI chat conversations from export files into your Obsidian vault. This plugin organizes your ChatGPT conversations into readable Markdown files, making them easily accessible and searchable within Obsidian.

## Features

-   Import conversations from export files directly into Obsidian
-   Automatically organize conversations by date
-   Create individual Markdown files for each conversation
-   Update existing conversations with new messages
-   Detailed import reports for tracking the import process
-   One-time upgrade check to ensure users are up-to-date
-   Improved import reports with more accurate and detailed information

## Installation

1. Download the contents of the `dist` folder from the repository.
2. In your Obsidian vault, navigate to the `.obsidian/plugins/` directory.
3. Create a new folder called `nexus-ai-chat-importer`.
4. Copy the downloaded files into the `nexus-ai-chat-importer` folder.
5. Open Obsidian and go to Settings > Community Plugins.
6. Disable Safe Mode if it's enabled.
7. Refresh the list of plugins.
8. Find "Nexus AI Chat Importer" in the list and enable it by toggling the switch.

Note: You may need to restart Obsidian after installing the plugin for it to appear.

For detailed installation instructions, please refer to the [README](https://github.com/Superkikim/nexus-ai-chat-importer/blob/v1.0.2/README.md#installation) file included in this release.

## Configuration

1. Go to Settings > Nexus AI Chat Importer
2. Set the "Nexus AI Chat Importer Folder" to specify where imported conversations will be stored
3. Optionally, enable "Add Date Prefix to Filenames" and choose a date format

## Usage

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

-   New conversations will be created as individual Markdown files
-   Existing conversations will be updated with new messages (if any)
-   An import report will be generated in the archive folder, detailing the results

### Resetting the Import Catalog

1. Open the Command Palette (Cmd/Ctrl + P)
2. Search for and select "Reset Nexus AI Chat Importer Catalogs: Reset Catalogs"
3. Confirm the action when prompted

## Understanding the Import Report

The import report provides a summary of the import process, including:

-   Total number of existing conversations
-   Number of new conversations imported
-   Number of conversations updated
-   Number of new messages added

It also includes detailed tables for created, updated, and skipped notes.

## More Features

### Opening Conversation in its Original Webapp

By clicking the note title, you will be directed to the original conversation webapp directly in your default browser. Be aware that:

1. The conversation must still exist in your account history.
2. You need to be authenticated in your browser.
3. You may require an active subscription to access your chat history.

## Troubleshooting

-   If the import fails, check the console log for error messages.
-   Ensure you have write permissions for your Obsidian vault.
-   Verify that the ZIP file is a valid ChatGPT export.

## Important Notes

-   This version introduces new metadata parameters required for certain features. Users are advised to re-import their conversations to ensure full functionality.
-   The plugin has been officially renamed to "Nexus AI Chat Importer" to better reflect its functionality.
-   For users upgrading from previous versions, it's recommended to delete old data and re-import conversations with this new version for optimal performance and feature compatibility.

For more detailed information about the latest release, please refer to the [Release Notes](https://github.com/Superkikim/nexus-ai-chat-importer/blob/v1.0.2/v1.0.2_RELEASE_NOTES.md).
