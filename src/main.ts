import { Plugin, PluginSettingTab, Setting, TFile, TFolder, Modal, Notice, moment } from 'obsidian';
import JSZip from 'jszip';

interface PluginSettings {
    archiveFolder: string;
    addDatePrefix: boolean;
    dateFormat: 'YYYY-MM-DD' | 'YYYYMMDD';
}

const DEFAULT_SETTINGS: PluginSettings = {
    archiveFolder: 'ChatGPT Archives',
    addDatePrefix: false,
    dateFormat: 'YYYY-MM-DD'
};

export default class ChatGPTImportPlugin extends Plugin {
    settings: PluginSettings;
    private importLog: ImportLog;
    private importedArchives: Record<string, string> = {}; // hash -> filename
    private conversationRecords: Record<string, { path: string, updateTime: number }> = {};

    /**
     * Source Counters
     */
    totalExistingConversations: number = 0; // Count of all existing conversations in Obsidian
    totalNewConversationsToImport: number = 0; // Count of new conversations to import
    totalNonEmptyMessagesToImport: number = 0; // Count of non-empty messages in new conversations to import
    totalNonEmptyMessagesToAdd: number = 0; // Count of non-empty messages to be added to existing conversations
    totalExistingConversationsToUpdate: number = 0; // Count of existing conversations identified to be updated

    /**
     * Processed Counters
     */
    totalNewConversationsSuccessfullyImported: number = 0; // Count of new conversations successfully imported
    totalConversationsActuallyUpdated: number = 0; // Count of conversations actually updated after processing
    totalNonEmptyMessagesAdded: number = 0; // Count of non-empty messages actually added to conversations
    
    async onload() {
        console.log('Loading ChatGPT Import Plugin');
        await this.loadSettings();
    
        this.addSettingTab(new ChatGPTImportPluginSettingTab(this.app, this));
    
        this.addRibbonIcon('message-square-plus', 'Import ChatGPT ZIP', (evt: MouseEvent) => {
            this.selectZipFile();
        });

        this.registerEvent(this.app.vault.on('delete', (file) => {
            if (file instanceof TFile && file.extension === 'md') {
                // Remove the file from conversationRecords if it exists
                for (const [id, record] of Object.entries(this.conversationRecords)) {
                    if (record.path === file.path) {
                        delete this.conversationRecords[id];
                        this.saveSettings();
                        break;
                    }
                }
            }
        }));
        
        this.addCommand({
            id: 'import-chatgpt-zip',
            name: 'Import ChatGPT ZIP',
            callback: () => {
                this.selectZipFile();
            }
        });

        this.addCommand({
            id: 'reset-chatgpt-import-catalogs',
            name: 'Reset ChatGPT Import Catalogs',
            callback: () => {
                const modal = new Modal(this.app);
                modal.contentEl.createEl('p', {text: 'This will reset all import catalogs. This action cannot be undone.'});
                const buttonDiv = modal.contentEl.createEl('div', {cls: 'modal-button-container'});
                buttonDiv.createEl('button', {text: 'Cancel'}).addEventListener('click', () => modal.close());
                buttonDiv.createEl('button', {text: 'Reset', cls: 'mod-warning'}).addEventListener('click', () => {
                    this.resetCatalogs();
                    modal.close();
                });
                modal.open();
            }
        });
    }

    async loadSettings() {
        const data = await this.loadData();
        this.settings = Object.assign({}, DEFAULT_SETTINGS, data?.settings || {});
        this.importedArchives = data?.importedArchives || {};
        this.conversationRecords = data?.conversationRecords || {};
    }
    
    async saveSettings() {
        await this.saveData(this.settings);
    }

    async saveSettings() {
        await this.saveData({
            settings: this.settings,
            importedArchives: this.importedArchives,
            conversationRecords: this.conversationRecords
        });
    }

