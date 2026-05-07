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
import {
    isValidMessage,
    ensureFolderExists,
    doesFilePathExist,
    generateUniqueFileName,
    generateConversationFileName,
    CONVERSATION_NOTE_FILENAME_MAX_BYTES,
    compareTimestampsIgnoringSeconds
} from "../utils";
import type NexusAiChatImporterPlugin from "../main";
import { ZipArchiveReader } from "../utils/zip-loader";

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
    async processRawConversations(
        rawConversations: any[],
        importReport: ImportReport,
        zip?: ZipArchiveReader,
        isReprocess: boolean = false,
        forcedProvider?: string,
        progressCallback?: ImportProgressCallback,
        existingConversationsMap?: Map<string, ConversationCatalogEntry>,
        reprocessConversationIds?: Set<string>
    ): Promise<ImportReport> {
        // Use forced provider or detect from raw data structure
        const provider = forcedProvider || this.providerRegistry.detectProvider(rawConversations);

        if (provider === 'unknown') {
            const errorMsg = forcedProvider
                ? `Forced provider '${forcedProvider}' is not available or registered`
                : `Could not detect conversation provider from data structure`;
            importReport.addError("Unknown provider", errorMsg);
            return importReport;
        }

        return this.processConversationsWithProvider(
            provider,
            rawConversations,
            importReport,
            zip,
            isReprocess,
            progressCallback,
            existingConversationsMap,
            reprocessConversationIds
        );
    }

    async processConversationStream(
        provider: string,
        generator: AsyncGenerator<any>,
        importReport: ImportReport,
        zip?: ZipArchiveReader,
        isReprocess: boolean = false,
        selectedIds?: Set<string>,
        progressCallback?: ImportProgressCallback,
        approxTotal?: number,
        existingConversationsMap?: Map<string, ConversationCatalogEntry>,
        reprocessConversationIds?: Set<string>
    ): Promise<ImportReport> {
        this.currentProvider = provider;
        const adapter = this.providerRegistry.getAdapter(provider);
        const processLogger = this.plugin.logger.child("Process");

        if (!adapter) {
            importReport.addError("Provider adapter not found", `No adapter found for provider: ${provider}`);
            return importReport;
        }

        let conversationsMap: Map<string, ConversationCatalogEntry>;
        if (existingConversationsMap) {
            conversationsMap = existingConversationsMap;
            processLogger.debug("Using preloaded existing conversations map", {
                provider,
                existingConversationCount: conversationsMap.size,
            });
        } else {
            const storage = this.plugin.getStorageService();
            const scanStartedAt = Date.now();
            processLogger.debug("Scan existing conversations started", {
                provider,
                selectedConversationCount: selectedIds?.size ?? null,
                approxTotal: approxTotal ?? null,
            });
            conversationsMap = await storage.scanExistingConversations();
            processLogger.debug("Scan existing conversations complete", {
                provider,
                existingConversationCount: conversationsMap.size,
                durationMs: Date.now() - scanStartedAt,
            });
        }
        this.counters.totalExistingConversations = conversationsMap.size;

        let processedCount = 0;
        let seenCount = 0;
        let yieldedCount = 0;

        for await (const chat of generator) {
            seenCount++;

            if (selectedIds && selectedIds.size > 0) {
                let chatId: string | undefined;
                try { chatId = adapter.getId(chat); } catch { chatId = undefined; }
                if (!chatId || !selectedIds.has(chatId)) {
                    continue;
                }
            }

            yieldedCount++;
            await this.processSingleChat(
                adapter,
                chat,
                conversationsMap,
                importReport,
                zip,
                isReprocess,
                reprocessConversationIds
            );

            processedCount++;
            progressCallback?.({
                phase: 'processing',
                title: 'Processing conversations...',
                detail: approxTotal
                    ? `Processing conversation ${processedCount} of ${approxTotal}`
                    : `Processing conversation ${processedCount}`,
                current: processedCount,
                total: approxTotal
            });
        }

        processLogger.debug("Streaming conversation processing loop complete", {
            provider,
            seenCount,
            yieldedCount,
            processedCount,
            approxTotal: approxTotal ?? null,
        });

        return importReport;
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
        zip?: ZipArchiveReader,
        isReprocess: boolean = false,
        progressCallback?: ImportProgressCallback,
        existingConversationsMap?: Map<string, ConversationCatalogEntry>,
        reprocessConversationIds?: Set<string>
    ): Promise<ImportReport> {
        this.currentProvider = provider;
        const adapter = this.providerRegistry.getAdapter(provider);
        const processLogger = this.plugin.logger.child("Process");

        if (!adapter) {
            importReport.addError("Provider adapter not found", `No adapter found for provider: ${provider}`);
            return importReport;
        }

        // Gemini-specific preprocessing: If adapter has index, convert all entries to grouped conversations
        let conversationsToProcess = rawConversations;
        if (provider === 'gemini' && (adapter as any).hasIndex?.()) {
            progressCallback?.({
                phase: 'processing',
                title: 'Grouping Gemini conversations...',
                detail: 'Using index to reconstruct full conversations'
            });

            // Convert all Takeout entries to grouped StandardConversations
            const groupedConversations = (adapter as any).convertAllWithIndex(rawConversations);
            conversationsToProcess = groupedConversations;

            this.plugin.logger.debug(`[Gemini] Grouped ${rawConversations.length} entries into ${groupedConversations.length} conversations`);
        }

        let conversationsMap: Map<string, ConversationCatalogEntry>;
        if (existingConversationsMap) {
            conversationsMap = existingConversationsMap;
            processLogger.debug("Using preloaded existing conversations map", {
                provider,
                existingConversationCount: conversationsMap.size,
            });
        } else {
            const storage = this.plugin.getStorageService();
            conversationsMap = await storage.scanExistingConversations();
        }
        this.counters.totalExistingConversations = conversationsMap.size;

        let processedCount = 0;
        for (const chat of conversationsToProcess) {
            await this.processSingleChat(
                adapter,
                chat,
                conversationsMap,
                importReport,
                zip,
                isReprocess,
                reprocessConversationIds
            );

            processedCount++;
            progressCallback?.({
                phase: 'processing',
                title: 'Processing conversations...',
                detail: `Processing conversation ${processedCount} of ${conversationsToProcess.length}`,
                current: processedCount,
                total: conversationsToProcess.length
            });
        }

        return importReport;
    }

    private async processSingleChat(
        adapter: any,
        chat: any,
        existingConversations: Map<string, ConversationCatalogEntry>,
        importReport: ImportReport,
        zip?: ZipArchiveReader,
        isReprocess: boolean = false,
        reprocessConversationIds?: Set<string>
    ): Promise<void> {
        const processLogger = this.plugin.logger.child("Process");
        try {
            // Check if chat is already a StandardConversation (from Gemini index preprocessing)
            const isStandardConversation = this.isStandardConversation(chat);

            const chatId = isStandardConversation ? chat.id : adapter.getId(chat);
            const chatTitle = isStandardConversation ? chat.title : (adapter.getTitle(chat) || 'Untitled');
            const chatCreateTime = isStandardConversation ? chat.createTime : adapter.getCreateTime(chat);
            const chatUpdateTime = isStandardConversation ? chat.updateTime : adapter.getUpdateTime(chat);

            // Validate conversation has required fields
            if (!chatId || chatId.trim() === '') {
                this.plugin.logger.warn(`Skipping conversation with missing ID: ${chatTitle}`);
                importReport.addFailed(chatTitle, "N/A", 0, 0, "Missing conversation ID");
                return;
            }

            const existingEntry = existingConversations.get(chatId);
            const forceReprocess = isReprocess || !!reprocessConversationIds?.has(chatId);

            let resolvedPath: string;
            if (existingEntry) {
                resolvedPath = await this.handleExistingChat(
                    adapter,
                    chat,
                    existingEntry,
                    importReport,
                    zip,
                    forceReprocess,
                    isStandardConversation
                );
            } else {
                const filePath = await this.generateFilePathForChat(adapter, chat, isStandardConversation);
                resolvedPath = await this.handleNewChat(adapter, chat, filePath, importReport, zip, isStandardConversation);
            }

            const previousEntry = existingConversations.get(chatId);
            const previousUpdateTime = previousEntry?.update_time ?? previousEntry?.updateTime ?? 0;
            const nextUpdateTime = Math.max(previousUpdateTime, Number(chatUpdateTime) || 0);
            const nextCreateTime = previousEntry?.create_time ?? (Number(chatCreateTime) || 0);
            const nextPath = previousEntry?.path || resolvedPath;
            existingConversations.set(chatId, {
                conversationId: chatId,
                provider: this.currentProvider,
                updateTime: nextUpdateTime,
                path: nextPath,
                create_time: nextCreateTime,
                update_time: nextUpdateTime,
            });

            this.counters.totalConversationsProcessed++;
        } catch (error: any) {
            const errorMessage = error.message || "Unknown error occurred";
            const isStandardConversation = this.isStandardConversation(chat);
            const chatTitle = isStandardConversation ? chat.title : (adapter.getTitle(chat) || "Untitled");
            processLogger.error("Single chat processing failed", {
                provider: this.currentProvider,
                chatTitle,
                message: errorMessage,
            });
            importReport.addError(`Error processing chat: ${chatTitle}`, errorMessage);
        }
    }

    /**
     * Check if a chat object is already a StandardConversation
     */
    private isStandardConversation(chat: any): boolean {
        return chat &&
               typeof chat.id === 'string' &&
               typeof chat.title === 'string' &&
               typeof chat.provider === 'string' &&
               typeof chat.createTime === 'number' &&
               typeof chat.updateTime === 'number' &&
               Array.isArray(chat.messages);
    }

    private async handleExistingChat(
        adapter: any,
        chat: any,
        existingRecord: ConversationCatalogEntry,
        importReport: ImportReport,
        zip?: ZipArchiveReader,
        isReprocess: boolean = false,
        isStandardConversation: boolean = false
    ): Promise<string> {
        const chatTitle = isStandardConversation ? chat.title : adapter.getTitle(chat);
        const createTime = isStandardConversation ? chat.createTime : adapter.getCreateTime(chat);
        const updateTime = isStandardConversation ? chat.updateTime : adapter.getUpdateTime(chat);

        // Count messages using provider-specific logic
        const totalMessageCount = await this.countMessages(adapter, chat, isStandardConversation);

        // Check if the file actually exists
        const fileExists = await this.plugin.app.vault.adapter.exists(existingRecord.path);

        if (!fileExists) {
            // File was deleted, recreate it
            return this.handleNewChat(adapter, chat, existingRecord.path, importReport, zip, isStandardConversation);
        }

        // REPROCESS LOGIC: Force update if this is a reprocess operation
        if (isReprocess) {
            this.counters.totalExistingConversationsToUpdate++;
            await this.updateExistingNote(adapter, chat, existingRecord.path, totalMessageCount, importReport, zip, true, isStandardConversation); // Force update
            return existingRecord.path;
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
            await this.updateExistingNote(adapter, chat, existingRecord.path, totalMessageCount, importReport, zip, false, isStandardConversation);
        }

        return existingRecord.path;
    }

    private async handleNewChat(
        adapter: any,
        chat: any,
        filePath: string,
        importReport: ImportReport,
        zip?: ZipArchiveReader,
        isStandardConversation: boolean = false
    ): Promise<string> {
        this.counters.totalNewConversationsToImport++;
        return this.createNewNote(adapter, chat, filePath, importReport, zip, isStandardConversation);
    }

    /**
     * Count messages in a chat using provider-specific logic
     */
    private async countMessages(adapter: any, chat: any, isStandardConversation: boolean = false): Promise<number> {
        // If already a StandardConversation, just count messages directly
        if (isStandardConversation) {
            return chat.messages?.length || 0;
        }

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
        zip?: ZipArchiveReader,
        forceUpdate: boolean = false,
        isStandardConversation: boolean = false
    ): Promise<void> {
        try {
            const file = this.plugin.app.vault.getAbstractFileByPath(filePath);
            if (file instanceof TFile) {
                let content = await this.plugin.app.vault.read(file);
                const originalContent = content;

                const chatUpdateTime = isStandardConversation ? chat.updateTime : adapter.getUpdateTime(chat);
                const chatCreateTime = isStandardConversation ? chat.createTime : adapter.getCreateTime(chat);
                const chatTitle = isStandardConversation ? chat.title : adapter.getTitle(chat);
                const chatId = isStandardConversation ? chat.id : adapter.getId(chat);

                const existingMessageIds = this.extractMessageUIDsFromNote(content);

                // For StandardConversation, get new messages directly; otherwise use adapter
                let newMessages: any[];
                if (isStandardConversation) {
                    newMessages = chat.messages.filter((msg: StandardMessage) =>
                        !existingMessageIds.includes(msg.id)
                    );
                } else {
                    newMessages = adapter.getNewMessages(chat, existingMessageIds);
                }

                let attachmentStats: { total: number; found: number; missing: number; failed: number } | undefined = undefined;

                // REPROCESS LOGIC: If forced update, recreate the entire note with attachment support
                if (forceUpdate) {
                    // Get or convert to standard format
                    let standardConversation: StandardConversation;
                    if (isStandardConversation) {
                        standardConversation = chat;
                    } else {
                        standardConversation = await adapter.convertChat(chat);
                    }

                    // Process attachments if ZIP provided
                    if (zip && adapter.processMessageAttachments) {
                        standardConversation.messages = await adapter.processMessageAttachments(
                            standardConversation.messages,
                            chatId,
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
                    // Get or convert to standard conversation
                    let standardConversation: StandardConversation;
                    if (isStandardConversation) {
                        standardConversation = chat;
                    } else {
                        standardConversation = await adapter.convertChat(chat);
                    }

                    // Update frontmatter metadata only when there are new messages.
                    content = this.updateMetadata(content, chatUpdateTime, standardConversation);

                    // Filter only new messages for formatting.
                    // Use note message IDs as source of truth because adapter.getNewMessages()
                    // may return provider-native objects (e.g. Claude uses uuid, not id).
                    const newStandardMessages = standardConversation.messages.filter((msg: StandardMessage) =>
                        !existingMessageIds.includes(msg.id)
                    );

                    // Process attachments on new messages only
                    let processedNewMessages = newStandardMessages;
                    if (zip && adapter.processMessageAttachments) {
                        processedNewMessages = await adapter.processMessageAttachments(
                            newStandardMessages,
                            chatId,
                            zip
                        );
                    }

                    // Always calculate attachment stats (even if not processed)
                    attachmentStats = this.calculateAttachmentStats(processedNewMessages);

                    content += "\n\n" + this.messageFormatter.formatMessages(processedNewMessages);
                    content = this.updateRelatedQueriesSection(content, standardConversation);
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
        zip?: ZipArchiveReader,
        isStandardConversation: boolean = false
    ): Promise<string> {
        try {
            // Ensure the folder exists (in case it was deleted)
            const folderPath = filePath.substring(0, filePath.lastIndexOf('/'));
            const folderResult = await ensureFolderExists(folderPath, this.plugin.app.vault);
            if (!folderResult.success) {
                throw new Error(folderResult.error || "Failed to ensure folder exists.");
            }

            // Get or convert to standard format
            let standardConversation: StandardConversation;
            if (isStandardConversation) {
                standardConversation = chat;
            } else {
                standardConversation = await adapter.convertChat(chat);
            }

            const chatId = standardConversation.id;

            // Process attachments if ZIP provided
            let attachmentStats = { total: 0, found: 0, missing: 0, failed: 0 };
            if (zip && adapter.processMessageAttachments) {
                standardConversation.messages = await adapter.processMessageAttachments(
                    standardConversation.messages,
                    chatId,
                    zip
                );

                // Calculate attachment stats
                attachmentStats = this.calculateAttachmentStats(standardConversation.messages);
            }

            const content = this.noteFormatter.generateMarkdownContent(standardConversation);
            const chatTitle = standardConversation.title;
            let finalFilePath = filePath;

            try {
                await this.fileService.writeToFile(finalFilePath, content);
            } catch (error: any) {
                if (!this.isNameTooLongError(error)) {
                    throw error;
                }

                const fallbackPath = this.buildFallbackConversationPath(finalFilePath, chatId);
                this.plugin.logger.warn("Conversation filename exceeded platform limits; retrying with fallback name", {
                    provider: standardConversation.provider,
                    conversationId: chatId,
                    originalPath: finalFilePath,
                    fallbackPath,
                });

                finalFilePath = await generateUniqueFileName(
                    fallbackPath,
                    this.plugin.app.vault.adapter,
                    CONVERSATION_NOTE_FILENAME_MAX_BYTES
                );
                await this.fileService.writeToFile(finalFilePath, content);
            }

            const messageCount = standardConversation.messages.length;
            const createTime = standardConversation.createTime;
            const updateTime = standardConversation.updateTime;

            // Get provider-specific count (artifacts for Claude, attachments for ChatGPT)
            const providerSpecificCount = this.getProviderSpecificCount(adapter, chat);

            importReport.addCreated(
                chatTitle,
                finalFilePath,
                createTime,
                updateTime,
                messageCount,
                attachmentStats,
                providerSpecificCount
            );

            this.counters.totalNewConversationsSuccessfullyImported++;
            this.counters.totalNonEmptyMessagesToImport += messageCount;
            return finalFilePath;

        } catch (error: any) {
            this.plugin.logger.error("Error creating new note", error.message);
            const createTime = isStandardConversation ? chat.createTime : adapter.getCreateTime(chat);
            const updateTime = isStandardConversation ? chat.updateTime : adapter.getUpdateTime(chat);
            const chatTitle = isStandardConversation ? chat.title : adapter.getTitle(chat);

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



    private updateMetadata(content: string, updateTime: number, conversation?: StandardConversation): string {
        // Use ISO 8601 format for frontmatter (consistent with create_time)
        const updateTimeStr = new Date(updateTime * 1000).toISOString();
        content = content.replace(/^update_time: .*$/m, `update_time: ${updateTimeStr}`);

        // Note: "Last Updated" field is not used in current note format, but kept for backward compatibility
        content = content.replace(/^Last Updated: .*$/m, `Last Updated: ${updateTimeStr}`);

        if (!conversation) {
            return content;
        }

        const mode = typeof conversation.metadata?.mode === "string"
            ? conversation.metadata.mode.trim()
            : "";
        const models = this.collectConversationModels(conversation);

        return this.updateFrontmatterModeAndModels(content, mode, models);
    }

    private collectConversationModels(conversation: StandardConversation): string[] {
        const metadata = conversation.metadata || {};
        const fromMetadata = Array.isArray(conversation.metadata?.models)
            ? (metadata.models as string[])
            : [];
        const fromMessages = conversation.messages
            .map(message => message.model)
            .filter((model): model is string => typeof model === "string" && model.trim().length > 0);

        const seen = new Set<string>();
        const models: string[] = [];
        for (const model of [...fromMetadata, ...fromMessages]) {
            const normalized = model.trim();
            if (!normalized || seen.has(normalized)) continue;
            seen.add(normalized);
            models.push(normalized);
        }

        return models;
    }

    private updateFrontmatterModeAndModels(content: string, mode: string, models: string[]): string {
        const frontmatterMatch = content.match(/^---\n[\s\S]*?\n---/);
        if (!frontmatterMatch) {
            return content;
        }

        let frontmatter = frontmatterMatch[0];
        frontmatter = frontmatter.replace(/^mode: .*$/m, "").replace(/\n{3,}/g, "\n\n");
        frontmatter = frontmatter.replace(/^models:\n(?:\s+- .*\n?)*/m, "").replace(/\n{3,}/g, "\n\n");

        const modeLine = mode ? `mode: "${mode.replace(/"/g, '\\"')}"\n` : "";
        const modelsBlock = models.length > 0
            ? `models:\n${models.map(model => `  - "${model.replace(/"/g, '\\"')}"`).join("\n")}\n`
            : "";

        if (modeLine || modelsBlock) {
            frontmatter = frontmatter.replace(/\n---$/, `\n${modeLine}${modelsBlock}---`);
        }

        return content.replace(frontmatterMatch[0], frontmatter);
    }

    private updateRelatedQueriesSection(content: string, conversation: StandardConversation): string {
        const metadata = conversation.metadata || {};
        const relatedQueries = Array.isArray(conversation.metadata?.related_queries)
            ? (metadata.related_queries as unknown[])
                .filter((query): query is string => typeof query === "string")
                .map(query => query.trim())
                .filter(query => query.length > 0)
            : [];

        if (relatedQueries.length === 0) {
            return content;
        }

        const uniqueQueries = [...new Set(relatedQueries)];
        const section = `\n## Related Queries\n${uniqueQueries.map(query => `- ${query}`).join("\n")}`;

        if (/\n## Related Queries\n[\s\S]*$/.test(content)) {
            return content.replace(/\n## Related Queries\n[\s\S]*$/, section);
        }

        return `${content.trimEnd()}\n${section}`;
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

    private async generateFilePathForChat(adapter: any, chat: any, isStandardConversation: boolean = false): Promise<string> {
        const createTime = isStandardConversation ? chat.createTime : adapter.getCreateTime(chat);
        const chatTitle = isStandardConversation ? chat.title : adapter.getTitle(chat);
        const providerName = isStandardConversation ? chat.provider : adapter.getProviderName();

        const date = new Date(createTime * 1000);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");

        // New structure: <conversationFolder>/<provider>/<year>/<month>/
        const folderPath = `${this.plugin.settings.conversationFolder}/${providerName}/${year}/${month}`;

        const folderResult = await ensureFolderExists(folderPath, this.plugin.app.vault);
        if (!folderResult.success) {
            throw new Error(folderResult.error || "Failed to ensure folder exists.");
        }

        const markdownExtensionBytes = 3; // ".md"
        const maxBaseNameBytes = Math.max(1, CONVERSATION_NOTE_FILENAME_MAX_BYTES - markdownExtensionBytes);

        let fileName = generateConversationFileName(
            chatTitle,
            createTime,
            this.plugin.settings.addDatePrefix,
            this.plugin.settings.dateFormat,
            { maxBytes: maxBaseNameBytes }
        ) + ".md";

        let filePath = `${folderPath}/${fileName}`;
        if (await doesFilePathExist(filePath, this.plugin.app.vault)) {
            filePath = await generateUniqueFileName(
                filePath,
                this.plugin.app.vault.adapter,
                CONVERSATION_NOTE_FILENAME_MAX_BYTES
            );
        }

        return filePath;
    }

    private isNameTooLongError(error: any): boolean {
        if (!error) return false;
        const message = typeof error?.message === "string" ? error.message : String(error);
        const code = typeof error?.code === "string" ? error.code : "";
        return code === "ENAMETOOLONG" || message.includes("ENAMETOOLONG");
    }

    private buildFallbackConversationPath(originalPath: string, conversationId: string): string {
        const slashIndex = originalPath.lastIndexOf("/");
        const folderPath = slashIndex >= 0 ? originalPath.substring(0, slashIndex) : "";
        const safeConversationId = (conversationId || "unknown")
            .replace(/[^a-zA-Z0-9_-]+/g, "-")
            .replace(/-+/g, "-")
            .replace(/^-|-$/g, "")
            .slice(0, 48) || "unknown";
        const fallbackFileName = `conversation-${safeConversationId}.md`;
        return folderPath ? `${folderPath}/${fallbackFileName}` : fallbackFileName;
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
