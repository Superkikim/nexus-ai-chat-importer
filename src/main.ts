// Imports
import { Plugin, PluginSettingTab, Setting, TFile, TFolder, Modal, Notice, moment } from 'obsidian';
import JSZip from 'jszip';
import { PluginSettings, ChatMessage, Chat, ConversationRecord } from './types';
import { formatTimestamp, getYearMonthFolder, formatTitle, isValidMessage } from './utils';

// Constants
const DEFAULT_SETTINGS: PluginSettings = {
    archiveFolder: 'Nexus Conversations',
    addDatePrefix: false,
    dateFormat: 'YYYY-MM-DD'
};

enum LogLevel {
    INFO,
    WARN,
    ERROR
}

class Logger {
    private logToConsole(level: LogLevel, message: string, details?: any) {
        const timestamp = new Date().toISOString();
        const logMethod = level === LogLevel.ERROR ? console.error : 
                          level === LogLevel.WARN ? console.warn : 
                          console.log;
        
        logMethod(`[${timestamp}] [Nexus AI Chat Importer] [${LogLevel[level]}] ${message}`, details);
    }

    info(message: string, details?: any) {
        this.logToConsole(LogLevel.INFO, message, details);
    }

    warn(message: string, details?: any) {
        this.logToConsole(LogLevel.WARN, message, details);
    }

    error(message: string, details?: any) {
        this.logToConsole(LogLevel.ERROR, message, details);
    }
}

export default class NexusAIChatImporterPlugin extends Plugin {
    // Properties
    settings: PluginSettings;
    private importReport: ImportReport;
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

