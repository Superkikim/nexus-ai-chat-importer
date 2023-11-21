import { Plugin, PluginSettingTab, Setting } from 'obsidian';
import JSZip from 'jszip';


export default class ChatGPTImportPlugin extends Plugin {
    settings: PluginSettings;

    async onload() {
        await this.loadSettings();

        this.addSettingTab(new ChatGPTImportPluginSettingTab(this.app, this));

        this.addCommand({
            id: 'import-chatgpt-zip',
            name: 'Import ChatGPT ZIP',
            callback: () => {
                this.selectZipFile();
            }
        });
    }

    selectZipFile() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.zip';
        input.onchange = (e) => {
            const file = e.target.files[0];
            this.handleZipFile(file);
        };
        input.click();
    }

    async handleZipFile(file) {
        const zip = new JSZip();
        const content = await zip.loadAsync(file);
        const conversationsJson = await content.file('conversations.json').async('string');
        
        const chats = JSON.parse(conversationsJson);
    
        // Extract the full timestamp from the ZIP file name
        const regex = /-(\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2})\.zip$/;
        const match = file.name.match(regex);
        const timestamp = match ? match[1] : "UnknownDate";
    
        const folderPath = `${this.settings.archiveFolder}/${timestamp}`;

        try {
            await this.app.vault.createFolder(folderPath);
        } catch (e) {
            console.error("Error creating folder:", e);
        }

        for (const chat of chats) {
            await this.createMarkdown(chat, folderPath);
        }
    }

    async createMarkdown(chat, folderPath) {
        let title = chat.title.replace(/[\/\\]/g, '_') || "Untitled";
        title = title.replace(/:/g, '-'); // Replace colons with hyphens
    
        const create_time_str = this.formatTimestamp(chat.create_time, true);
        const update_time_str = this.formatTimestamp(chat.update_time, true);
        let content = `# Topic: ${title}\nCreated: ${create_time_str}\nLast Updated: ${update_time_str}\n\n`;
    
        for (const messageId in chat.mapping) {
            const messageInfo = chat.mapping[messageId];
            const message = messageInfo.message;
            if (message && message.content && message.content.parts && message.content.parts.length > 0) {
                let messageText = message.content.parts[0] + ""; // Convert to string explicitly
                if (!messageText.trim()) continue; // Skip empty messages
    
                const messageTime = this.formatTimestamp(message.create_time, true);
                const authorName = message.author.role === 'user' ? "User" : "ChatGPT";
                const headingLevel = authorName === "User" ? "###" : "####";
                const quoteChar = authorName === "User" ? ">" : ">>";
    
                content += `${headingLevel} ${authorName}, on ${messageTime}\n`;
                content += messageText.split('\n').map(line => `${quoteChar} ${line}`).join('\n');
    
                if (authorName === "ChatGPT") {
                    content += "\n---\n";
                }
                content += '\n\n';
            }
        }
    
        const fileName = `${folderPath}/${title}.md`;
        try {
            let file = this.app.vault.getAbstractFileByPath(fileName);
            if (!file) {
                file = await this.app.vault.create(fileName, content);
            } else {
                await this.app.vault.modify(file, content);
            }
        } catch (e) {
            console.error("Error creating or modifying file:", e);
        }
    }

    formatTimestamp(unixTime, includeDate = false) {
        const date = new Date(unixTime * 1000);
        const dateString = date.toLocaleDateString();
        const timeString = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: true });
    
        return includeDate ? `${dateString} at ${timeString}` : timeString;
    }
    

    async loadSettings() {
        this.settings = Object.assign({}, defaultSettings, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}

class ChatGPTImportPluginSettingTab extends PluginSettingTab {
    plugin: ChatGPTImportPlugin;

    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display() {
        const { containerEl } = this;
        containerEl.empty();

        new Setting(containerEl)
            .setName('ChatGPT Archive Folder')
            .setDesc('Choose a folder to store ChatGPT archives')
            .addText(text => text
                .setValue(this.plugin.settings.archiveFolder || '')
                .onChange(async (value) => {
                    this.plugin.settings.archiveFolder = value;
                    await this.plugin.saveSettings();
                }));
    }
}

interface PluginSettings {
    archiveFolder: string;
}

const defaultSettings: PluginSettings = {
    archiveFolder: ''
};
