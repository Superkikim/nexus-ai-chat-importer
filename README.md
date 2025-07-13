# Nexus AI Chat Importer Plugin for Obsidian

![Version](https://img.shields.io/badge/version-1.1.0-blue)

## Overview

The Nexus AI Chat Importer Plugin for Obsidian provides a seamless way to import AI chat conversations from various providers into your Obsidian vault with **full attachment support**.

**🎉 NEW in v1.1.0: Complete attachment import system with DALL-E image support, smart file detection, and provider-organized reports!**

With version 1.1.0, the plugin features a comprehensive attachment handling system, DALL-E image integration, and enhanced reporting architecture designed for multi-provider support.

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
      <li><a href="#attachment-handling">Attachment Handling</a></li>
      <li><a href="#opening-conversation-in-its-original-webapp">Opening Conversation in its Original Webapp</a></li>
    </ol>
  </li>
  <li><a href="#troubleshooting">Troubleshooting</a></li>
  <li><a href="#important-notes">Important Notes</a></li>
</ol>

## About

Master branch: [1.1.0 (Stable Release)](https://github.com/Superkikim/nexus-ai-chat-importer/tree/master)

The Nexus AI Chat Importer Plugin revolutionizes how you preserve AI conversations by importing complete chat histories with all attachments, images, and generated content directly into your Obsidian vault.

## Overview

The plugin allows you to seamlessly import your AI chat conversations from export files into your Obsidian vault with **complete attachment support**. It organizes your conversations into readable Markdown files, automatically imports images and documents, and makes everything easily accessible and searchable within Obsidian. With support for multiple file imports, iOS devices, DALL-E generated images, and provider-specific organization, you can efficiently manage thousands of conversations with all their rich content across all platforms.

## Features

### 🎨 **Complete Attachment Support (NEW)**
- **DALL-E Image Import**: Automatically detects and imports AI-generated images
- **Smart File Detection**: Converts legacy .dat files to correct formats (PNG, JPEG, etc.)
- **Universal File Support**: Images, documents, audio files, and more
- **Intelligent Linking**: Images embedded (![[image.png]]), documents linked ([[document.pdf]])
- **Status Tracking**: Visual indicators show which attachments were found, missing, or failed

### 📊 **Enhanced Import Reports (NEW)**
- **Provider-Organized Reports**: Separate folders for each AI provider (Reports/chatgpt/, Reports/claude/)
- **Smart Date Extraction**: Report names based on ZIP file dates (2025.04.25 format)
- **Attachment Statistics**: Visual status indicators (✅ ⚠️ ❌) for attachment processing
- **Clickable Note Links**: Direct navigation to imported conversations from reports

### 🤖 **Advanced AI Integration**
- **DALL-E Integration**: Generated images become separate Assistant messages with prompts
- **Clean Conversation Filtering**: ChatGPT internal messages automatically removed
- **Multi-Provider Architecture**: Extensible design prepared for multiple AI chat providers

### ⚡ **High-Performance Import**
- **Optimized for Large Collections**: Handles 1000+ conversations efficiently
- **Batch Processing**: Import multiple conversations from multiple export files
- **Chronological Organization**: Process exports in chronological order for data consistency
- **Smart Updates**: Update existing conversations with new messages without duplication

### 🗂️ **Intelligent Organization**
- **Automatic Folder Structure**: Organized by date (Year/Month)
- **Individual Markdown Files**: Each conversation becomes a searchable Markdown file
- **Attachment Organization**: Files organized by provider and category
- **Direct Chat Links**: Quick access to original conversations in web apps

### 📱 **Cross-Platform Support**
- **iOS Support**: Full functionality on mobile devices
- **Memory Optimization**: Efficient metadata caching prevents performance degradation
- **Multi-device Usage**: Seamless synchronization across devices

## Installation

1. Enable Community Plugins in Obsidian settings.
1. Browse the Community Plugins list and search for "Nexus AI Chat Importer".
1. Click "Install" to install the plugin.
1. Enable the plugin in the Plugins settings.

### iOS Installation

1. Ensure you have the latest version of Obsidian installed on your iOS device.
1. Follow the same steps as above to enable and install the Nexus AI Chat Importer plugin.
1. The plugin will now be available for use on your iOS device.

## Configuration

1. Go to Settings > Nexus AI Chat Importer
1. Set the "Conversations folder" to specify where imported conversations will be stored
1. Configure date prefix options for organizing your imported files
1. **NEW**: Enable "Import attachments" to save files and images from conversations
1. **NEW**: Set "Attachment folder" to organize imported files by provider and category
1. **NEW**: Configure attachment handling preferences (missing file behavior, detailed reporting)

## Usage

### Exporting ChatGPT Data

1. Log in to your ChatGPT account.
1. Click your user icon (usually, a circle with your initials)
1. Navigate to the "Settings" then "Data controls" section.
1. Click the "Export" button next to "Export data".

You will soon receive an email with a download link

### Importing into Obsidian (Desktop)

1. Click the "AI Chat Importer - import new file" (chat icon with a + sign) button or open the command prompt (CTRL/Command P) and search for Nexus AI Chat Importer: Select ZIP file to process
1. Select one or multiple archive files you have downloaded from the chat provider platform
1. Files will be processed in chronological order to maintain data consistency
1. **NEW**: Attachments will be automatically extracted and organized if enabled in settings

### Importing into Obsidian (iOS)

1. Close the sidebar if it's open by sliding to the left and click on the menu icon at the bottom right of the screen
1. Select the "AI Chat Importer - import new file" option (chat icon with a + sign)
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
- **NEW**: Attachments will be saved to the attachment folder and linked in conversations
- **NEW**: Provider-specific import reports will be generated with attachment statistics

### Resetting the Import Catalog

If you encounter issues with the import process or want to start fresh, you can reset the import catalog. This will clear the list of imported conversations, allowing you to import the same data again.

1. Open the Command Palette (Cmd/Ctrl + P)
1. Search for and select "Nexus AI Chat Importer: Reset catalogs"
1. Confirm the action when prompted

## Understanding the Import Report

The import report provides a comprehensive summary of the import process, including:

- Total number of existing conversations
- Number of new conversations imported
- Number of conversations updated
- Number of new messages added
- **NEW**: Attachment statistics with visual status indicators
- **NEW**: Provider-specific organization for easy management

It also includes detailed tables for created, updated, and skipped notes with clickable links for easy navigation.

## More Features

### Attachment Handling

**NEW in v1.1.0**: Comprehensive attachment support with intelligent processing:

#### 🎨 **DALL-E Image Integration**
- **Automatic Detection**: AI-generated images automatically identified and imported
- **Separate Messages**: DALL-E images appear as distinct Assistant messages
- **Prompt Inclusion**: Generation prompts preserved as attachment metadata
- **Smart Naming**: Descriptive filenames based on generation metadata

#### 📁 **File Organization**
- **Provider Structure**: `Attachments/chatgpt/images/`, `Attachments/chatgpt/documents/`
- **Category Sorting**: Automatic categorization by file type
- **Format Detection**: Legacy .dat files converted to correct extensions
- **Conflict Resolution**: Automatic handling of duplicate filenames

#### 📊 **Status Tracking**
- **Visual Indicators**: ✅ (found), ⚠️ (partial), ❌ (missing) in reports
- **Detailed Logging**: Complete processing information for troubleshooting
- **Missing File Handling**: Informative notes for files not included in exports

#### ⚙️ **Settings**
- **Import Toggle**: Enable/disable attachment processing
- **Custom Paths**: Configure attachment storage location
- **Missing File Behavior**: Choose how to handle files not found in exports
- **Report Detail Level**: Control verbosity of attachment statistics

### Opening Conversation in its Original Webapp

By clicking the note title, you will be directed to the original conversation webapp directly in your default browser. This feature works only once indexing is completed.

**Requirements:**

1. The conversation must still exist in your account history
1. You need to be authenticated in your browser
1. You may require an active subscription to access your chat history

## 🎉 Major New Features in v1.1.0

### Complete Attachment Ecosystem
Version 1.1.0 introduces a comprehensive attachment handling system that transforms how you preserve AI conversations:

- **Universal Import**: Images, documents, audio files, and DALL-E generated content
- **Smart Processing**: Automatic file format detection and conversion
- **Organized Storage**: Provider-specific folder structure with category organization
- **Status Awareness**: Visual feedback on attachment processing success/failure

### DALL-E Integration Revolution
Experience seamless integration with AI-generated content:

- **Automatic Recognition**: DALL-E images detected and imported automatically
- **Contextual Preservation**: Generation prompts saved with images
- **Clean Presentation**: Generated images appear as separate Assistant messages
- **Legacy Support**: Handles both old (.dat) and new file formats

### Enhanced Reporting System
Get detailed insights into your import process:

- **Provider Organization**: Reports organized by AI platform
- **Smart Naming**: Automatic date extraction from ZIP filenames
- **Visual Statistics**: Emoji-based status indicators for quick scanning
- **Actionable Information**: Clickable links directly to imported conversations

## Performance Improvements

Version 1.1.0 builds on the performance foundation of 1.0.8 with additional optimizations:

- **Efficient Attachment Processing**: Smart ZIP scanning without performance impact
- **Memory Management**: Optimized handling of large files and attachment collections
- **Selective Processing**: Only processes attachments when explicitly enabled
- **Background Operations**: Non-blocking attachment extraction

## Troubleshooting

- If the import fails, check the console log for error messages
- Ensure you have write permissions for your Obsidian vault
- Verify that the ZIP file is a valid ChatGPT export
- When importing multiple files, ensure they have valid timestamps in their filenames for proper ordering
- For performance issues with large vaults, try restarting Obsidian after installation
- **NEW**: Check attachment settings if files are not being imported
- **NEW**: Review import reports for detailed attachment processing status

## Important Notes

### Attachment Considerations

- **Storage Space**: Attachments can significantly increase vault size
- **Sync Impact**: Consider excluding attachment folders from cloud sync for large collections
- **Legacy Support**: .dat files from older exports are automatically converted
- **Provider Differences**: Different AI platforms may have varying attachment export capabilities

### Performance Considerations

- The plugin works great even with thousands of imported conversations and attachments
- You may notice faster performance after restarting Obsidian following an upgrade
- Large imports work best when Obsidian isn't busy with other tasks
- Attachment processing adds minimal overhead to import time

### Upgrading from Previous Versions

- **From 1.0.8**: Seamless upgrade with new attachment features automatically available
- **From earlier versions**: All existing conversations remain fully functional
- **Settings Migration**: Previous settings preserved with new attachment options added
- **Data Compatibility**: No re-import required for existing conversations

For more detailed information about the latest release, please refer to the [Release Notes](RELEASE_NOTES.md).

## Contributors

I'd like to thank the following contributors for their valuable contributions to our project:

- GitHub user [@drainch](https://github.com/drainch): Added iOS support, making changes to `manifest.json`, `README.md`, `package.json`, `esbuild.config.mjs`, and updated the release notes.

## Architecture

Version 1.1.0 introduces significant architectural improvements designed for the future:

- **Attachment Infrastructure**: Complete file handling and processing system
- **Provider Abstraction**: Clean separation between core and provider-specific logic
- **Multi-Provider Ready**: Prepared to support other AI chat platforms with their unique attachment formats
- **Performance Focused**: Optimized for handling large conversation collections with rich media content
- **Future Enhancements**: Foundation laid for advanced features like selective import and content analysis