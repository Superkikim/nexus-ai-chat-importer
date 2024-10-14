# Nexus AI Chat Importer Plugin for Obsidian

![Version](https://img.shields.io/badge/version-2.0.0--alpha.3-blue)

## About

Master branch: [1.0.2 (Stable Release)](https://github.com/Superkikim/nexus-ai-chat-importer/tree/master)
dev-modular branch: [2.0.0-alpha.3](https://github.com/Superkikim/nexus-ai-chat-importer/tree/refactor/2.0.0-alpha.3) - Refactoring in progress

The Nexus AI Chat Importer Plugin simplifies the process of importing ChatGPT conversations from export files into Obsidian.

## Current Development Status

We are currently in the process of refactoring the plugin to improve its structure and maintainability. The current version on the dev-modular branch is 2.0.0-alpha.3.

### Refactoring Goals

-   Alpha 3 (Current): Restructure the codebase while maintaining 100% feature parity with the stable 1.0.2 release.
-   Alpha 4 (Planned): Introduce new features and improvements based on the refactored structure.

Please note that the dev-modular branch is not stable and is not recommended for production use.

## Overview

The Nexus AI Chat Importer Plugin for Obsidian allows you to seamlessly import your AI chat conversations from export files into your Obsidian vault. This plugin organizes your ChatGPT conversations into readable Markdown files, making them easily accessible and searchable within Obsidian.

## Features

-   Import conversations from export files directly into Obsidian
-   Automatically organize conversations by date
-   Create individual Markdown files for each conversation
-   Update existing conversations with new messages
-   Detailed import reports for tracking the import process
-   Click on the conversation title to open the chat in the original web app
-   One-time upgrade check to ensure users are up-to-date
-   Open the original ChatGPT conversation directly from Obsidian with a single click
-   Improved import reports with more accurate and detailed information

## Installation

**Note: During the refactoring process, installation from the dev-modular branch is not recommended for regular users.**

For developers interested in contributing or testing the refactoring process:

1. Clone the repository and checkout the dev-modular branch.
2. Run `npm install` to install dependencies.
3. Use `npm run build` to compile the plugin.
4. Copy the compiled files to your Obsidian plugins folder.

For regular users, please use the stable 1.0.2 release from the master branch.

## Configuration

1. Go to Settings > Nexus AI Chat Importer
2. Set the "Nexus AI Chat Importer Folder" to specify where imported conversations will be stored
3. Optionally, enable "Add Date Prefix to Filenames" and choose a date format

## Usage

(Usage instructions remain the same as in the previous version)

## Understanding the Import Report

(Import report details remain the same as in the previous version)

## Troubleshooting

-   If the import fails, check the console log for error messages
-   Ensure you have write permissions for your Obsidian vault
-   Verify that the ZIP file is a valid ChatGPT export

## Important Notes

-   The plugin is currently undergoing a major refactoring. Users are advised to use the stable 1.0.2 release for production environments.
-   Developers interested in the refactoring process can follow the dev-modular branch, but should be aware that it may contain unstable code.
-   Once the refactoring is complete and new features are added in alpha 4, we will provide update instructions for users of previous versions.

For more detailed information about the latest stable release, please refer to the [Release Notes](https://github.com/Superkikim/nexus-ai-chat-importer/blob/v1.0.2/v1.0.2_RELEASE_NOTES.md).

## Contributing

We welcome contributions to the Nexus AI Chat Importer plugin! If you're interested in helping with the refactoring process or have ideas for new features, please check out our [Contributing Guidelines](CONTRIBUTING.md) (create this file if it doesn't exist).

## License

This project is licensed under the [MIT License](LICENSE).
