# Nexus AI Chat Importer

![Stable Version](https://img.shields.io/badge/stable-v1.0.1b-green)
![Development Version](https://img.shields.io/badge/development-v2.0.0--alpha.1-blue)

## Important Version Information

- **Stable Version (v1.0.1b)**: 
  - Currently released as "Obsidian ChatGPT Import"
  - Available in the [Releases section](https://github.com/Superkikim/nexus-chat-ai-importer/releases)
  - Supports only ChatGPT exported data

- **Development Version (v2.0.0-alpha.1)**:
  - Currently under active development
  - Not yet functional or released
  - Will support multiple AI chat platforms

**Note**: The following information pertains to the upcoming v2.0.0 release. For the stable v1.0.1b, please refer to the release notes in the GitHub repository.

## Overview

Nexus AI Chat Importer is an Obsidian plugin that seamlessly integrates AI chat conversations into your vault. It transforms chat archives from platforms like ChatGPT or Claude into organized, searchable Markdown files.

## Key Features

- Import AI chat archives (ZIP files) directly into your Obsidian vault
- Automatically organize conversations by date
- Generate individual Markdown files for each conversation
- Update existing notes with new messages
- Provide detailed import logs

## Installation

As the v2.0.0 is not yet released, please use v1.0.1b for now. Installation instructions for v2.0.0 will be provided upon release.

## Configuration

1. Go to Settings > Nexus AI Chat Importer
2. Set the "Archive Folder" for imported conversations
3. Optional: Enable "Add Date Prefix to Filenames" and choose a date format

## Usage

1. Export your AI chat data from the source platform
2. In Obsidian, run the command "Nexus AI Chat Importer: Import Chat ZIP"
3. Select your exported ZIP file
4. The plugin will process and import your conversations

### Import Results

- New conversations appear as individual Markdown files
- Existing notes are updated with new messages
- An import log is generated in the archive folder

### Resetting the Import Catalog

Use the command "Nexus AI Chat Importer: Reset Catalogs" to clear the plugin's record of processed ZIP files, allowing for reimporting if needed.

## Troubleshooting

- Check the console log for error messages if import fails
- Ensure you have write permissions for your vault
- Verify that the ZIP file is a valid AI chat export

## Known Issues

Versions prior to 1.0.1b may remove messages when updating existing notes. We recommend keeping your original ZIP files as a precaution.

## Support and Contributions

For support, feature requests, or bug reports, please use our [GitHub Issues page](https://github.com/Superkikim/nexus-chat-ai-importer/issues).

Contributions are welcome! See our contribution guidelines for more information.

## License

This plugin is released under the [MIT License](LICENSE).

---

Enhance your Obsidian experience by seamlessly integrating AI chat conversations into your vault with Nexus AI Chat Importer.
