import { Plugin, PluginSettingTab, Setting, TFile, TFolder, Modal, Notice, moment } from 'obsidian';
import JSZip from 'jszip';



export default class ChatGPTImportPlugin extends Plugin {
    settings: PluginSettings;

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
    totalSanitizedFilenames: number = 0; // Count of sanitized filenames for new conversation notes
    totalNewConversationsSuccessfullyImported: number = 0; // Count of new conversations successfully imported
    totalConversationsActuallyUpdated: number = 0; // Count of conversations actually updated after processing
    totalNonEmptyMessagesAdded: number = 0; // Count of non-empty messages actually added to conversations

    processedFiles: string[] = [];
    private importLog: ImportLog;

    
    async onload() {
        console.log('Loading ChatGPT Import Plugin');
        await this.loadSettings();
    
        this.addSettingTab(new ChatGPTImportPluginSettingTab(this.app, this));
    
        this.addRibbonIcon('message-square-plus', 'Import ChatGPT ZIP', (evt: MouseEvent) => {
            this.selectZipFile();
        });
    
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
            const file = e.target.files?.[0];
            if (file) {
                this.handleZipFile(file);
            }
        };
        // Reset the input value to allow selecting the same file again
        input.value = '';
        input.click();
    }

    async saveProcessedFiles() {
        await this.saveData({
            settings: this.settings,
            processedFiles: this.processedFiles
        });
    }

    async handleZipFile(file: File) {
        this.importLog = new ImportLog();
        try {
            const zip = new JSZip();
            const content = await zip.loadAsync(file);
            const fileNames = Object.keys(content.files);
    
            if (!fileNames.includes('conversations.json')) {
                throw new Error(`File 'conversations.json' not found in the zip: ${file.name}`);
            }
    
            const conversationsJson = await content.file('conversations.json').async('string');
            const chats = JSON.parse(conversationsJson);
            const newConversationIDs = await this.getNewConversationIDs(chats);
            const existingConversations = await this.getAllExistingConversations();
    
            this.totalNewConversationsToImport = newConversationIDs.length;
            this.totalExistingConversations = Object.keys(existingConversations).length;
        
            for (const chat of chats) {
                try {
                    const yearMonthFolder = this.getYearMonthFolder(chat.create_time);
                    const path = require('path');
                    const folderPath = path.join(this.settings.archiveFolder, yearMonthFolder);
                    await this.ensureFolderExists(folderPath);
    
                    if (newConversationIDs.includes(chat.id)) {
                        let nonEmptyMessageCount = 0;
                        for (const messageId in chat.mapping) {
                            const message = chat.mapping[messageId].message;
                            if (this.isValidMessage(message)) {
                                nonEmptyMessageCount++;
                            }
                        }
                        this.totalNonEmptyMessagesToImport += nonEmptyMessageCount;
                        await this.createMarkdown(chat, folderPath, existingConversations);
                        // La ligne this.importLog.addSuccess(chat.title); a été supprimée ici
                    }
                } catch (chatError) {
                    console.error(`[chatgpt-import] Error processing chat:`, chatError);
                    this.importLog.addError(chat.title || 'Untitled', chatError.message);
                }
            }
    
            const conversationsWithNewMessages = await this.getConversationsWithNewMessages(chats, existingConversations);
            this.totalExistingConversationsToUpdate = conversationsWithNewMessages.length;
    
            for (const [conversationId, newMessages] of Object.entries(conversationsWithNewMessages)) {
                let nonEmptyMessageToAddCount = 0;
                for (const message of newMessages) {
                    if (this.isValidMessage(message)) {
                        nonEmptyMessageToAddCount++;
                    }
                }
                this.totalNonEmptyMessagesToAdd += nonEmptyMessageToAddCount;
            }
    
            await this.appendMessagesToNotes(conversationsWithNewMessages, chats, existingConversations);
    
            await this.writeImportLog(file.name);
            new Notice(`Import completed. Log file created in the archive folder.`);
    
        } catch (error) {
            console.error("[chatgpt-import] Error handling zip file:", error);
            this.importLog.addError('Zip File Processing', error.message);
            await this.writeImportLog(file.name);
            new Notice("An error occurred while processing the ZIP file. Please check the log file for details.");
        }
    }

    showError(message) {
        const errorMessage = `obsidian-chatgpt-import\n\n${message}\n\nPlease try selecting a file again.`;
        new Notice(errorMessage, 10000);  // Show for 10 seconds
        console.error(errorMessage);
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

    async ensureFolderExists(folderPath: string) {
        console.log(`[chatgpt-import] Checking for folder: ${folderPath}`);
        try {
            const folder = this.app.vault.getAbstractFileByPath(folderPath);
            if (!folder) {
                console.log(`[chatgpt-import] Creating folder: ${folderPath}`);
                await this.app.vault.createFolder(folderPath);
            } else if (!(folder instanceof TFolder)) {
                console.error(`[chatgpt-import] Path exists but is not a folder: ${folderPath}`);
                throw new Error(`Path exists but is not a folder: ${folderPath}`);
            } else {
                console.log(`[chatgpt-import] Folder already exists: ${folderPath}`);
            }
        } catch (e) {
            console.error(`[chatgpt-import] Error handling folder '${folderPath}':`, e);
            throw e; // Propagate the error
        }
    }

    getYearMonthFolder(unixTime) {
        const date = new Date(unixTime * 1000);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0'); // JavaScript months are 0-indexed
        return `${year}/${month}`;
    }

    async getUniqueFileName(title, folderPath, existingConversations) {
        let counter = 1;
        let formattedTitle = this.formatTitle(title);
        let potentialFileName = `${formattedTitle}.md`;
    
        // Check if a file with this title already exists
        for (const existingFile of Object.values(existingConversations)) {
            if (existingFile.includes(folderPath) && existingFile.endsWith(potentialFileName)) {
                // If exists, append a counter to the title
                potentialFileName = `${formattedTitle}-${counter}.md`;
                counter++;
            }
        }
        return `${potentialFileName}`;
    }

    async createMarkdown(chat, folderPath, existingConversations) {
        try {
            const title = this.formatTitle(chat.title);
            // const create_time_str = this.formatTimestamp(chat.create_time, true);
            // const update_time_str = this.formatTimestamp(chat.update_time, true);
            const create_time_str = `${this.formatTimestamp(chat.create_time, 'date')} at ${this.formatTimestamp(chat.create_time, 'time')}`;
            const update_time_str = `${this.formatTimestamp(chat.update_time, 'date')} at ${this.formatTimestamp(chat.update_time, 'time')}`;

            let content = this.generateHeader(title, chat.id, create_time_str, update_time_str);
    
            content += this.generateMessagesContent(chat);
    
            let fileName = await this.getUniqueFileName(chat.title, folderPath, existingConversations);

            console.log(`[chatgpt-import] Current addDatePrefix value: ${this.settings.addDatePrefix}`);

            if (this.settings.addDatePrefix) {
                const createTimeStr = this.formatTimestamp(chat.create_time, this.settings.dateFormat === 'YYYY-MM-DD' ? 'YYYY-MM-DD' : 'YYYYMMDD');
                fileName = `${folderPath}/${createTimeStr} - ${fileName}`;
            }
            else {
                fileName = `${folderPath}/${fileName}`;
            }
            
            console.log(`[chatgpt-import] Creating note with file name: ${fileName}`);
            await this.writeToFile(fileName, content);
            this.importLog.addSuccess(chat.title, fileName);
            this.totalNewConversationsSuccessfullyImported++;
        } catch (error) {
            console.error(`[chatgpt-import] Error creating markdown for chat ${chat.id}:`, error);
            this.importLog.addError(chat.title, error.message);
        }        
    }

    async writeImportLog(zipFileName: string) {
        const now = new Date();
        let prefix = this.formatTimestamp(now.getTime() / 1000, 'YYYY-MM-DD');
    
        if (this.settings.addDatePrefix) {
            prefix = this.formatTimestamp(now.getTime() / 1000, this.settings.dateFormat === 'YYYY-MM-DD' ? 'YYYY-MM-DD' : 'YYYYMMDD');
        }
    
        let logFileName = `${prefix} - ChatGPT Import log.md`;
    
        // Utiliser la méthode join de l'API Obsidian pour créer le chemin du dossier de logs
        const logFolderPath = `${this.settings.archiveFolder}/logs`;
        
        // Créer le dossier de logs s'il n'existe pas
        await this.ensureFolderExists(logFolderPath);
    
        let logFilePath = `${logFolderPath}/${logFileName}`;
    
        // Vérifie si le fichier existe déjà, et ajoute un suffixe numérique si c'est le cas
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
${this.importLog.getDetailedLog()}s
        `;
    
        await this.writeToFile(logFilePath, logContent);
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
            const message = chat.mapping[messageId].message;
            if (this.isValidMessage(message)) {
                messagesContent += this.formatMessage(message);
            }
        }
        return messagesContent;
    }

    isValidMessage(message) {
        if (
            message &&
            message.content &&
            message.content.parts &&
            message.content.parts.length > 0
        ) {
            let messageText = message.content.parts[0] + ""; // Convert to string explicitly
            if (!messageText.trim()) {
                return false; // Message is invalid (empty or whitespace-only)
            }
            return true; // Message is valid
        }
        return false; // Message is invalid
    }

    formatMessage(message) {
        // const messageTime = this.formatTimestamp(message.create_time, true);
        const authorName = message.author.role === 'user' ? "User" : "ChatGPT";
        const headingLevel = authorName === "User" ? "###" : "####";
        const quoteChar = authorName === "User" ? ">" : ">>";

        let messageContent = `${headingLevel} ${authorName}, on ${this.formatTimestamp(message.create_time, 'date')} at ${this.formatTimestamp(message.create_time, 'time')};\n`;
        
        if (
            message.content &&
            message.content.parts &&
            message.content.parts.length > 0 &&
            typeof message.content.parts[0] === "string"
        ) {
            const messageText = message.content.parts[0];
            messageContent += messageText.split('\n').map(line => `${quoteChar} ${line}`).join('\n');
        }

        messageContent += `\n<!-- UID: ${message.id} -->\n`;

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
        
    async loadSettings() {
        const data = await this.loadData();
        this.settings = Object.assign({}, defaultSettings, data.settings);
        this.processedFiles = data.processedFiles || [];
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    async getNewConversationIDs(zipChats) {
        const existingConversations = await this.getAllExistingConversations();
        const newConversationIDs = [];
    
        for (const chat of zipChats) {
            if (!existingConversations.hasOwnProperty(chat.id)) {
                newConversationIDs.push(chat.id);
                this.totalNewConversationsToImport++; // Increment the counter for each new conversation
            }
        }
    
        return newConversationIDs;
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
    
    async getConversationsWithNewMessages(zipChats, existingConversations) {
        const conversationsWithNewMessages = [];
    
        for (const chat of zipChats) {
            const existingNotePath = existingConversations[chat.id];

            if (existingNotePath) {
                const existingNoteContent = await this.app.vault.read(existingNotePath);
                const existingMessageUIDs = this.extractMessageUIDsFromNote(existingNoteContent);
    
                const newMessageUIDs = chat.mapping.map(messageInfo => messageInfo.message.id);
                const hasNewMessages = newMessageUIDs.some(uid => !existingMessageUIDs.includes(uid));
    
                // Log the number of messages for debugging
                if (hasNewMessages) {
                    console.log(`[chatgpt-import] Conversation ID ${chat.id}: Existing messages count = ${existingMessageUIDs.length}, New messages count = ${newMessageUIDs.length}`);
                    conversationsWithNewMessages.push(chat.id);
                }
            }
        }
    
        return conversationsWithNewMessages;
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

    async appendMessagesToNotes(conversationsWithNewMessages, zipChats, existingConversations) {
        for (const conversationId of conversationsWithNewMessages) {
            const existingNotePath = existingConversations[conversationId];
            if (existingNotePath) {
                try {
                    const existingNoteContent = await this.app.vault.read(this.app.vault.getAbstractFileByPath(existingNotePath));
                    const chat = zipChats.find((chat) => chat.id === conversationId);
                    if (chat) {
                        // Extraire les métadonnées et le titre de la note existante
                        const metadataMatch = existingNoteContent.match(/^---\n([\s\S]*?)\n---\n(# .*\n)/);
                        const metadata = metadataMatch ? metadataMatch[1] : '';
                        const title = metadataMatch ? metadataMatch[2] : '';
    
                        // Générer le nouveau contenu de la conversation
                        const newContent = this.generateMessagesContent(chat);
    
                        // Combiner les métadonnées, le titre et le nouveau contenu
                        const updatedNoteContent = `---\n${metadata}\n---\n${title}\n${newContent}`;
    
                        // Vérifier si le contenu a réellement changé
                        if (existingNoteContent !== updatedNoteContent) {
                            // Écrire le contenu mis à jour dans le fichier
                            await this.writeToFile(existingNotePath, updatedNoteContent);
                            console.log(`[chatgpt-import] Updated note: ${existingNotePath}`);
                            this.totalConversationsActuallyUpdated++;
                        } else {
                            console.log(`[chatgpt-import] No changes needed for note: ${existingNotePath}`);
                        }
                    }
                } catch (error) {
                    console.error(`[chatgpt-import] Error updating note ${existingNotePath}:`, error);
                }
            }
        }
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

    addSuccess(chatTitle: string, filePath: string) {
        this.successfulImports++;
        this.logs.push(`✅ Successfully imported: [[${filePath}|${chatTitle}]]`);
    }
    
    addError(chatTitle: string, error: string) {
        this.failedImports++;
        this.logs.push(`❌ Error importing: ${chatTitle}\n   Error: ${error}`);
    }

    getDetailedLog(): string {
        // Joindre les logs sans ajouter de ligne vide supplémentaire
        return this.logs.join('\n');
    }
}

interface PluginSettings {
    archiveFolder: string;
    addDatePrefix: boolean;
    dateFormat: 'YYYY-MM-DD' | 'YYYYMMDD';
}

const defaultSettings: PluginSettings = {
    archiveFolder: '',
    addDatePrefix: false,
    dateFormat: 'YYYY-MM-DD'
}
