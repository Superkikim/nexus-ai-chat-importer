/**
 * Nexus AI Chat Importer - Obsidian Plugin
 * Copyright (C) 2024 Akim Sissaoui
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */


// src/services/conversation-processor.ts
import { TFile } from "obsidian";
import { ConversationCatalogEntry } from "../types/plugin";
import { StandardConversation, StandardMessage } from "../types/standard";
import { ImportReport } from "../models/import-report";
import { MessageFormatter } from "../formatters/message-formatter";
import { NoteFormatter } from "../formatters/note-formatter";
import { FileService } from "./file-service";
import { ProviderRegistry } from "../providers/provider-adapter";
import { ImportProgressCallback } from "../ui/import-progress-modal";
import JSZip from "jszip";
import {
    isValidMessage,
    ensureFolderExists,
    doesFilePathExist,
    generateUniqueFileName,
    generateConversationFileName,
    compareTimestampsIgnoringSeconds
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
            this.messageFormatter = new MessageFormatter(plugin.logger, plugin);
            this.fileService = new FileService(plugin);
            this.noteFormatter = new NoteFormatter(plugin.logger, plugin.manifest.id, plugin.manifest.version, plugin);
            this.providerRegistry = providerRegistry;
    }

    /**
     * Process raw conversations (provider agnostic entry point)
     */
    async processRawConversations(rawConversations: any[], importReport: ImportReport, zip?: JSZip, isReprocess: boolean = false, forcedProvider?: string, progressCallback?: ImportProgressCallback): Promise<ImportReport> {
        // Use forced provider or detect from raw data structure
        const provider = forcedProvider || this.providerRegistry.detectProvider(rawConversations);

        if (provider === 'unknown') {
            const errorMsg = forcedProvider
                ? `Forced provider '${forcedProvider}' is not available or registered`
                : `Could not detect conversation provider from data structure`;
            importReport.addError("Unknown provider", errorMsg);
            return importReport;
        }

        return this.processConversationsWithProvider(provider, rawConversations, importReport, zip, isReprocess, progressCallback);
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
        isReprocess: boolean = false,
        progressCallback?: ImportProgressCallback
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

        let processedCount = 0;
        for (const chat of rawConversations) {
            await this.processSingleChat(adapter, chat, existingConversationsMap, importReport, zip, isReprocess);

            processedCount++;
            progressCallback?.({
                phase: 'processing',
                title: 'Processing conversations...',
                detail: `Processing conversation ${processedCount} of ${rawConversations.length}`,
                current: processedCount,
                total: rawConversations.length
            });
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
            const chatTitle = adapter.getTitle(chat) || 'Untitled';

            // Validate conversation has required fields
            if (!chatId || chatId.trim() === '') {
                logger.warn(`Skipping conversation with missing ID: ${chatTitle}`);
                importReport.addFailed(
                    chatTitle,
                    "N/A",
                    "N/A",
                    "N/A",
                    0,
                    "Missing conversation ID"
                );
                return;
            }

            const existingEntry = existingConversations.get(chatId);

            if (existingEntry) {
                this.plugin.logger.debug(`[processSingleChat] Found existing conversation: ${chatTitle} (${chatId}) at ${existingEntry.path}`);
                await this.handleExistingChat(adapter, chat, existingEntry, importReport, zip, isReprocess);
            } else {
                this.plugin.logger.debug(`[processSingleChat] New conversation: ${chatTitle} (${chatId})`);
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

        // Normal logic: Check timestamps (ignoring seconds for v1.2.0 → v1.3.0 compatibility)
        const comparison = compareTimestampsIgnoringSeconds(updateTime, existingRecord.updateTime);
        if (comparison <= 0) {
            // ZIP is older or same as vault (ignoring seconds) → Skip
            importReport.addSkipped(
                chatTitle,
                existingRecord.path,
                createTime,
                updateTime,
                totalMessageCount,
                "No Updates"
            );
        } else {
            // ZIP is newer than vault → Update
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

                const existingMessageIds = this.extractMessageUIDsFromNote(content);
                const newMessages = adapter.getNewMessages(chat, existingMessageIds);

                let attachmentStats: { total: number; found: number; missing: number; failed: number } | undefined = undefined;

                // REPROCESS LOGIC: If forced update, recreate the entire note with attachment support
                if (forceUpdate) {
                    // Convert entire chat to standard format with attachments
                    let standardConversation = await adapter.convertChat(chat);

                    // Process attachments if ZIP provided
                    if (zip && adapter.processMessageAttachments) {
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
                        chatCreateTime,
                        chatUpdateTime,
                        totalMessageCount,
                        attachmentStats
                    );

                    this.counters.totalConversationsActuallyUpdated++;
                    return;
                }

                // Unified update logic - use convertChat for consistency
                if (newMessages.length > 0) {
                    // Update metadata only when there are new messages
                    content = this.updateMetadata(content, chatUpdateTime);

                    // Convert full conversation to get consistent processing
                    let standardConversation = await adapter.convertChat(chat);

                    // Filter only new messages for formatting
                    const newStandardMessages = standardConversation.messages.filter(msg =>
                        newMessages.some(newMsg => newMsg.id === msg.id)
                    );

                    // Process attachments on new messages only
                    let processedNewMessages = newStandardMessages;
                    if (zip && adapter.processMessageAttachments) {
                        processedNewMessages = await adapter.processMessageAttachments(
                            newStandardMessages,
                            adapter.getId(chat),
                            zip
                        );
                    }

                    // Always calculate attachment stats (even if not processed)
                    attachmentStats = this.calculateAttachmentStats(processedNewMessages);

                    content += "\n\n" + this.messageFormatter.formatMessages(processedNewMessages);
                    this.counters.totalConversationsActuallyUpdated++;
                    this.counters.totalNonEmptyMessagesAdded += newMessages.length;
                }

                if (content !== originalContent) {
                    await this.fileService.writeToFile(filePath, content);

                    importReport.addUpdated(
                        chatTitle,
                        filePath,
                        chatCreateTime,
                        chatUpdateTime,
                        newMessages.length,
                        attachmentStats
                    );
                } else {
                    importReport.addSkipped(
                        chatTitle,
                        filePath,
                        chatCreateTime,
                        chatUpdateTime,
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

            // Process attachments if ZIP provided
            let attachmentStats = { total: 0, found: 0, missing: 0, failed: 0 };
            if (zip && adapter.processMessageAttachments) {
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
                createTime,
                updateTime,
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
                createTime,
                updateTime,
                error.message
            );
            throw error;
        }
    }



    private updateMetadata(content: string, updateTime: number): string {
        // Use ISO 8601 format for frontmatter (consistent with create_time)
        const updateTimeStr = new Date(updateTime * 1000).toISOString();
        content = content.replace(/^update_time: .*$/m, `update_time: ${updateTimeStr}`);

        // Note: "Last Updated" field is not used in current note format, but kept for backward compatibility
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

        // New structure: <conversationFolder>/<provider>/<year>/<month>/
        const folderPath = `${this.plugin.settings.conversationFolder}/${providerName}/${year}/${month}`;

        const folderResult = await ensureFolderExists(folderPath, this.plugin.app.vault);
        if (!folderResult.success) {
            throw new Error(folderResult.error || "Failed to ensure folder exists.");
        }

        let fileName = generateConversationFileName(
            chatTitle,
            createTime,
            this.plugin.settings.addDatePrefix,
            this.plugin.settings.dateFormat
        ) + ".md";

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
     * Reset counters for processing a new file
     */
    resetCounters() {
        this.counters = {
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