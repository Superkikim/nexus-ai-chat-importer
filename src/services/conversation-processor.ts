// src/services/conversation-processor.ts
import { TFile } from "obsidian";
import { Chat, ConversationCatalogEntry, ChatMessage, ChatMapping } from "../types";
import { ImportReport } from "../models/import-report";
import { MessageFormatter } from "../formatters/message-formatter";
import { NoteFormatter } from "../formatters/note-formatter";
import { FileService } from "./file-service";
import { 
    formatTimestamp, 
    formatTitle, 
    isValidMessage,
    generateFileName,
    ensureFolderExists,
    doesFilePathExist,
    generateUniqueFileName
} from "../utils";
import type NexusAiChatImporterPlugin from "../main";

export class ConversationProcessor {
    private messageFormatter: MessageFormatter;
    private fileService: FileService;
    private noteFormatter: NoteFormatter;
    private counters = {
        totalExistingConversations: 0,
        totalNewConversationsToImport: 0,
        totalExistingConversationsToUpdate: 0,
        totalNewConversationsSuccessfullyImported: 0,
        totalConversationsActuallyUpdated: 0,
        totalConversationsProcessed: 0,
        totalNonEmptyMessagesToImport: 0,
        totalNonEmptyMessagesToAdd: 0,
        totalNonEmptyMessagesAdded: 0,
    };

    constructor(private plugin: NexusAiChatImporterPlugin) {
        this.messageFormatter = new MessageFormatter(plugin.logger);
        this.fileService = new FileService(plugin);
        this.noteFormatter = new NoteFormatter(plugin.logger, plugin.manifest.id);
    }

    async processChats(chats: Chat[], importReport: ImportReport): Promise<ImportReport> {
        const storage = this.plugin.getStorageService();
        const existingConversations = storage.getConversationCatalog();
        this.counters.totalExistingConversations = Object.keys(existingConversations).length;

        for (const chat of chats) {
            await this.processSingleChat(chat, existingConversations, importReport);
        }

        return importReport;
    }

    private async processSingleChat(
        chat: Chat,
        existingConversations: Record<string, ConversationCatalogEntry>,
        importReport: ImportReport
    ): Promise<void> {
        try {
            if (existingConversations[chat.id]) {
                await this.handleExistingChat(chat, existingConversations[chat.id], importReport);
            } else {
                const filePath = await this.generateFilePath(chat);
                await this.handleNewChat(chat, filePath, existingConversations, importReport);
                this.updateConversationCatalogEntry(chat, filePath);
            }
            this.counters.totalConversationsProcessed++;
        } catch (error: any) {
            const errorMessage = error.message || "Unknown error occurred";
            importReport.addError(`Error processing chat: ${chat.title || "Untitled"}`, errorMessage);
        }
    }

    private async handleExistingChat(
        chat: Chat,
        existingRecord: ConversationCatalogEntry,
        importReport: ImportReport
    ): Promise<void> {
        const totalMessageCount = Object.values(chat.mapping)
            .filter(msg => isValidMessage(msg.message)).length;

        // Check if the file actually exists
        const fileExists = await this.plugin.app.vault.adapter.exists(existingRecord.path);
        
        if (!fileExists) {
            // File was deleted, recreate it
            this.plugin.logger.info(`File ${existingRecord.path} was deleted, recreating...`);
            await this.handleNewChat(chat, existingRecord.path, {}, importReport);
            return;
        }

        if (existingRecord.updateTime >= chat.update_time) {
            importReport.addSkipped(
                chat.title || "Untitled",
                existingRecord.path,
                formatTimestamp(chat.create_time, "date"),
                formatTimestamp(chat.update_time, "date"),
                totalMessageCount,
                "No Updates"
            );
        } else {
            this.counters.totalExistingConversationsToUpdate++;
            await this.updateExistingNote(chat, existingRecord.path, totalMessageCount, importReport);
        }
    }

    private async handleNewChat(
        chat: Chat,
        filePath: string,
        existingConversations: Record<string, ConversationCatalogEntry>,
        importReport: ImportReport
    ): Promise<void> {
        this.counters.totalNewConversationsToImport++;
        await this.createNewNote(chat, filePath, existingConversations, importReport);
    }

    private async updateExistingNote(
        chat: Chat,
        filePath: string,
        totalMessageCount: number,
        importReport: ImportReport
    ): Promise<void> {
        try {
            const file = this.plugin.app.vault.getAbstractFileByPath(filePath);
            if (file instanceof TFile) {
                let content = await this.plugin.app.vault.read(file);
                const originalContent = content;

                content = this.updateMetadata(content, chat.update_time);
                const existingMessageIds = this.extractMessageUIDsFromNote(content);
                const newMessages = this.getNewMessages(chat, existingMessageIds);
                console.log("New messages type check:", Array.isArray(newMessages), newMessages);

                if (newMessages.length > 0) {
                    content += "\n\n" + this.messageFormatter.formatMessages(newMessages);
                    this.counters.totalConversationsActuallyUpdated++;
                    this.counters.totalNonEmptyMessagesAdded += newMessages.length;
                }

                if (content !== originalContent) {
                    await this.fileService.writeToFile(filePath, content);
                    importReport.addUpdated(
                        chat.title || "Untitled",
                        filePath,
                        `${formatTimestamp(chat.create_time, "date")} ${formatTimestamp(chat.create_time, "time")}`,
                        `${formatTimestamp(chat.update_time, "date")} ${formatTimestamp(chat.update_time, "time")}`,
                        totalMessageCount
                    );
                } else {
                    importReport.addSkipped(
                        chat.title || "Untitled",
                        filePath,
                        `${formatTimestamp(chat.create_time, "date")} ${formatTimestamp(chat.create_time, "time")}`,
                        `${formatTimestamp(chat.update_time, "date")} ${formatTimestamp(chat.update_time, "time")}`,
                        totalMessageCount,
                        "No changes needed"
                    );
                }
            }
        } catch (error: any) {
            this.plugin.logger.error("Error updating note", error.message);
        }
    }