    // Lifecycle methods
    async onload() {
        console.log('Loading Nexus AI Chat Importer Plugin');
        this.logger = new Logger();
        await this.loadSettings();

        this.addSettingTab(new NexusAIChatImporterPluginSettingTab(this.app, this));

        this.addRibbonIcon('message-square-plus', 'Import AI Chats', (evt: MouseEvent) => {
            this.startImportProcess();
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
            id: 'nexus-import-ai-chats',
            name: 'Import AI Chat Conversations',
            callback: () => {
                this.startImportProcess();
            }
        });

        this.addCommand({
            id: 'reset-nexus-ai-chat-importer-catalogs',
            name: 'Reset Nexus AI Chat Importer Catalogs',
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
        await this.saveData({
            settings: this.settings,
            importedArchives: this.importedArchives,
            conversationRecords: this.conversationRecords
        });
    }

    // Core functionality methods
    async startImportProcess() {
        try {
            const file = await this.selectExportFile();
            if (file) {
                await this.handleExportFile(file);
            }
        } catch (error) {
            this.logError("Import process failed", error.message);
            new Notice("Import process failed. Check the console for details.");
        }
    }

    async handleExportFile(file: File) {
        this.importReport = new ImportReport();
        try {
            const fileHash = await this.getFileHash(file);
            if (this.importedArchives[fileHash]) {
                const shouldReimport = await this.showConfirmationDialog(
                    `This archive (${file.name}) has already been imported on ${this.importedArchives[fileHash].date}. Do you want to process it again?`
                );
                if (!shouldReimport) {
                    this.logInfo("Import cancelled by user", { fileName: file.name });
                    new Notice("Import cancelled.");
                    return;
                }
            }
    
            const zip = await this.validateExportFile(file);
            await this.processConversations(zip, file);
    
            this.importedArchives[fileHash] = {
                fileName: file.name,
                date: new Date().toISOString()
            };
            await this.saveSettings();
            
            this.logInfo("Import completed successfully", { fileName: file.name });
        } catch (error) {
            this.logError("Error handling zip file", error.message);
        } finally {
            await this.writeImportReport(file.name);
            new Notice(this.importReport.hasErrors() 
                ? "An error occurred during import. Please check the log file for details."
                : "Import completed. Log file created in the archive folder.");
        }
    }

    async processConversations(zip: JSZip, file: File): Promise<void> {
        try {
            const chats = await this.extractChatsFromZip(zip);
            this.logInfo(`Extracted ${chats.length} chats from zip file`, { fileName: file.name });
            const existingConversations = await this.getAllExistingConversations();

            // troubles
            console.log(`[processConversations] Total existing conversations found:`, Object.keys(existingConversations).length);
            console.log(`[processConversations] Existing conversation IDs:`, Object.keys(existingConversations));
                
            this.initializeCounters(existingConversations);
    
            for (const chat of chats) {
                await this.processSingleChat(chat, existingConversations);
            }

            this.updateImportReport(file.name);

            this.logInfo(`Processed ${chats.length} conversations`, {
                new: this.totalNewConversationsSuccessfullyImported,
                updated: this.totalConversationsActuallyUpdated,
                skipped: this.totalExistingConversations - this.totalConversationsActuallyUpdated
            });
    
        } catch (error) {
            this.logError("Error processing conversations", error.message);
        }
    }
    async updateExistingNote(chat: Chat, filePath: string, totalMessageCount: number): Promise<void> {
        try {
            const file = this.app.vault.getAbstractFileByPath(filePath);
            if (file instanceof TFile) {
                let content = await this.app.vault.read(file);
                let originalContent = content;
                
                content = this.updateMetadata(content, chat.update_time);
                
                const existingMessageIds = this.extractMessageUIDsFromNote(content);
                const newMessages = this.getNewMessages(chat, existingMessageIds);
                
                if (newMessages.length > 0) {
                    content += '\n\n' + this.formatNewMessages(newMessages);
                    this.totalConversationsActuallyUpdated++;
                    this.totalNonEmptyMessagesAdded += newMessages.length;
                }

                if (content !== originalContent) {
                    await this.writeToFile(filePath, content);
                    this.importReport.addUpdated(
                        chat.title || 'Untitled',
                        filePath,
                        `${formatTimestamp(chat.create_time, 'date')} ${formatTimestamp(chat.create_time, 'time')}`,
                        `${formatTimestamp(chat.update_time, 'date')} ${formatTimestamp(chat.update_time, 'time')}`,
                        totalMessageCount
                    );
                } else {
                    console.log(`[Nexus AI Chat Importer] No changes needed for existing file: ${filePath}`);
                    this.importReport.addSkipped(
                        chat.title || 'Untitled',
                        filePath,
                        `${formatTimestamp(chat.create_time, 'date')} ${formatTimestamp(chat.create_time, 'time')}`,
                        `${formatTimestamp(chat.update_time, 'date')} ${formatTimestamp(chat.update_time, 'time')}`,
                        totalMessageCount,
                        "No changes needed"
                    );
                }
            }
        } catch (error) {
            // Error handling (unchanged)
        }
    }
    async createNewNote(chat: Chat, filePath: string, existingConversations: Record<string, string>): Promise<void> {
        try {
            const content = this.generateMarkdownContent(chat);
            await this.writeToFile(filePath, content);
            
            const messageCount = Object.values(chat.mapping)
                .filter(msg => isValidMessage(msg.message))
                .length;
    
            this.importReport.addCreated(
                chat.title || 'Untitled',
                filePath,
                `${formatTimestamp(chat.create_time, 'date')} ${formatTimestamp(chat.create_time, 'time')}`,
                `${formatTimestamp(chat.update_time, 'date')} ${formatTimestamp(chat.update_time, 'time')}`,
                messageCount
            );
            this.totalNewConversationsSuccessfullyImported++;
            this.totalNonEmptyMessagesToImport += messageCount;
            
            // Add the new conversation to existingConversations
            existingConversations[chat.id] = filePath;
        } catch (error) {
            this.logError("Error creating new note", error.message);
            this.importReport.addFailed(chat.title || 'Untitled', filePath, 
                formatTimestamp(chat.create_time, 'date') + ' ' + formatTimestamp(chat.create_time, 'time'),
                formatTimestamp(chat.update_time, 'date') + ' ' + formatTimestamp(chat.update_time, 'time'),
                error.message
            );
            throw error;
        }
    }

    // Helper methods
    private async extractChatsFromZip(zip: JSZip): Promise<Chat[]> {
        const conversationsJson = await zip.file('conversations.json').async('string');
        return JSON.parse(conversationsJson);
    }

    private initializeCounters(existingConversations: Record<string, string>): void {
        this.totalExistingConversations = Object.keys(existingConversations).length;
        this.totalNewConversationsToImport = 0;
        this.totalExistingConversationsToUpdate = 0;
        this.totalNewConversationsSuccessfullyImported = 0;
        this.totalConversationsActuallyUpdated = 0;
        this.totalNonEmptyMessagesToImport = 0;
        this.totalNonEmptyMessagesToAdd = 0;
        this.totalNonEmptyMessagesAdded = 0;
    }

    private async processSingleChat(chat: Chat, existingConversations: Record<string, string>): Promise<void> {
        // Troubles
        console.log(`[processSingleChat] Starting to process chat: ${chat.id}`);
        try {
            const folderPath = await this.createFolderForChat(chat);
            // Troubles
            console.log(`[processSingleChat] Folder path processed: ${folderPath}`);

            // Troubles
            console.log(`[processSingleChat] Current chat ID:`, chat.id);
            console.log(`[processSingleChat] Exists in record:`, Boolean(existingConversations[chat.id]));
            console.log(`[processSingleChat] existingConversations keys count:`, Object.keys(existingConversations).length);
            if (existingConversations[chat.id]) {
                // Troubles
                console.log(`[processSingleChat] Existing conversation found for chat ${chat.id}`);
                console.log(`[processSingleChat] Existing path: ${existingConversations[chat.id]}`);
                await this.handleExistingChat(chat, {path: existingConversations[chat.id], updateTime: 0}, folderPath);
            } else {
                // Troubles
                console.log(`[processSingleChat] No existing conversation found for chat ${chat.id}`);
                const uniqueFileName = await this.getUniqueFileName(chat, folderPath, existingConversations);
                // Troubles
                console.log(`[processSingleChat] Unique file name generated: ${uniqueFileName}`);
                const filePath = `${folderPath}/${uniqueFileName}`;
                await this.handleNewChat(chat, filePath, existingConversations);
            }
    
            this.updateConversationRecord(chat, folderPath);
            // Troubles
            console.log(`[processSingleChat] Conversation record updated for chat ${chat.id}`);
        } catch (chatError) {
            console.error(`[processSingleChat] Error processing chat: ${chat.id}`, chatError);
            this.logError(`Error processing chat: ${chat.title || 'Untitled'}`, chatError.message);
        }
        // Troubles
        console.log(`[processSingleChat] Finished processing chat: ${chat.id}`);
    }

    private async createFolderForChat(chat: Chat): Promise<string> {
        const yearMonthFolder = getYearMonthFolder(chat.create_time);
        const folderPath = `${this.settings.archiveFolder}/${yearMonthFolder}`;
        const folderResult = await this.ensureFolderExists(folderPath);
        
        if (!folderResult.success) {
            throw new Error(`Failed to create or access folder: ${folderPath}. ${folderResult.error}`);
        }
    
        return folderPath;
    }

    private async handleExistingChat(chat: Chat, existingRecord: ConversationRecord, folderPath: string): Promise<void> {
        const totalMessageCount = Object.values(chat.mapping).filter(msg => isValidMessage(msg.message)).length;

        if (existingRecord.updateTime >= chat.update_time) {
            this.importReport.addSkipped(
                chat.title || 'Untitled',
                existingRecord.path, 
                formatTimestamp(chat.create_time, 'date'), 
                formatTimestamp(chat.update_time, 'date'),
                totalMessageCount,
                "No Updates"
            );
            console.log(`[Nexus AI Chat Importer] Skipped existing file (no updates): ${existingRecord.path}`);
        } else {
            this.totalExistingConversationsToUpdate++;
            await this.updateExistingNote(chat, existingRecord.path, totalMessageCount);
        }
    }

    private async handleNewChat(chat: Chat, folderPath: string, existingConversations: Record<string, string>): Promise<void> {
        this.totalNewConversationsToImport++;
        await this.createNewNote(chat, folderPath, existingConversations);
    }

    private updateConversationRecord(chat: Chat, folderPath: string): void {
        this.conversationRecords[chat.id] = {
            path: `${folderPath}/${this.getFileName(chat)}`,
            updateTime: chat.update_time
        };
    }

    private updateImportReport(zipFileName: string): void {
        this.importReport.addSummary(
            zipFileName,
            this.totalExistingConversations,
            this.totalNewConversationsSuccessfullyImported,
            this.totalConversationsActuallyUpdated,
            this.totalNonEmptyMessagesAdded
        );
    }

    updateMetadata(content: string, updateTime: number): string {
        const updateTimeStr = `${formatTimestamp(updateTime, 'date')} at ${formatTimestamp(updateTime, 'time')}`;
        
        // Update parameters
        content = content.replace(
            /^update_time: .*$/m,
            `update_time: ${updateTimeStr}`
        );
        
        // Update header
        content = content.replace(
            /^Last Updated: .*$/m,
            `Last Updated: ${updateTimeStr}`
        );
        
        return content;
    }

    getNewMessages(chat: Chat, existingMessageIds: string[]): ChatMessage[] {
        return Object.values(chat.mapping)
            .filter(message => 
                message && message.id && 
                !existingMessageIds.includes(message.id) &&
                isValidMessage(message.message)
            )
            .map(message => message.message);
    }

    formatNewMessages(messages: ChatMessage[]): string {
        return messages
            .filter(message => message !== undefined)
            .map(message => this.formatMessage(message))
            .filter(formattedMessage => formattedMessage !== '')
            .join('\n\n');
    }

    getFileName(chat: any): string {
        let fileName = formatTitle(chat.title);
        if (this.settings.addDatePrefix) {
            const createTimeStr = formatTimestamp(chat.create_time, 'prefix');
            fileName = `${createTimeStr} - ${fileName}`;
        }
        return `${fileName}.md`;
    }

    generateMarkdownContent(chat: any): string {
        const formattedTitle = formatTitle(chat.title);
        const create_time_str = `${formatTimestamp(chat.create_time, 'date')} at ${formatTimestamp(chat.create_time, 'time')}`;
        const update_time_str = `${formatTimestamp(chat.update_time, 'date')} at ${formatTimestamp(chat.update_time, 'time')}`;
    
        let content = this.generateHeader(formattedTitle, chat.id, create_time_str, update_time_str);
        content += this.generateMessagesContent(chat);
    
        return content;
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
                    if (error.message !== "Folder already exists.") {
                        this.logError(`Failed to create folder: ${currentPath}`, error.message);
                        return { success: false, error: `Failed to create folder: ${currentPath}. Reason: ${error.message}` };
                    }
                    // If folder already exists, continue silently
                }
            } else if (!(currentFolder instanceof TFolder)) {
                return { success: false, error: `Path exists but is not a folder: ${currentPath}` };
            }
        }
        return { success: true };
    }

    async getUniqueFileName(chat, folderPath, existingConversations) {
        let fileName = this.getFileName(chat);
        let counter = 1;
        let potentialFileName = fileName;
    
        while (Object.values(existingConversations).some(existingFile => 
            existingFile.includes(folderPath) && existingFile.endsWith(potentialFileName)
        )) {
            const nameWithoutExtension = fileName.slice(0, -3); // remove .md
            potentialFileName = `${nameWithoutExtension} (${counter}).md`;
            counter++;
        }
    
        return potentialFileName;
    }

    generateHeader(title, conversationId, createTimeStr, updateTimeStr) {
        return `---
aliases: "${title}"
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
            if (messageObj && messageObj.message && isValidMessage(messageObj.message)) {
                messagesContent += this.formatMessage(messageObj.message);
            }
        }
        return messagesContent;
    }

    formatMessage(message: ChatMessage): string {
        if (!message || typeof message !== 'object') {
            console.error('Invalid message object:', message);
            return ''; // Return empty string for invalid messages
        }
    
        const messageTime = formatTimestamp(message.create_time || Date.now() / 1000, 'date') + ' at ' + formatTimestamp(message.create_time || Date.now() / 1000, 'time');
        
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

    async writeToFile(fileName: string, content: string): Promise<void> {
        try {
            const file = this.app.vault.getAbstractFileByPath(fileName);
            if (file instanceof TFile) {
                await this.app.vault.modify(file, content);
                console.log(`[Nexus AI Chat Importer] Updated existing file: ${fileName}`);
            } else {
                await this.app.vault.create(fileName, content);
                console.log(`[Nexus AI Chat Importer] Created new file: ${fileName}`);
            }
        } catch (error) {
            this.logError(`Error creating or modifying file '${fileName}'`, error.message);
            throw error; // Propagate the error
        }
    }

    async getAllExistingConversations(): Promise<Record<string, string>> {
        console.log("[getAllExistingConversations] Starting to gather existing conversations");
        const conversations = {};
        const archiveFolder = this.app.vault.getAbstractFileByPath(this.settings.archiveFolder);
        
        if (!(archiveFolder instanceof TFolder)) {
            console.log(`[getAllExistingConversations] Archive folder not found: ${this.settings.archiveFolder}`);
            return conversations;
        }
        
        console.log(`[getAllExistingConversations] Archive folder found: ${this.settings.archiveFolder}`);
        
        const files = this.app.vault.getMarkdownFiles()
            .filter(file => file.path.startsWith(this.settings.archiveFolder));
        
        console.log(`[getAllExistingConversations] Total markdown files in archive: ${files.length}`);
        
        for (const file of files) {
            const metadata = this.app.metadataCache.getFileCache(file)?.frontmatter;
            if (metadata && metadata.conversation_id) {
                const conversationId = metadata.conversation_id;
                conversations[conversationId] = file.path;
                console.log(`[getAllExistingConversations] Found conversation: ${conversationId} in file: ${file.path}`);
            } else {
                console.log(`[getAllExistingConversations] No conversation_id found in file: ${file.path}`);
            }
        }
        
        console.log(`[getAllExistingConversations] Total conversations found: ${Object.keys(conversations).length}`);
        return conversations;
    }
    
    extractMessageUIDsFromNote(content: string): string[] {
        const uidRegex = /<!-- UID: (.*?) -->/g;
        const uids = [];
        let match;
        while ((match = uidRegex.exec(content)) !== null) {
            uids.push(match[1]);
        }
        return uids;
    }

    async writeImportReport(zipFileName: string): Promise<void> {
        const now = new Date();
        let prefix = formatTimestamp(now.getTime() / 1000, 'prefix');

        let reportFileName = `${prefix} - Nexus AI Chat Importer Report.md`;
        const reportFolderPath = `${this.settings.archiveFolder}/Reports`;

        const folderResult = await this.ensureFolderExists(reportFolderPath);
        if (!folderResult.success) {
            this.logError(`Failed to create or access report folder: ${reportFolderPath}`, folderResult.error);
            new Notice("Failed to create report. Check console for details.");
            return;
        }

        let reportFilePath = `${reportFolderPath}/${reportFileName}`;
    
        let counter = 1;
        while (await this.app.vault.adapter.exists(reportFilePath)) {
            reportFileName = `${prefix}-${counter} - Nexus AI Chat Importer Report.md`;
            reportFilePath = `${reportFolderPath}/${reportFileName}`;
            counter++;
        }

        const currentDate = `${formatTimestamp(now.getTime() / 1000, 'date')} ${formatTimestamp(now.getTime() / 1000, 'time')}`;

        const reportContent = `---
importdate: ${currentDate}
zipFile: ${zipFileName}
totalSuccessfulImports: ${this.importReport.created.length}
totalUpdatedImports: ${this.importReport.updated.length}
totalSkippedImports: ${this.importReport.skipped.length}
---

${this.importReport.generateLogContent()}
`;

        try {
            await this.writeToFile(reportFilePath, reportContent);
            console.log(`Import log created: ${reportFilePath}`);
        } catch (error) {
            this.logError(`Failed to write import log`, error.message);
            new Notice("Failed to create log file. Check console for details.");
        }
    }

    async resetCatalogs() {
        // Clear all internal data structures
        this.importedArchives = {};
        this.conversationRecords = {};
        this.totalExistingConversations = 0;
        this.totalNewConversationsToImport = 0;
        this.totalNonEmptyMessagesToImport = 0;
        this.totalNonEmptyMessagesToAdd = 0;
        this.totalExistingConversationsToUpdate = 0;
        this.totalNewConversationsSuccessfullyImported = 0;
        this.totalConversationsActuallyUpdated = 0;
        this.totalNonEmptyMessagesAdded = 0;
    
        // Reset settings to default
        this.settings = Object.assign({}, DEFAULT_SETTINGS);
    
        // Clear the data file
        await this.saveData({});
    
        // Optionally, you can also delete the data.json file completely
        // Be careful with this as it might require additional error handling
        try {
            await this.app.vault.adapter.remove(`${this.manifest.dir}/data.json`);
        } catch (error) {
            console.log("No data.json file to remove or error removing it:", error);
        }
    
        // Reload the plugin to ensure a fresh start
        await this.loadSettings();
    
        new Notice("All plugin data has been reset. You may need to restart Obsidian for changes to take full effect.");
        console.log("[Nexus AI Chat Importer] All plugin data has been reset.");
    }

    // Logging Methods
    private logError(message: string, details: string): void {
        this.logger.error(message, details);
        this.importReport.addError(message, details);
    }
    private logInfo(message: string, details?: any): void {
        this.logger.info(message, details);
    }
    private logWarn(message: string, details?: any): void {
        this.logger.warn(message, details);
    }

    // UI-related methods
    selectExportFile(): Promise<File | null> {
        return new Promise((resolve) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.zip,.json';
            input.onchange = (e: Event) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (file) {
                    if (file.name.endsWith('.zip') || file.name.endsWith('.json')) {
                        resolve(file);
                    } else {
                        new Notice("Please select a .zip or .json file.");
                        resolve(null);
                    }
                } else {
                    resolve(null);
                }
            };
            // Reset the input value to allow selecting the same file again
            input.value = '';
            input.click();
        });
    }

    async validateExportFile(file: File): Promise<JSZip> {
        try {
            const zip = new JSZip();
            const content = await zip.loadAsync(file);
            const fileNames = Object.keys(content.files);
    
            if (!fileNames.includes('conversations.json')) {
                throw new NexusAIChatImporterError("Invalid ZIP structure", "File 'conversations.json' not found in the zip");
            }
    
            return zip;
        } catch (error) {
            if (error instanceof NexusAIChatImporterError) {
                throw error;
            } else {
                throw new NexusAIChatImporterError("Error validating zip file", error.message);
            }
        }
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
        
}

class NexusAIChatImporterPluginSettingTab extends PluginSettingTab {
    // Settings tab implementation

    plugin: NexusAIChatImporterPlugin;

    constructor(app: App, plugin: NexusAIChatImporterPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        new Setting(containerEl)
            .setName('Nexus AI Chat Importer Conversations Folder')
            .setDesc('Choose a folder to store conversations')
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

class ImportReport {
    // Properties and methods
    private created: LogEntry[] = [];
    private updated: LogEntry[] = [];
    private skipped: LogEntry[] = [];
    private failed: LogEntry[] = [];
    private globalErrors: {message: string, details: string}[] = [];
    private summary: string = ''; 

    addCreated(title: string, filePath: string, createDate: string, updateDate: string, messageCount: number) {
        this.created.push({ title, filePath, createDate, updateDate, messageCount });
    }
    addUpdated(title: string, filePath: string, createDate: string, updateDate: string, messageCount: number) {
        this.updated.push({ title, filePath, createDate, updateDate, messageCount });
    }

    addSkipped(title: string, filePath: string, createDate: string, updateDate: string, messageCount: number, reason: string) {
        this.skipped.push({ title, filePath, createDate, updateDate, messageCount, reason });
    }

    addFailed(title: string, filePath: string, createDate: string, updateDate: string, errorMessage: string) {
        this.failed.push({ title, filePath, createDate, updateDate, errorMessage });
    }

    addError(message: string, details: string) {
        this.globalErrors.push({ message, details });
    }

    addSummary(zipFileName: string, totalProcessed: number, totalCreated: number, totalUpdated: number, totalMessagesAdded: number) {
        this.summary = `
## Summary
- Processed ZIP file: ${zipFileName}
- ${totalCreated > 0 ? `[[#Created notes]]` : 'Created notes'}: ${totalCreated} out of ${totalProcessed} conversations
- ${totalUpdated > 0 ? `[[#Updated notes]]` : 'Updated notes'}: ${totalUpdated} with a total of ${totalMessagesAdded} new messages
- ${this.skipped.length > 0 ? `[[#Skipped notes]]` : 'Skipped notes'}: ${this.skipped.length} out of ${totalProcessed} conversations
- ${this.failed.length > 0 ? `[[#Failed imports]]` : 'Failed imports'}: ${this.failed.length}
- ${this.globalErrors.length > 0 ? `[[#global-errors|Global Errors]]` : 'Global Errors'}: ${this.globalErrors.length}
`;
    }

    generateLogContent(): string {
        let content = '# Nexus AI Chat Importer Report\n\n';

        if (this.summary) {
            content += this.summary + '\n\n';
        }

        content += '## Legend\n';
        content += '✨ Created | 🔄 Updated | ⏭️ Skipped | 🚫 Failed | ⚠️ Global Errors\n\n';

        if (this.created.length > 0) {
            content += this.generateTable('Created Notes', this.created, '✨', ['Title', 'Created', 'Updated', 'Messages']);
        }
        if (this.updated.length > 0) {
            content += this.generateTable('Updated Notes', this.updated, '🔄', ['Title', 'Created', 'Updated', 'Added Messages']);
        }
        if (this.skipped.length > 0) {
            content += this.generateTable('Skipped Notes', this.skipped, '⏭️', ['Title', 'Created', 'Updated', 'Messages']);
        }
        if (this.failed.length > 0) {
            content += this.generateTable('Failed Imports', this.failed, '🚫', ['Title', 'Created', 'Updated', 'Error']);
        }
        if (this.globalErrors.length > 0) {
            content += this.generateErrorTable('Global Errors', this.globalErrors, '⚠️');
        }

        return content;
    }

    private generateTable(title: string, entries: LogEntry[], emoji: string, headers: string[]): string {
        let table = `## ${title}\n\n`;
        table += '| ' + headers.join(' | ') + ' |\n';
        table += '|:---:'.repeat(headers.length) + '|\n';
        entries.forEach(entry => {
            const sanitizedTitle = entry.title.replace(/\n/g, ' ').trim();
            const row = headers.map(header => {
                switch(header) {
                    case 'Title':
                        return `[[${entry.filePath}\\|${sanitizedTitle}]]`;
                    case 'Created':
                        return entry.createDate || '-';
                    case 'Updated':
                        return entry.updateDate || '-';
                    case 'Messages':
                        return entry.messageCount?.toString() || '-';
                    case 'Reason':
                        return entry.reason || '-';
                    default:
                        return '-';
                }
            });
            table += `| ${emoji} | ${row.join(' | ')} |\n`;
        });
        return table + '\n\n';
    }
    

    private generateErrorTable(title: string, entries: {message: string, details: string}[], emoji: string): string {
        let table = `## ${title}\n\n`;
        table += '| | Error | Details |\n';
        table += '|---|:---|:---|\n';
        entries.forEach(entry => {
            table += `| ${emoji} | ${entry.message} | ${entry.details} |\n`;
        });
        return table + '\n\n';
    }

    hasErrors(): boolean {
        return this.failed.length > 0 || this.globalErrors.length > 0;
    }
}

class NexusAIChatImporterError extends Error {
    // Implementation
    constructor(message: string, public details?: any) {
        super(message);
        this.name = 'NexusAIChatImporterError';
    }
}
