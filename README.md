<div align="center">
  <h1>📥 Obsidian ChatGPT Import Plugin</h1>
  <p>Import ChatGPT archives into Obsidian with ease</p>
</div>

## ATTENTION: BUG ON CONVERSATIONS UPDATES

I realized today there is a naughty bug on conversation updates. If you import already imported conversations, the messages will be removed from the note. 

Until version 1.0.2 has not been released, ensure you DO NOT import already imported conversations, or keep save your zip files for later.

## About

The ChatGPT Import Plugin simplifies the process of importing ChatGPT conversation archives into Obsidian. Follow the steps below to get started.

## Installation

1. Download a release from the [GitHub releases page](https://github.com/Superkikim/obsidian-chatgpt-import/releases)
2. Put the downloaded release folder into the `.obsidian/plugins` folder within your Obsidian vault.
3. In Obsidian, go to "Settings &gt; Community plugins" and enable the "ChatGPT Import" plugin.
4. Follow the instructions above to start importing your ChatGPT data.
   
After installation, follow the setup instructions in the plugin settings to specify the folder path for saving conversations.

## Usage

1. Export your ChatGPT conversation data as a ZIP file:
   - Click on your user icon in ChatGPT.
   - Select "Settings & Beta" > "Data Control" > "Export Data" > "Export."
   - You will receive an email with a link to download the ZIP file.
2. In Obsidian, use the "Import ChatGPT ZIP" command:
   - Select the ZIP file you downloaded.
   - The plugin will create a subfolder named after the date of the export file in the specified folder
   - For each chat in the archive, a note will be created

## Support

For any issues or feature requests, please [open an issue](https://github.com/Superkikim/obsidian-chatgpt-import/issues) on GitHub.

## License

This plugin is licensed under the [MIT License](LICENSE).

---

Enjoy importing your ChatGPT conversations into Obsidian!
