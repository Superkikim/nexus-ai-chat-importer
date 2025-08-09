// src/services/conversation-processor.ts
import { TFile } from "obsidian";
import { ConversationCatalogEntry } from "../types/plugin";
import { StandardConversation, StandardMessage } from "../types/standard";
import { ImportReport } from "../models/import-report";
import { MessageFormatter } from "../formatters/message-formatter";
import { NoteFormatter } from "../formatters/note-formatter";
import { FileService } from "./file-service";
import { ProviderRegistry } from "../providers/provider-adapter";
import JSZip from "jszip";
import {
    formatTimestamp,
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
    private providerRegistry: ProviderRegistry;
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

    constructor(private plugin: NexusAiChatImporterPlugin, providerRegistry: ProviderRegistry) {
            this.messageFormatter = new MessageFormatter(plugin.logger);
            this.fileService = new FileService(plugin);
            this.noteFormatter = new NoteFormatter(plugin.logger, plugin.manifest.id, plugin.manifest.version);
            this.providerRegistry = providerRegistry;
    }

    /**
     * Process raw conversations (provider agnostic entry point)
     */
    async processRawConversations(rawConversations: any[], importReport: ImportReport, zip?: JSZip, isReprocess: boolean = false): Promise<ImportReport> {
        // Detect provider from raw data structure
        const provider = this.providerRegistry.detectProvider(rawConversations);

        if (provider === 'unknown') {
            importReport.addError("Unknown provider", `Could not detect conversation provider from data structure`);
            return importReport;
        }

        return this.processConversationsWithProvider(provider, rawConversations, importReport, zip, isReprocess);
    }

    /**
     * Get provider name for current processing session
     */
    getCurrentProvider(): string {
        return this.currentProvider || 'unknown';
    }

    private currentProvider: string = 'unknown';

    /**
     * Process conversations using the detected provider
     */
    private async processConversationsWithProvider(
        provider: string,
        rawConversations: any[],
        importReport: ImportReport,
        zip?: JSZip,
        isReprocess: boolean = false
    ): Promise<ImportReport> {
        this.currentProvider = provider;
        const adapter = this.providerRegistry.getAdapter(provider);

        if (!adapter) {
            importReport.addError("Provider adapter not found", `No adapter found for provider: ${provider}`);
            return importReport;
        }

        const storage = this.plugin.getStorageService();

        // Scan existing conversations from vault instead of loading catalog
        const existingConversationsMap = await storage.scanExistingConversations();
        this.counters.totalExistingConversations = existingConversationsMap.size;

        for (const chat of rawConversations) {
            await this.processSingleChat(adapter, chat, existingConversationsMap, importReport, zip, isReprocess);
        }

        return importReport;
    }

    private async processSingleChat(
        adapter: any,
        chat: any,
        existingConversations: Map<string, ConversationCatalogEntry>,
        importReport: ImportReport,
        zip?: JSZip,
        isReprocess: boolean = false
    ): Promise<void> {
        try {
            const chatId = adapter.getId(chat);
            const existingEntry = existingConversations.get(chatId);

            if (existingEntry) {
                await this.handleExistingChat(adapter, chat, existingEntry, importReport, zip, isReprocess);
            } else {
                const filePath = await this.generateFilePathForChat(adapter, chat);
                await this.handleNewChat(adapter, chat, filePath, importReport, zip);
            }
            this.counters.totalConversationsProcessed++;
        } catch (error: any) {
            const errorMessage = error.message || "Unknown error occurred";
            const chatTitle = adapter.getTitle(chat) || "Untitled";
            importReport.addError(`Error processing chat: ${chatTitle}`, errorMessage);
        }
    }

    private async handleExistingChat(
        adapter: any,
        chat: any,
        existingRecord: ConversationCatalogEntry,
        importReport: ImportReport,
        zip?: JSZip,
        isReprocess: boolean = false
    ): Promise<void> {
        const chatTitle = adapter.getTitle(chat);
        const createTime = adapter.getCreateTime(chat);
        const updateTime = adapter.getUpdateTime(chat);

        // Count messages using provider-specific logic
        const totalMessageCount = await this.countMessages(adapter, chat);

        // Check if the file actually exists
        const fileExists = await this.plugin.app.vault.adapter.exists(existingRecord.path);

        if (!fileExists) {
            // File was deleted, recreate it
            await this.handleNewChat(adapter, chat, existingRecord.path, importReport, zip);
            return;
        }

        // REPROCESS LOGIC: Force update if this is a reprocess operation
        if (isReprocess) {
            this.plugin.logger.info(`Reprocessing conversation: ${chatTitle}`);
            this.counters.totalExistingConversationsToUpdate++;
            await this.updateExistingNote(adapter, chat, existingRecord.path, totalMessageCount, importReport, zip, true); // Force update
            return;
        }

        // Normal logic: Check timestamps
        if (existingRecord.updateTime >= updateTime) {
            importReport.addSkipped(
                chatTitle,
                existingRecord.path,
                formatTimestamp(createTime, "date"),
                formatTimestamp(updateTime, "date"),
                totalMessageCount,
                "No Updates"
            );
        } else {
            this.counters.totalExistingConversationsToUpdate++;
            await this.updateExistingNote(adapter, chat, existingRecord.path, totalMessageCount, importReport, zip);
        }
    }

    private async handleNewChat(
        adapter: any,
        chat: any,
        filePath: string,
        importReport: ImportReport,
        zip?: JSZip
    ): Promise<void> {
        this.counters.totalNewConversationsToImport++;
        await this.createNewNote(adapter, chat, filePath, importReport, zip);
    }

    /**
     * Count messages in a chat using provider-specific logic
     */
    private async countMessages(adapter: any, chat: any): Promise<number> {
        // Try to get a standard conversation and count its messages
        try {
            const standardConversation = await adapter.convertChat(chat);
            return standardConversation.messages?.length || 0;
        } catch (error) {
            // Fallback: try common patterns
            if (chat.mapping) {
                // ChatGPT-style mapping
                return Object.values(chat.mapping)
                    .filter((msg: any) => isValidMessage(msg.message)).length;
            } else if (chat.messages) {
                // Direct messages array
                return Array.isArray(chat.messages) ? chat.messages.length : 0;
            }
            return 0;
        }
    }

    /**
     * Get provider-specific count (artifacts for Claude, attachments for ChatGPT)
     */
    private getProviderSpecificCount(adapter: any, chat: any): number {
        try {
            const strategy = adapter.getReportNamingStrategy();
            if (strategy && strategy.getProviderSpecificColumn) {
                const columnInfo = strategy.getProviderSpecificColumn();
                return columnInfo.getValue(adapter, chat);
            }
        } catch (error) {
            // Fallback to 0 if provider doesn't support specific counting
        }
        return 0;
    }

    private async updateExistingNote(
        adapter: any,
        chat: any,
        filePath: string,
        totalMessageCount: number,
        importReport: ImportReport,
        zip?: JSZip,
        forceUpdate: boolean = false
    ): Promise<void> {
        try {
            const file = this.plugin.app.vault.getAbstractFileByPath(filePath);
            if (file instanceof TFile) {
                let content = await this.plugin.app.vault.read(file);
                const originalContent = content;

                const chatUpdateTime = adapter.getUpdateTime(chat);
                const chatCreateTime = adapter.getCreateTime(chat);
                const chatTitle = adapter.getTitle(chat);

                content = this.updateMetadata(content, chatUpdateTime);
                const existingMessageIds = this.extractMessageUIDsFromNote(content);
                const newMessages = adapter.getNewMessages(chat, existingMessageIds);

                let attachmentStats: { total: number; found: number; missing: number; failed: number } | undefined = undefined;

                // REPROCESS LOGIC: If forced update, recreate the entire note with attachment support
                if (forceUpdate) {
                    // Convert entire chat to standard format with attachments
                    let standardConversation = await adapter.convertChat(chat);

                    // Process attachments if ZIP provided and settings enabled
                    if (zip && this.plugin.settings.importAttachments && adapter.processMessageAttachments) {
                        standardConversation.messages = await adapter.processMessageAttachments(
                            standardConversation.messages,
                            adapter.getId(chat),
                            zip
                        );

                        // Calculate attachment stats
                        attachmentStats = this.calculateAttachmentStats(standardConversation.messages);
                    }

                    // Regenerate entire content
                    const newContent = this.noteFormatter.generateMarkdownContent(standardConversation);
                    await this.fileService.writeToFile(filePath, newContent);

                    importReport.addUpdated(
                        chatTitle,
                        filePath,
                        `${formatTimestamp(chatCreateTime, "date")} ${formatTimestamp(chatCreateTime, "time")}`,
                        `${formatTimestamp(chatUpdateTime, "date")} ${formatTimestamp(chatUpdateTime, "time")}`,
                        totalMessageCount,
                        attachmentStats
                    );

                    this.counters.totalConversationsActuallyUpdated++;
                    return;
                }

                // Normal update logic (existing messages)
                if (newMessages.length > 0) {
                    // Convert messages to standard format
                    let standardMessages = await adapter.convertMessages(newMessages, adapter.getId(chat));

                    // Process attachments if ZIP provided and settings enabled
                    if (zip && this.plugin.settings.importAttachments && adapter.processMessageAttachments) {
                        standardMessages = await adapter.processMessageAttachments(
                            standardMessages,
                            adapter.getId(chat),
                            zip
                        );
                    }

                    // Always calculate attachment stats (even if not processed)
                    attachmentStats = this.calculateAttachmentStats(standardMessages);

                    content += "\n\n" + this.messageFormatter.formatMessages(standardMessages);
                    this.counters.totalConversationsActuallyUpdated++;
                    this.counters.totalNonEmptyMessagesAdded += newMessages.length;
                }

                if (content !== originalContent) {
                    await this.fileService.writeToFile(filePath, content);

                    importReport.addUpdated(
                        chatTitle,
                        filePath,
                        `${formatTimestamp(chatCreateTime, "date")} ${formatTimestamp(chatCreateTime, "time")}`,
                        `${formatTimestamp(chatUpdateTime, "date")} ${formatTimestamp(chatUpdateTime, "time")}`,
                        newMessages.length,
                        attachmentStats
                    );
                } else {
                    importReport.addSkipped(
                        chatTitle,
                        filePath,
                        `${formatTimestamp(chatCreateTime, "date")} ${formatTimestamp(chatCreateTime, "time")}`,
                        `${formatTimestamp(chatUpdateTime, "date")} ${formatTimestamp(chatUpdateTime, "time")}`,
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
        adapter: any,
        chat: any,
        filePath: string,
        importReport: ImportReport,
        zip?: JSZip
    ): Promise<void> {
        try {
            // Ensure the folder exists (in case it was deleted)
            const folderPath = filePath.substring(0, filePath.lastIndexOf('/'));
            const folderResult = await ensureFolderExists(folderPath, this.plugin.app.vault);
            if (!folderResult.success) {
                throw new Error(folderResult.error || "Failed to ensure folder exists.");
            }

            // Convert to standard format
            let standardConversation = await adapter.convertChat(chat);

            // Process attachments if ZIP provided and settings enabled
            let attachmentStats = { total: 0, found: 0, missing: 0, failed: 0 };
            if (zip && this.plugin.settings.importAttachments && adapter.processMessageAttachments) {
                standardConversation.messages = await adapter.processMessageAttachments(
                    standardConversation.messages,
                    adapter.getId(chat),
                    zip
                );

                // Calculate attachment stats
                attachmentStats = this.calculateAttachmentStats(standardConversation.messages);
            }

            const content = this.noteFormatter.generateMarkdownContent(standardConversation);

            await this.fileService.writeToFile(filePath, content);

            const messageCount = await this.countMessages(adapter, chat);
            const createTime = adapter.getCreateTime(chat);
            const updateTime = adapter.getUpdateTime(chat);
            const chatTitle = adapter.getTitle(chat);

            // Get provider-specific count (artifacts for Claude, attachments for ChatGPT)
            const providerSpecificCount = this.getProviderSpecificCount(adapter, chat);

            importReport.addCreated(
                chatTitle,
                filePath,
                `${formatTimestamp(createTime, "date")} ${formatTimestamp(createTime, "time")}`,
                `${formatTimestamp(updateTime, "date")} ${formatTimestamp(updateTime, "time")}`,
                messageCount,
                attachmentStats,
                providerSpecificCount
            );

            this.counters.totalNewConversationsSuccessfullyImported++;
            this.counters.totalNonEmptyMessagesToImport += messageCount;

        } catch (error: any) {
            this.plugin.logger.error("Error creating new note", error.message);
            const createTime = adapter.getCreateTime(chat);
            const updateTime = adapter.getUpdateTime(chat);
            const chatTitle = adapter.getTitle(chat);

            importReport.addFailed(
                chatTitle,
                filePath,
                formatTimestamp(createTime, "date") + " " + formatTimestamp(createTime, "time"),
                formatTimestamp(updateTime, "date") + " " + formatTimestamp(updateTime, "time"),
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



    private extractMessageUIDsFromNote(content: string): string[] {
        const uidRegex = /<!-- UID: (.*?) -->/g;
        const uids = [];
        let match;
        while ((match = uidRegex.exec(content)) !== null) {
            uids.push(match[1]);
        }
        return uids;
    }

    private async generateFilePathForChat(adapter: any, chat: any): Promise<string> {
        const createTime = adapter.getCreateTime(chat);
        const chatTitle = adapter.getTitle(chat);
        const providerName = adapter.getProviderName();

        const date = new Date(createTime * 1000);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");

        // New structure: <archiveFolder>/<provider>/<year>/<month>/
        const folderPath = `${this.plugin.settings.archiveFolder}/${providerName}/${year}/${month}`;

        const folderResult = await ensureFolderExists(folderPath, this.plugin.app.vault);
        if (!folderResult.success) {
            throw new Error(folderResult.error || "Failed to ensure folder exists.");
        }

        let fileName = generateFileName(chatTitle) + ".md";

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

    getCounters() {
        return this.counters;
    }

    /**
     * Calculate attachment statistics from processed messages
     */
    private calculateAttachmentStats(messages: StandardMessage[]): { total: number; found: number; missing: number; failed: number } {
        const stats = { total: 0, found: 0, missing: 0, failed: 0 };
        
        for (const message of messages) {
            if (message.attachments) {
                for (const attachment of message.attachments) {
                    stats.total++;
                    if (attachment.status?.found) {
                        stats.found++;
                    } else if (attachment.status?.reason === 'missing_from_export') {
                        stats.missing++;
                    } else if (attachment.status?.reason === 'extraction_failed') {
                        stats.failed++;
                    }
                }
            }
        }
        
        return stats;
    }
}