    selectZipFile() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.zip';
        input.onchange = (e) => {
            const file = e.target.files?.[0];
            if (file) {
                this.handleZipFile(file);
            }
        };
        // Reset the input value to allow selecting the same file again
        input.value = '';
        input.click();
    }

    async validateZipFile(file: File): Promise<JSZip> {
    try {
        const zip = new JSZip();
        const content = await zip.loadAsync(file);
        const fileNames = Object.keys(content.files);

        if (!fileNames.includes('conversations.json')) {
            throw new Error(`File 'conversations.json' not found in the zip: ${file.name}`);
        }

        return zip;
    } catch (error) {
        console.error("[chatgpt-import] Error validating zip file:", error);
        this.importLog.addError('Zip File Validation', error.message);
        throw error;
    }
    }

    async handleZipFile(file: File) {
        this.importLog = new ImportLog();
        try {
            const fileHash = await this.getFileHash(file);
            if (this.importedArchives[fileHash]) {
                const shouldReimport = await this.showConfirmationDialog(
                    `This archive (${file.name}) has already been imported on ${this.importedArchives[fileHash].date}. Do you want to process it again?`
                );
                if (!shouldReimport) {
                    new Notice("Import cancelled.");
                    return;
                }
            }

            const zip = await this.validateZipFile(file);
            const conversationsJson = await zip.file('conversations.json').async('string');
            const chats = JSON.parse(conversationsJson);
            const existingConversations = await this.getAllExistingConversations();

            this.totalExistingConversations = Object.keys(existingConversations).length;
        
            for (const chat of chats) {
                try {
                    const yearMonthFolder = this.getYearMonthFolder(chat.create_time);
                    const path = require('path');
                    const folderPath = path.join(this.settings.archiveFolder, yearMonthFolder);
                    const folderResult = await this.ensureFolderExists(folderPath);
                    
                    if (!folderResult.success) {
                        console.error(`Failed to create or access folder: ${folderPath}. Error: ${folderResult.error}`);
                        continue;
                    }

                    const existingRecord = this.conversationRecords[chat.id];
                    if (existingRecord) {
                        const existingFile = this.app.vault.getAbstractFileByPath(existingRecord.path);
                        if (!existingFile) {
                            // File doesn't exist in the vault, remove it from records and process as new
                            delete this.conversationRecords[chat.id];
                            await this.createNewNote(chat, folderPath, existingConversations);
                        } else if (existingRecord.updateTime >= chat.update_time) {
                            this.importLog.addSkipped(chat.title || 'Untitled', "No updates");
                            continue;
                        } else {
                            await this.updateExistingNote(chat, existingRecord.path);
                        }
                    } else {
                        await this.createNewNote(chat, folderPath, existingConversations);
                    }
                    
                    // Update conversation record
                    this.conversationRecords[chat.id] = {
                        path: `${folderPath}/${this.getFileName(chat)}`,
                        updateTime: chat.update_time
                    };
                } catch (chatError) {
                    console.error(`[chatgpt-import] Error processing chat:`, chatError);
                    this.importLog.addError(chat.title || 'Untitled', chatError.message);
                }
            }

            // Record the imported archive with the current date
            this.importedArchives[fileHash] = {
                fileName: file.name,
                date: new Date().toISOString()
            };
            await this.saveSettings();

            await this.writeImportLog(file.name);
            new Notice(`Import completed. Log file created in the archive folder.`);
        } catch (error) {
            console.error("[chatgpt-import] Error handling zip file:", error);
            this.importLog.addError('Zip File Processing', error.message);
            await this.writeImportLog(file.name);
            new Notice("An error occurred while processing the ZIP file. Please check the log file for details.");
        }
    }

    async processConversations(zip: JSZip, file: File) {
        try {
            const conversationsJson = await zip.file('conversations.json').async('string');
            const chats = JSON.parse(conversationsJson);
            const existingConversations = await this.getAllExistingConversations();

            this.totalExistingConversations = Object.keys(existingConversations).length;
        
            for (const chat of chats) {
                try {
                    const yearMonthFolder = this.getYearMonthFolder(chat.create_time);
                    const path = require('path');
                    const folderPath = path.join(this.settings.archiveFolder, yearMonthFolder);
                    const folderResult = await this.ensureFolderExists(folderPath);
                    
                    if (!folderResult.success) {
                        console.error(`Failed to create or access folder: ${folderPath}. Error: ${folderResult.error}`);
                        continue;
                    }

                    const existingRecord = this.conversationRecords[chat.id];
                    if (existingRecord) {
                        if (existingRecord.updateTime >= chat.update_time) {
                            this.importLog.addSkipped(chat.title || 'Untitled', "No updates");
                            continue;
                        }
                        await this.updateExistingNote(chat, existingRecord.path);
                    } else {
                        await this.createNewNote(chat, folderPath, existingConversations);
                    }
                    
                    // Update conversation record
                    this.conversationRecords[chat.id] = {
                        path: `${folderPath}/${this.getFileName(chat)}`,
                        updateTime: chat.update_time
                    };
                } catch (chatError) {
                    console.error(`[chatgpt-import] Error processing chat:`, chatError);
                    this.importLog.addError(chat.title || 'Untitled', chatError.message);
                }
            }

            await this.writeImportLog(file.name);
            new Notice(`Import completed. Log file created in the archive folder.`);
        } catch (error) {
            console.error("[chatgpt-import] Error processing conversations:", error);
            this.importLog.addError('Conversation Processing', error.message);
            await this.writeImportLog(file.name);
            new Notice("An error occurred while processing conversations. Please check the log file for details.");
        }
    }

    async updateExistingNote(chat: any, filePath: string) {
        const file = this.app.vault.getAbstractFileByPath(filePath);
        if (file instanceof TFile) {
            let content = await this.app.vault.read(file);
            
            // Update metadata
            content = content.replace(
                /^update_time: .*$/m,
                `update_time: ${this.formatTimestamp(chat.update_time, 'date')} at ${this.formatTimestamp(chat.update_time, 'time')}`
            );
    
            // Append new messages
            const newMessages = this.getNewMessages(chat, content);
            content += this.formatNewMessages(newMessages);
    
            await this.app.vault.modify(file, content);
            this.importLog.addUpdated(chat.title || 'Untitled', filePath);
        }
    }
    
    async createNewNote(chat: any, folderPath: string, existingConversations: Record<string, string>) {
        const fileName = await this.getUniqueFileName(chat, folderPath, existingConversations);
        const filePath = `${folderPath}/${fileName}`;
        
        const content = this.generateMarkdownContent(chat);
        
        await this.writeToFile(filePath, content);
        this.importLog.addCreated(chat.title || 'Untitled', filePath);
        this.totalNewConversationsSuccessfullyImported++;
    }
    
    getNewMessages(chat: any, existingContent: string): any[] {
        const existingMessageIds = existingContent.match(/<!-- UID: (.*?) -->/g)?.map(match => match.split(' ')[2]) || [];
        return Object.values(chat.mapping).filter(message => !existingMessageIds.includes(message.id));
    }
    
    formatNewMessages(messages: any[]): string {
        return messages.map(message => this.formatMessage(message)).join('\n\n');
    }
    
    getFileName(chat: any): string {
        let fileName = this.formatTitle(chat.title);
        if (this.settings.addDatePrefix) {
            const createTimeStr = this.formatTimestamp(chat.create_time, this.settings.dateFormat === 'YYYY-MM-DD' ? 'YYYY-MM-DD' : 'YYYYMMDD');
            fileName = `${createTimeStr} - ${fileName}`;
        }
        return `${fileName}.md`;
    }
    
    generateMarkdownContent(chat: any): string {
        const formattedTitle = this.formatTitle(chat.title);
        const create_time_str = `${this.formatTimestamp(chat.create_time, 'date')} at ${this.formatTimestamp(chat.create_time, 'time')}`;
        const update_time_str = `${this.formatTimestamp(chat.update_time, 'date')} at ${this.formatTimestamp(chat.update_time, 'time')}`;
    
        let content = this.generateHeader(formattedTitle, chat.id, create_time_str, update_time_str);
        content += this.generateMessagesContent(chat);
    
        return content;
    }

    showConfirmationDialog(message: string): Promise<boolean> {
        return new Promise((resolve) => {
            const modal = new Modal(this.app);
            modal.contentEl.createEl("p", { text: message });
            
            const buttonContainer = modal.contentEl.createDiv();
            
            buttonContainer.createEl("button", { text: "Yes" }).addEventListener("click", () => {
                modal.close();
                resolve(true);
            });
            
            buttonContainer.createEl("button", { text: "No" }).addEventListener("click", () => {
                modal.close();
                resolve(false);
            });
            
            modal.open();
        });
    }

    async getFileHash(file: File): Promise<string> {
        const buffer = await file.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    async ensureFolderExists(folderPath: string): Promise<{ success: boolean, error?: string }> {
        const folders = folderPath.split("/").filter(p => p.length);
        let currentPath = "";
    
        for (const folder of folders) {
            currentPath += folder + "/";
            const currentFolder = this.app.vault.getAbstractFileByPath(currentPath);
            
            if (!currentFolder) {
                try {
                    await this.app.vault.createFolder(currentPath);
                } catch (error) {
                    // Si le dossier existe déjà, ce n'est pas une erreur
                    if (error.message !== "Folder already exists.") {
                        console.error(`Failed to create folder: ${currentPath}`, error);
                        return { success: false, error: `Failed to create folder: ${currentPath}. Reason: ${error.message}` };
                    }
                }
            } else if (!(currentFolder instanceof TFolder)) {
                return { success: false, error: `Path exists but is not a folder: ${currentPath}` };
            }
        }
        return { success: true };
    }

    getYearMonthFolder(unixTime) {
        const date = new Date(unixTime * 1000);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0'); // JavaScript months are 0-indexed
        return `${year}/${month}`;
    }

    async getUniqueFileName(chat, folderPath, existingConversations) {
        let counter = 1;
        let fileName = this.getFileName(chat);
        let potentialFileName = fileName;
    
        // Check if a file with this name already exists
        while (Object.values(existingConversations).some(existingFile => 
            existingFile.includes(folderPath) && existingFile.endsWith(potentialFileName)
        )) {
            // If exists, append a counter to the name (before the extension)
            const nameWithoutExtension = fileName.slice(0, -3); // remove .md
            potentialFileName = `${nameWithoutExtension}-${counter}.md`;
            counter++;
        }
    
        return potentialFileName;
    }
    
    async writeImportLog(zipFileName: string) {
        const now = new Date();
        let prefix = this.formatTimestamp(now.getTime() / 1000, 'YYYY-MM-DD');

        if (this.settings.addDatePrefix) {
            prefix = this.formatTimestamp(now.getTime() / 1000, this.settings.dateFormat === 'YYYY-MM-DD' ? 'YYYY-MM-DD' : 'YYYYMMDD');
        }

        let logFileName = `${prefix} - ChatGPT Import log.md`;

        const logFolderPath = `${this.settings.archiveFolder}/logs`;
        
        const folderResult = await this.ensureFolderExists(logFolderPath);
        if (!folderResult.success) {
            console.error(`Failed to create or access log folder: ${logFolderPath}. Error: ${folderResult.error}`);
            new Notice("Failed to create log file. Check console for details.");
            return;
        }

        let logFilePath = `${logFolderPath}/${logFileName}`;

        let counter = 1;
        while (await this.app.vault.adapter.exists(logFilePath)) {
            logFileName = `${prefix}-${counter} - ChatGPT Import log.md`;
            logFilePath = `${logFolderPath}/${logFileName}`;
            counter++;
        }

        const currentDate = `${this.formatTimestamp(now.getTime() / 1000, 'date')} ${this.formatTimestamp(now.getTime() / 1000, 'time')}`;

        const logContent = `---
importdate: ${currentDate}
zipFile: ${zipFileName}
totalSuccessfulImports: ${this.importLog.successfulImports}
totalFailedImports: ${this.importLog.failedImports}
totalExistingConversations: ${this.totalExistingConversations}
newConversationsImported: ${this.totalNewConversationsSuccessfullyImported}
conversationsUpdated: ${this.totalConversationsActuallyUpdated}
totalNonEmptyMessagesImported: ${this.totalNonEmptyMessagesToImport}
totalNonEmptyMessagesAddedToExisting: ${this.totalNonEmptyMessagesToAdd}
---

# ChatGPT Import Log

Imported ZIP file: ${zipFileName}

## Statistics
- Total Successful Imports: ${this.importLog.successfulImports}
- Total Failed Imports: ${this.importLog.failedImports}
- Total Existing Conversations: ${this.totalExistingConversations}
- New Conversations Imported: ${this.totalNewConversationsSuccessfullyImported}
- Conversations Updated: ${this.totalConversationsActuallyUpdated}
- Total Non-Empty Messages Imported: ${this.totalNonEmptyMessagesToImport}
- Total Non-Empty Messages Added to Existing Conversations: ${this.totalNonEmptyMessagesToAdd}

## Detailed Log
${this.importLog.getDetailedLog()}
`;

        try {
            await this.writeToFile(logFilePath, logContent);
            console.log(`Import log created: ${logFilePath}`);
            new Notice(`Import log created: ${logFilePath}`);
        } catch (error) {
            console.error(`Failed to write import log: ${error.message}`);
            new Notice("Failed to create log file. Check console for details.");
        }
    }

    formatTitle(title) {
        let formattedTitle = title
            .replace(/[<>:"\/\\|?*\n\r]+/g, '_') // Replace invalid characters and newlines
            .replace(/\.{2,}/g, '.') // Replace multiple consecutive dots with a single dot
            .replace(/^\.+/, '') // Remove leading dots
            .replace(/\.+$/, '') // Remove trailing dots
            .trim(); // Trim whitespace from both ends
    
        return formattedTitle || "Untitled";
    }
    
    generateHeader(title, conversationId, createTimeStr, updateTimeStr) {
        return `---
aliases: ${title}
conversation_id: ${conversationId}
create_time: ${createTimeStr}
update_time: ${updateTimeStr}
---

# Topic: ${title}
Created: ${createTimeStr}
Last Updated: ${updateTimeStr}\n\n
`;
    }

    generateMessagesContent(chat) {
        let messagesContent = '';
        for (const messageId in chat.mapping) {
            const messageObj = chat.mapping[messageId];
            if (messageObj && messageObj.message && this.isValidMessage(messageObj.message)) {
                messagesContent += this.formatMessage(messageObj.message);
            }
        }
        return messagesContent;
    }
    
    isValidMessage(message) {
        return (
            message &&
            typeof message === 'object' &&
            message.content &&
            typeof message.content === 'object' &&
            Array.isArray(message.content.parts) &&
            message.content.parts.length > 0 &&
            message.content.parts.some(part => typeof part === 'string' && part.trim() !== "")
        );
}

    formatMessage(message) {
        if (!message || typeof message !== 'object') {
            console.error('Invalid message object:', message);
            return ''; // Return empty string for invalid messages
        }
    
        const messageTime = this.formatTimestamp(message.create_time || Date.now() / 1000, 'date') + ' at ' + this.formatTimestamp(message.create_time || Date.now() / 1000, 'time');
        
        let authorName = "Unknown";
        if (message.author && typeof message.author === 'object' && 'role' in message.author) {
            authorName = message.author.role === 'user' ? "User" : "ChatGPT";
        } else {
            console.warn('Author information missing or invalid:', message.author);
        }
    
        const headingLevel = authorName === "User" ? "###" : "####";
        const quoteChar = authorName === "User" ? ">" : ">>";
    
        let messageContent = `${headingLevel} ${authorName}, on ${messageTime};\n`;
        
        if (
            message.content &&
            typeof message.content === 'object' &&
            Array.isArray(message.content.parts) &&
            message.content.parts.length > 0
        ) {
            const messageText = message.content.parts
                .filter(part => typeof part === 'string')
                .join('\n');
            messageContent += messageText.split('\n').map(line => `${quoteChar} ${line}`).join('\n');
        } else {
            console.warn('Message content missing or invalid:', message.content);
            messageContent += `${quoteChar} [No content]`;
        }
    
        messageContent += `\n<!-- UID: ${message.id || 'unknown'} -->\n`;
    
        if (authorName === "ChatGPT") {
            messageContent += "\n---\n";
        }
        return messageContent + '\n\n';
    }

    async writeToFile(fileName: string, content: string) {
        try {
            let file = this.app.vault.getAbstractFileByPath(fileName);
            if (!file) {
                // File doesn't exist, create it
                await this.app.vault.create(fileName, content);
                console.log(`[chatgpt-import] Created new file: ${fileName}`);
            } else if (file instanceof TFile) {
                // File exists, update its content
                await this.app.vault.modify(file, content);
                console.log(`[chatgpt-import] Updated existing file: ${fileName}`);
            } else {
                console.error(`[chatgpt-import] Path exists but is not a file: ${fileName}`);
                throw new Error(`Path exists but is not a file: ${fileName}`);
            }
        } catch (e) {
            console.error(`[chatgpt-import] Error creating or modifying file '${fileName}':`, e);
            throw e; // Propagate the error
        }
    }

    formatTimestamp(unixTime: number, format: 'date' | 'time' | 'YYYY-MM-DD' | 'YYYYMMDD'): string {
        const date = new Date(unixTime * 1000);

        switch (format) {
            case 'date':
                return moment(date).format('L');
            case 'time':
                return moment(date).format('LT');
            case 'YYYY-MM-DD':
                return moment(date).format('YYYY-MM-DD');
            case 'YYYYMMDD':
                return moment(date).format('YYYYMMDD');
            default:
                return '';
        }
    }
        
    async getAllExistingConversations() {
        const files = this.app.vault.getMarkdownFiles();
        const conversations = {};
    
        for (const file of files) {
            const fileContent = await this.app.vault.read(file);
            const match = fileContent.match(/^---\s*conversation_id:\s*(.*?)\s*---/ms);
            if (match) {
                const conversationId = match[1].trim();
                conversations[conversationId] = file.path;
            }
        }
        return conversations;
    }

    extractMessageUIDsFromNote(noteContent) {
        const uidRegex = /<!-- UID: (.*?) -->/g;
        const uids = [];
        let match;
        while ((match = uidRegex.exec(noteContent)) !== null) {
            uids.push(match[1]);
        }
        return uids;
    }

    async resetCatalogs() {
        this.importedArchives = {};
        this.conversationRecords = {};
        await this.saveSettings();
        new Notice("All catalogs have been reset.");
        console.log("[chatgpt-import] All catalogs have been reset.");
    }

}

class ChatGPTImportPluginSettingTab extends PluginSettingTab {
    plugin: ChatGPTImportPlugin;

    constructor(app: App, plugin: ChatGPTImportPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        new Setting(containerEl)
            .setName('ChatGPT Archive Folder')
            .setDesc('Choose a folder to store ChatGPT archives')
            .addText(text => text
                .setPlaceholder('Enter folder name')
                .setValue(this.plugin.settings.archiveFolder)
                .onChange(async (value) => {
                    this.plugin.settings.archiveFolder = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Add Date Prefix to Filenames')
            .setDesc('Add creation date as a prefix to conversation filenames')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.addDatePrefix)
                .onChange(async (value) => {
                    this.plugin.settings.addDatePrefix = value;
                    await this.plugin.saveSettings();
                    // Refresh the display to show/hide the date format option
                    this.display();
                }));

        if (this.plugin.settings.addDatePrefix) {
            new Setting(containerEl)
                .setName('Date Format')
                .setDesc('Choose the format for the date prefix')
                .addDropdown(dropdown => dropdown
                    .addOption('YYYY-MM-DD', 'YYYY-MM-DD')
                    .addOption('YYYYMMDD', 'YYYYMMDD')
                    .setValue(this.plugin.settings.dateFormat)
                    .onChange(async (value: 'YYYY-MM-DD' | 'YYYYMMDD') => {
                        this.plugin.settings.dateFormat = value;
                        await this.plugin.saveSettings();
                    }));
        }
    }
}

class ImportLog {
    private logs: string[] = [];
    public successfulImports: number = 0;
    public failedImports: number = 0;
    public skippedImports: number = 0;
    public updatedImports: number = 0;

    addSuccess(chatTitle: string, filePath: string) {
        this.successfulImports++;
        this.logs.push(`✅ Successfully imported: [[${filePath}|${chatTitle}]]`);
    }
    
    addError(chatTitle: string, error: string) {
        this.failedImports++;
        this.logs.push(`❌ Error importing: ${chatTitle}\n   Error: ${error}`);
    }

    addSkipped(chatTitle: string, reason: string) {
        this.skippedImports++;
        this.logs.push(`⏭️ Skipped: ${chatTitle} (${reason})`);
    }

    addUpdated(chatTitle: string, filePath: string) {
        this.updatedImports++;
        this.logs.push(`🔄 Updated: [[${filePath}|${chatTitle}]]`);
    }

    addCreated(chatTitle: string, filePath: string) {
        this.successfulImports++;
        this.logs.push(`✨ Created: [[${filePath}|${chatTitle}]]`);
    }

    getDetailedLog(): string {
        return this.logs.join('\n');
    }
}
