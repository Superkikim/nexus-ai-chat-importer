# Nexus AI Chat Importer Plugin for Obsidian

![Version](https://img.shields.io/badge/version-1.0.8-blue)

## Overview

The Nexus AI Chat Importer Plugin for Obsidian provides a seamless way to import AI chat conversations from various providers into your Obsidian vault.

**⚠️ IMPORTANT: Version 1.0.8 fixes critical performance issues for users with large conversation collections. If you have 1000+ imported conversations and experience slow Obsidian startup, please update immediately.**

With version 1.0.8, the plugin features significant performance improvements and a restructured architecture designed for multi-provider support.

## ☕ Support My Work

If this plugin simplifies your life, consider supporting its development:

[![Support me on Ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/nexusplugins)

**Suggested amounts:**

- **$5** - Fuel my coding sessions with caffeine ☕
- **$25** - Power my AI development tools 🤖
- **$75** - Supercharge my entire dev toolkit 🚀

*Your support helps me continue building useful tools and explore new ways of making your life easier.*

-----

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

Master branch: [1.0.8 (Stable Release)](https://github.com/Superkikim/nexus-ai-chat-importer/tree/master)

The Nexus AI Chat Importer Plugin simplifies the process of importing AI chat conversations from export files into Obsidian, with optimized performance for large conversation collections.

## Overview

The plugin allows you to seamlessly import your AI chat conversations from export files into your Obsidian vault. It organizes your conversations into readable Markdown files, making them easily accessible and searchable within Obsidian. With support for multiple file imports, iOS devices, and significant performance optimizations, you can efficiently manage thousands of conversations across all platforms.

## Features

- **High-Performance Import**: Optimized for large conversation collections (1000+ conversations)
- **Multi-Provider Architecture**: Extensible design prepared for multiple AI chat providers
- **Batch Processing**: Import multiple conversations from multiple export files
- **Chronological Organization**: Process exports in chronological order for data consistency
- **Automatic Organization**: Create folder structures organized by date
- **Individual Markdown Files**: Each conversation becomes a searchable Markdown file
- **Smart Updates**: Update existing conversations with new messages without duplication
- **Detailed Import Reports**: Track the import process with comprehensive reporting
- **Direct Chat Links**: Quick access to original conversations in web apps
- **iOS Support**: Full functionality on mobile devices
- **Memory Optimization**: Efficient metadata caching prevents performance degradation

## Installation

1. Enable Community Plugins in Obsidian settings.
1. Browse the Community Plugins list and search for “Nexus AI Chat Importer”.
1. Click “Install” to install the plugin.
1. Enable the plugin in the Plugins settings.

### iOS Installation

1. Ensure you have the latest version of Obsidian installed on your iOS device.
1. Follow the same steps as above to enable and install the Nexus AI Chat Importer plugin.
1. The plugin will now be available for use on your iOS device.

## Configuration

1. Go to Settings > Nexus AI Chat Importer
1. Set the “Conversations folder” to specify where imported conversations will be stored
1. Configure date prefix options for organizing your imported files

## Usage

### Exporting ChatGPT Data

1. Log in to your ChatGPT account.
1. Click your user icon (usually, a circle with your initials)
1. Navigate to the “Settings” then “Data controls” section.
1. Click the “Export” button next to “Export data”.

You will soon receive an email with a download link

### Importing into Obsidian (Desktop)

1. Click the “AI Chat Importer - import new file” (chat icon with a + sign) button or open the command prompt (CTRL/Command P) and search for Nexus AI Chat Importer: Select ZIP file to process
1. Select one or multiple archive files you have downloaded from the chat provider platform
1. Files will be processed in chronological order to maintain data consistency

### Importing into Obsidian (iOS)

1. Close the sidebar if it’s open by sliding to the left and click on the menu icon at the bottom right of the screen
1. Select the “AI Chat Importer - import new file” option (chat icon with a + sign)
1. Select the archive file you have previously downloaded from the chat provider platform

### Multi-device Usage

- The plugin is designed to work seamlessly across multiple devices and platforms.
- Optimized performance ensures smooth operation even with large conversation collections
- Ensure synchronization is complete before importing new files on different devices

### Import Results

- A tree of years/months will be created in the destination folder you selected in the configuration step
- New conversations will be created as individual Markdown files
- A date prefix will be added to each NEW conversation according to the selected date format
- Existing conversations will be updated with new messages (if any)
- An import report will be generated in the Reports subfolder, detailing the results

### Resetting the Import Catalog

If you encounter issues with the import process or want to start fresh, you can reset the import catalog. This will clear the list of imported conversations, allowing you to import the same data again.

1. Open the Command Palette (Cmd/Ctrl + P)
1. Search for and select “Nexus AI Chat Importer: Reset catalogs”
1. Confirm the action when prompted

## Understanding the Import Report

The import report provides a summary of the import process, including:

- Total number of existing conversations
- Number of new conversations imported
- Number of conversations updated
- Number of new messages added

It also includes detailed tables for created, updated, and skipped notes.

## More Features

### Opening Conversation in its Original Webapp

By clicking the note title, you will be directed to the original conversation webapp directly in your default browser. This feature works only once indexing is completed.

**Requirements:**

1. The conversation must still exist in your account history
1. You need to be authenticated in your browser
1. You may require an active subscription to access your chat history

## 🚀 Critical Performance Fix in v1.0.8

**If you’re experiencing slow Obsidian startup after importing many conversations, this update is essential:**

- **Problem Fixed**: Previous versions caused Obsidian to become extremely slow when you had imported 1000+ conversations
- **Root Cause**: The plugin was scanning all files every time you switched between notes
- **Solution**: Version 1.0.8 completely eliminates this file scanning, making Obsidian fast again
- **Impact**: Users report going from 30+ second startup times back to normal 2-3 second startups

**Recommended Action**: Update to v1.0.8 immediately if you have a large collection of imported conversations.

## Performance Improvements

Version 1.0.8 introduces significant performance optimizations:

- **Faster Startup**: Plugin loads much quicker, especially in large vaults
- **Smoother Navigation**: No more lag when switching between files
- **Better Memory Usage**: Plugin uses memory more efficiently during long sessions
- **Large Collection Support**: Handles 1000+ conversations without slowdowns

## Troubleshooting

- If the import fails, check the console log for error messages
- Ensure you have write permissions for your Obsidian vault
- Verify that the ZIP file is a valid ChatGPT export
- When importing multiple files, ensure they have valid timestamps in their filenames for proper ordering
- For performance issues with large vaults, try restarting Obsidian after installation

## Important Notes

### Performance Considerations

- The plugin works great even with thousands of imported conversations
- You may notice faster performance after restarting Obsidian following an upgrade
- Large imports work best when Obsidian isn’t busy with other tasks

### Upgrading from Previous Versions

- **CRITICAL**: If you have 1000+ conversations and slow Obsidian performance, update to v1.0.8 immediately
- Version 1.0.2+ users can upgrade seamlessly with massive performance improvements
- Users with versions prior to 1.0.2 should re-import conversations for full functionality
- Restart Obsidian after upgrading to experience the full performance benefits

For more detailed information about the latest release, please refer to the [Release Notes](RELEASE_NOTES.md).

## Contributors

I’d like to thank the following contributors for their valuable contributions to our project:

- GitHub user [@drainch](https://github.com/drainch): Added iOS support, making changes to `manifest.json`, `README.md`, `package.json`, `esbuild.config.mjs`, and updated the release notes.

## Architecture

Version 1.0.8 introduces improvements designed for the future:

- **Better Organization**: Cleaner internal structure for easier maintenance
- **Multi-Provider Ready**: Prepared to support other AI chat platforms in the future
- **Performance Focused**: Optimized for handling large conversation collections
- **Future Enhancements**: Foundation laid for upcoming features