    private async createNewNote(
        chat: Chat,
        filePath: string,
        existingConversations: Record<string, ConversationCatalogEntry>,
        importReport: ImportReport
    ): Promise<void> {
        try {
            // Ensure the folder exists (in case it was deleted)
            const folderPath = filePath.substring(0, filePath.lastIndexOf('/'));
            const folderResult = await ensureFolderExists(folderPath, this.plugin.app.vault);
            if (!folderResult.success) {
                throw new Error(folderResult.error || "Failed to ensure folder exists.");
            }

            const content = this.noteFormatter.generateMarkdownContent(chat);
            await this.fileService.writeToFile(filePath, content);

            const messageCount = Object.values(chat.mapping)
                .filter(msg => isValidMessage(msg.message)).length;

            importReport.addCreated(
                chat.title || "Untitled",
                filePath,
                `${formatTimestamp(chat.create_time, "date")} ${formatTimestamp(chat.create_time, "time")}`,
                `${formatTimestamp(chat.update_time, "date")} ${formatTimestamp(chat.update_time, "time")}`,
                messageCount
            );
            
            this.counters.totalNewConversationsSuccessfullyImported++;
            this.counters.totalNonEmptyMessagesToImport += messageCount;

            existingConversations[chat.id] = {
                conversationId: chat.id,
                path: filePath,
                updateTime: chat.update_time,
                provider: "chatgpt",
                create_time: chat.create_time,
                update_time: chat.update_time
            };
        } catch (error: any) {
            this.plugin.logger.error("Error creating new note", error.message);
            importReport.addFailed(
                chat.title || "Untitled",
                filePath,
                formatTimestamp(chat.create_time, "date") + " " + formatTimestamp(chat.create_time, "time"),
                formatTimestamp(chat.update_time, "date") + " " + formatTimestamp(chat.update_time, "time"),
                error.message
            );
            throw error;
        }
    }

    private updateMetadata(content: string, updateTime: number): string {
        const updateTimeStr = `${formatTimestamp(updateTime, "date")} at ${formatTimestamp(updateTime, "time")}`;
        content = content.replace(/^update_time: .*$/m, `update_time: ${updateTimeStr}`);
        content = content.replace(/^Last Updated: .*$/m, `Last Updated: ${updateTimeStr}`);
        return content;
    }

    private getNewMessages(chat: Chat, existingMessageIds: string[]): ChatMessage[] {
        const newMessages: ChatMessage[] = [];
        
        for (const messageObj of Object.values(chat.mapping)) {
            if (messageObj?.id && 
                !existingMessageIds.includes(messageObj.id) && 
                messageObj.message &&
                isValidMessage(messageObj.message)) {
                newMessages.push(messageObj.message);
            }
        }
        
        return newMessages;
    }

    private extractMessageUIDsFromNote(content: string): string[] {
        const uidRegex = /<!-- UID: (.*?) -->/g;
        const uids = [];
        let match;
        while ((match = uidRegex.exec(content)) !== null) {
            uids.push(match[1]);
        }
        return uids;
    }

    private async generateFilePath(chat: Chat): Promise<string> {
        const date = new Date(chat.create_time * 1000);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const folderPath = `${this.plugin.settings.archiveFolder}/${year}/${month}`;
        
        const folderResult = await ensureFolderExists(folderPath, this.plugin.app.vault);
        if (!folderResult.success) {
            throw new Error(folderResult.error || "Failed to ensure folder exists.");
        }

        let fileName = generateFileName(chat.title) + ".md";

        if (this.plugin.settings.addDatePrefix) {
            const day = String(date.getDate()).padStart(2, "0");
            let prefix = "";
            if (this.plugin.settings.dateFormat === "YYYY-MM-DD") {
                prefix = `${year}-${month}-${day}`;
            } else if (this.plugin.settings.dateFormat === "YYYYMMDD") {
                prefix = `${year}${month}${day}`;
            }
            fileName = `${prefix} - ${fileName}`;
        }

        let filePath = `${folderPath}/${fileName}`;
        if (await doesFilePathExist(filePath, this.plugin.app.vault)) {
            filePath = await generateUniqueFileName(filePath, this.plugin.app.vault.adapter);
        }

        return filePath;
    }

    private updateConversationCatalogEntry(chat: Chat, filePath: string): void {
        const storage = this.plugin.getStorageService();
        storage.updateConversationCatalog(chat.id, {
            conversationId: chat.id,
            path: filePath,
            updateTime: chat.update_time,
            provider: "chatgpt",
            create_time: chat.create_time,
            update_time: chat.update_time
        });
    }

    getCounters() {
        return this.counters;
    }
}