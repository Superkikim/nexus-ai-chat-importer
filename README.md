# Nexus AI Chat Importer Plugin for Obsidian

![Version](https://img.shields.io/badge/version-1.0.4-blue)

## Overview

Version 1.0.4 of the Nexus AI Chat Importer Plugin for Obsidian introduces support for iOS.

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

Master branch: [1.0.4 (Stable Release)](https://github.com/Superkikim/nexus-ai-chat-importer/tree/master)  

The Nexus AI Chat Importer Plugin simplifies the process of importing ChatGPT conversations from export files into Obsidian.

## Overview

The plugin allows you to seamlessly import your AI chat conversations from export files into your Obsidian vault. It organizes your ChatGPT conversations into readable Markdown files, making them easily accessible and searchable within Obsidian. Now, with iOS support, you can manage your conversations on your iOS devices as well.

## Features

-   Import conversations from export files directly into Obsidian
-   Automatically organize conversations by date
-   Create individual Markdown files for each conversation
-   Update existing conversations with new messages
-   Detailed import reports for tracking the import process
-   One-time upgrade check to ensure users are up-to-date
-   Improved import reports with more accurate and detailed information
-   iOS support for managing conversations on mobile devices

## Installation

1. Enable Community Plugins in Obsidian settings.
2. Browse the Community Plugins list and search for "Nexus AI Chat Importer".
3. Click "Install" to install the plugin.
4. Enable the plugin in the Plugins settings.

### iOS Installation

1. Ensure you have the latest version of Obsidian installed on your iOS device.
2. Follow the same steps as above to enable and install the Nexus AI Chat Importer plugin.
3. The plugin will now be available for use on your iOS device.

## Configuration

1. Go to Settings > Nexus AI Chat Importer
2. Set the "Nexus AI Chat Importer Folder" to specify where imported conversations will be stored

## Usage

### Exporting ChatGPT Data

1. Log in to your ChatGPT account.
2. Click your user icon (usually, a circle with your initials)
3. Navigate to the "Settings" then "Data controls" section.
4. Click the "Export" button next to "Export data". 

You will soon receive an email with a download link

### Importing into Obsidian (Desktop)
1. Click the “AI Chat Importer - import new file” (chat icon with a + sign) button or open the command prompt (CTRL/Command P) and search for Nexus AI Chat Importer: Select ZIP file to process
2. Select the archive file you have downloaded from the chat provider platform

### Importing into Obsidian (iOS)
1. Close the sidebar if it's open by sliding to the left and click on the menu icon at the bottom right of the screen
2. Select the "AI Chat Importer - import new file" option (chat icon with a + sign)
3. Select the archive file you have previously downloaded from the chat provider platform

### Multi-device usage
-   The plugin is designed to work seamlessly across multiple devices and platforms.
-   You can use it on your desktop computer or iOS device however, it is imperative to ensure any type of synching in place has been completed prior to importing new files.

### Import Results

-   A tree of years/months will be created in the destination folder you selected in the configuration step
-   New conversations will be created as individual Markdown files
-   A date prefix will be added to each NEW conversation according to the selected date format
-   Existing conversations will be updated with new messages (if any)
-   An import report will be generated in the Reports subfolder, detailing the results

### Resetting the Import Catalog

If you encounter issues with the import process or want to start fresh, you can reset the import catalog. This will clear the list of imported conversations, allowing you to import the same data again.

1. Open the Command Palette (Cmd/Ctrl + P)
2. Search for and select "Nexus AI Chat Importer Catalogs: Reset Catalogs"
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

By clicking the note title, you will be directed to the original conversation webapp directly in your default browser. This feature works only once indexing is completed.

Beware:

1. The conversation must still exist in your account history.
2. You need to be authenticated in your browser.
3. You may require an active subscription to access your chat history.

## Troubleshooting

-   If the import fails, check the console log for error messages.
-   Ensure you have write permissions for your Obsidian vault.
-   Verify that the ZIP file is a valid ChatGPT export.

## Important Notes for if you upgrade from version prior to v1.0.2

-   Version 1.0.2 has introduces new metadata parameters required for certain features. Users are advised to re-import their conversations to ensure full functionality.
-   The plugin has been officially renamed to "Nexus AI Chat Importer" to better reflect its functionality.
-   For users upgrading from previous versions, it's recommended to delete old data and re-import conversations with this new version for optimal performance and feature compatibility.

For more detailed information about the latest release, please refer to the [Release Notes](v1.0.4_RELEASE_NOTES.md).

## Contributors

I'd like to thank the following contributors for their valuable contributions to our project:

* GitHub user [@drainch](https://github.com/drainch): Added iOS support, making changes to `manifest.json`, `README.md`, `package.json`, `esbuild.config.mjs`, and updated the release notes in `v1.0.4_RELEASE_NOTES.md`.