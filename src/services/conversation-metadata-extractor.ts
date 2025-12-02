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


// src/services/conversation-metadata-extractor.ts
import JSZip from "jszip";
import { ProviderRegistry } from "../providers/provider-adapter";
import { Chat } from "../providers/chatgpt/chatgpt-types";
import { ClaudeConversation, ClaudeExportData } from "../providers/claude/claude-types";
import { isValidMessage, compareTimestampsIgnoringSeconds } from "../utils";
import { logger } from "../logger";
import type NexusAiChatImporterPlugin from "../main";
import { parseConversationsJson, streamConversationsFromZip } from "../utils/conversations-json-parser";
import { LARGE_ARCHIVE_THRESHOLD_BYTES } from "../config/constants";

/**
 * Conversation existence status for import preview
 */
export type ConversationExistenceStatus = 'new' | 'updated' | 'unchanged' | 'unknown';

/**
 * Analysis information for user display
 */
export interface AnalysisInfo {
    totalConversationsFound: number;
    uniqueConversationsKept: number;
    duplicatesRemoved: number;
    hasMultipleFiles: boolean;

    // Detailed breakdown for selection
    conversationsNew: number;
    conversationsUpdated: number;
    conversationsIgnored: number; // unchanged conversations filtered out
}

/**
 * Lightweight conversation metadata for preview purposes
 */
export interface ConversationMetadata {
    id: string;
    title: string;
    createTime: number; // Unix timestamp
    updateTime: number; // Unix timestamp
    messageCount: number;
    provider: string;
    isStarred?: boolean;
    isArchived?: boolean;

    // Multi-file import support
    sourceFile?: string; // Original ZIP filename
    sourceFileIndex?: number; // Index in file array for processing order

    // Existence status for import preview
    existenceStatus?: ConversationExistenceStatus;
    existingUpdateTime?: number; // Update time of existing conversation (if any)
    hasNewerContent?: boolean; // True if ZIP version is newer than existing
}

/**
 * Statistics for a single file during analysis
 */
export interface FileAnalysisStats {
    fileName: string;
    totalConversations: number;        // Total in this file
    duplicates: number;                 // Duplicates (already seen in previous files)
    uniqueContributed: number;          // Unique conversations from this file
    selectedForImport: number;          // Selected for import (new + updated)
    newConversations: number;           // New (not in vault)
    updatedConversations: number;       // Updated (newer than vault)
    skippedConversations: number;       // Skipped (unchanged in vault)
}

/**
 * Result of metadata extraction with analysis info
 */
export interface MetadataExtractionResult {
    conversations: ConversationMetadata[];
    analysisInfo?: AnalysisInfo;
    fileStats?: Map<string, FileAnalysisStats>;
}

/**
 * Service for extracting conversation metadata without full processing
 * Used for conversation selection preview
 */
export class ConversationMetadataExtractor {
    constructor(
        private providerRegistry: ProviderRegistry,
        private plugin: NexusAiChatImporterPlugin
    ) {}

    /**
     * Extract conversation metadata from ZIP file
     */
    async extractMetadataFromZip(
        zip: JSZip,
        forcedProvider?: string,
        sourceFileName?: string,
        sourceFileIndex?: number,
        existingConversations?: Map<string, any>
    ): Promise<ConversationMetadata[]> {
        try {
            const conversationsFile = zip.file("conversations.json");
            if (!conversationsFile) {
                throw new Error("Missing conversations.json file in ZIP archive");
            }

            const size = (conversationsFile as any)?._data?.uncompressedSize as number | undefined;

            if (size && size > LARGE_ARCHIVE_THRESHOLD_BYTES) {
                return await this.extractMetadataFromZipStreaming(zip, forcedProvider, sourceFileName, sourceFileIndex, existingConversations);
            }

            // Extract raw conversation data
            const rawConversations = await this.extractRawConversationsFromZip(zip);

            if (rawConversations.length === 0) {
                return [];
            }

            // Detect provider if not forced
            const provider = forcedProvider || this.providerRegistry.detectProvider(rawConversations);

            if (provider === 'unknown') {
                throw new Error('Could not detect conversation provider from data structure');
            }

            // Extract metadata based on provider
            const metadata = this.extractMetadataByProvider(rawConversations, provider);

            return metadata.map(conv => this.applySourceAndExistence(conv, sourceFileName, sourceFileIndex, existingConversations));
        } catch (error) {
            throw new Error(`Failed to extract conversation metadata: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async extractMetadataFromZipStreaming(
        zip: JSZip,
        forcedProvider?: string,
        sourceFileName?: string,
        sourceFileIndex?: number,
        existingConversations?: Map<string, any>
    ): Promise<ConversationMetadata[]> {
        const conversationsFile = zip.file("conversations.json");
        if (!conversationsFile) {
            throw new Error("Missing conversations.json file in ZIP archive");
        }

        const generator = streamConversationsFromZip(conversationsFile, {
            shape: forcedProvider === 'claude' ? 'claude' : forcedProvider === 'chatgpt' ? 'chatgpt' : 'auto'
        });

        const iterator = generator[Symbol.asyncIterator]();
        const first = await iterator.next();

        if (first.done) {
            return [];
        }

        const provider = forcedProvider || this.providerRegistry.detectProvider([first.value]);
        if (provider === 'unknown') {
            throw new Error('Could not detect conversation provider from data structure');
        }

        const metadata: ConversationMetadata[] = [];

        const processConversation = (chat: any) => {
            let meta: ConversationMetadata | null = null;
            if (provider === 'chatgpt') {
                meta = this.extractChatGPTMetadataForConversation(chat as Chat);
            } else if (provider === 'claude') {
                meta = this.extractClaudeMetadataForConversation(chat as ClaudeConversation);
            }

            if (!meta) return;

            metadata.push(
                this.applySourceAndExistence(meta, sourceFileName, sourceFileIndex, existingConversations)
            );
        };

        processConversation(first.value);

        for (let next = await iterator.next(); !next.done; next = await iterator.next()) {
            processConversation(next.value);
        }

        return metadata;
    }

    /**
     * Extract raw conversation data from ZIP (provider-agnostic)
     */
    private async extractRawConversationsFromZip(zip: JSZip): Promise<any[]> {
        const conversationsFile = zip.file("conversations.json");
        if (!conversationsFile) {
            throw new Error("Missing conversations.json file in ZIP archive");
        }

        const parsedData = await parseConversationsJson(conversationsFile);

        // Handle different data structures
        if (Array.isArray(parsedData)) {
            // Direct array of conversations (ChatGPT format)
            return parsedData;
        } else if (parsedData.conversations && Array.isArray(parsedData.conversations)) {
            // Nested structure (Claude format)
            return parsedData.conversations;
        } else {
            throw new Error("Invalid conversations.json structure");
        }
    }

    /**
     * Extract metadata based on detected provider
     */
    private extractMetadataByProvider(rawConversations: any[], provider: string): ConversationMetadata[] {
        switch (provider) {
            case 'chatgpt':
                return rawConversations
                    .map(chat => this.extractChatGPTMetadataForConversation(chat as Chat))
                    .filter(Boolean) as ConversationMetadata[];
            case 'claude':
                return rawConversations
                    .map(chat => this.extractClaudeMetadataForConversation(chat as ClaudeConversation))
                    .filter(Boolean) as ConversationMetadata[];
            default:
                throw new Error(`Unsupported provider: ${provider}`);
        }
    }

    /**
     * Extract metadata from a single ChatGPT conversation
     */
    private extractChatGPTMetadataForConversation(chat: Chat): ConversationMetadata | null {
        // Filter out invalid conversations (missing ID or timestamps)
        if (!chat?.id || chat.id.trim() === '') {
            logger.warn('Skipping ChatGPT conversation with missing ID:', chat?.title || 'Untitled');
            return null;
        }
        if (!chat.create_time || !chat.update_time) {
            logger.warn('Skipping ChatGPT conversation with missing timestamps:', { id: chat.id, title: chat.title || 'Untitled' });
            return null;
        }

        const messageCount = this.countChatGPTMessages(chat);
        if (messageCount === 0) {
            return null;
        }

        return {
            id: chat.id,
            title: chat.title || "Untitled",
            createTime: chat.create_time,
            updateTime: chat.update_time,
            messageCount,
            provider: "chatgpt",
            isStarred: chat.is_starred || false,
            isArchived: chat.is_archived || false
        };
    }

    /**
     * Extract metadata from a single Claude conversation
     */
    private extractClaudeMetadataForConversation(chat: ClaudeConversation): ConversationMetadata | null {
        if (!chat?.uuid || chat.uuid.trim() === '') {
            logger.warn('Skipping Claude conversation with missing UUID:', chat?.name || 'Untitled');
            return null;
        }
        if (!chat.created_at || !chat.updated_at) {
            logger.warn('Skipping Claude conversation with missing timestamps:', { id: chat.uuid, title: chat.name || 'Untitled' });
            return null;
        }

        const messageCount = this.countClaudeMessages(chat);
        if (messageCount === 0) {
            return null;
        }

        return {
            id: chat.uuid,
            title: chat.name || "Untitled",
            createTime: Math.floor(new Date(chat.created_at).getTime() / 1000),
            updateTime: Math.floor(new Date(chat.updated_at).getTime() / 1000),
            messageCount,
            provider: "claude",
            isStarred: chat.is_starred || false,
            isArchived: false
        };
    }

    /**
     * Count messages in ChatGPT conversation (lightweight version)
     */
    private countChatGPTMessages(chat: Chat): number {
        if (!chat.mapping) {
            return 0;
        }

        let count = 0;
        for (const messageObj of Object.values(chat.mapping)) {
            const message = messageObj?.message;
            if (!message) continue;

            // Use same filtering logic as ChatGPTConverter but without full processing
            if (this.shouldIncludeChatGPTMessage(message)) {
                count++;
            }
        }

        return count;
    }

    /**
     * Count messages in Claude conversation (lightweight version)
     */
    private countClaudeMessages(chat: ClaudeConversation): number {
        if (!chat.chat_messages || !Array.isArray(chat.chat_messages)) {
            return 0;
        }

        let count = 0;
        for (const message of chat.chat_messages) {
            if (this.shouldIncludeClaudeMessage(message)) {
                count++;
            }
        }

        return count;
    }

    /**
     * Lightweight version of ChatGPT message filtering
     */
    private shouldIncludeChatGPTMessage(message: any): boolean {
        if (!message || !message.author) {
            return false;
        }

        // Skip system and tool messages (same logic as ChatGPTConverter)
        if (message.author.role === "system" || message.author.role === "tool") {
            return false;
        }

        // Skip hidden messages
        if (message.metadata?.is_visually_hidden_from_conversation === true) {
            return false;
        }

        // Use existing validation
        return isValidMessage(message);
    }

    /**
     * Lightweight version of Claude message filtering
     */
    private shouldIncludeClaudeMessage(message: any): boolean {
        if (!message || !message.uuid || !message.sender) {
            return false;
        }

        // Include both human and assistant messages
        return message.sender === 'human' || message.sender === 'assistant';
    }

    private applySourceAndExistence(
        metadata: ConversationMetadata,
        sourceFileName?: string,
        sourceFileIndex?: number,
        existingConversations?: Map<string, any>
    ): ConversationMetadata {
        const enhanced: ConversationMetadata = {
            ...metadata,
            sourceFile: sourceFileName,
            sourceFileIndex: sourceFileIndex
        };

        if (existingConversations) {
            const existing = existingConversations.get(metadata.id);
            if (existing) {
                enhanced.existingUpdateTime = existing.updateTime;
                const comparison = compareTimestampsIgnoringSeconds(metadata.updateTime, existing.updateTime);
                if (comparison > 0) {
                    enhanced.existenceStatus = 'updated';
                    enhanced.hasNewerContent = true;
                } else {
                    enhanced.existenceStatus = 'unchanged';
                    enhanced.hasNewerContent = false;
                }
            } else {
                enhanced.existenceStatus = 'new';
                enhanced.hasNewerContent = true;
            }
        } else {
            enhanced.existenceStatus = 'unknown';
        }

        return enhanced;
    }

    /**
     * Extract metadata from multiple ZIP files (for multi-file selective import)
     * Follows the same logic as the working import process:
     * 1. Process files chronologically
     * 2. Build map of best versions per conversation ID
     * 3. Compare with vault and filter out unchanged conversations
     * 4. Only return NEW and UPDATED conversations for selection
     */
    async extractMetadataFromMultipleZips(
        files: File[],
        forcedProvider?: string,
        existingConversations?: Map<string, any>
    ): Promise<MetadataExtractionResult> {
        // Step 1: Process files chronologically and build conversation map
        const conversationMap = new Map<string, ConversationMetadata>();
        const allConversationsFound: ConversationMetadata[] = [];
        const fileStatsMap = new Map<string, FileAnalysisStats>();

        // Track which file contributed each conversation to the final map
        const conversationToFileMap = new Map<string, string>(); // conversationId → fileName

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            try {
                // Load ZIP
                const JSZip = (await import('jszip')).default;
                const zip = new JSZip();
                const zipContent = await zip.loadAsync(file);

                // Extract metadata WITHOUT vault comparison (we'll do that later)
                const metadata = await this.extractMetadataFromZip(
                    zipContent,
                    forcedProvider,
                    file.name,
                    i,
                    undefined // Don't compare with vault yet
                );

                // Track all conversations found for deduplication stats
                allConversationsFound.push(...metadata);

                // Initialize stats for this file
                const totalInFile = metadata.length;
                let duplicatesInFile = 0;
                let uniqueFromFile = 0;

                // Step 2: Build map of best versions (same logic as working import)
                for (const conversation of metadata) {
                    const existing = conversationMap.get(conversation.id);

                    if (!existing) {
                        // First occurrence of this conversation ID
                        uniqueFromFile++;
                        conversationMap.set(conversation.id, conversation);
                        conversationToFileMap.set(conversation.id, file.name);
                    } else {
                        // Duplicate found - determine which version to keep
                        let shouldReplace = false;

                        // Compare timestamps ignoring seconds (v1.2.0 → v1.3.0 compatibility)
                        const comparison = compareTimestampsIgnoringSeconds(conversation.updateTime, existing.updateTime);

                        if (comparison > 0) {
                            // Current conversation is newer
                            shouldReplace = true;
                        } else if (comparison === 0) {
                            // Same updateTime (ignoring seconds) - prefer the one from later file (higher sourceFileIndex)
                            const currentFileIndex = conversation.sourceFileIndex || 0;
                            const existingFileIndex = existing.sourceFileIndex || 0;

                            if (currentFileIndex > existingFileIndex) {
                                shouldReplace = true;
                            }
                        }

                        if (shouldReplace) {
                            // Current is newer - it replaces the old one

                            // Update stats for OLD file (its version is now a duplicate)
                            const oldFileName = conversationToFileMap.get(conversation.id)!;
                            const oldFileStats = fileStatsMap.get(oldFileName);
                            if (oldFileStats) {
                                oldFileStats.uniqueContributed--;
                                oldFileStats.duplicates++;
                            }

                            // Update stats for CURRENT file (it's now unique)
                            uniqueFromFile++;

                            // Replace in map
                            conversationMap.set(conversation.id, conversation);
                            conversationToFileMap.set(conversation.id, file.name);
                        } else {
                            // Current is older or same priority - it's a duplicate
                            duplicatesInFile++;
                        }
                    }
                }

                // Store stats for this file (will complete selected/new/updated/skipped after filtering)
                fileStatsMap.set(file.name, {
                    fileName: file.name,
                    totalConversations: totalInFile,
                    duplicates: duplicatesInFile,
                    uniqueContributed: uniqueFromFile,
                    selectedForImport: 0,
                    newConversations: 0,
                    updatedConversations: 0,
                    skippedConversations: 0
                });
            } catch (error) {
                logger.error(`Error extracting metadata from ${file.name}:`, error);
                // Continue with other files even if one fails
            }
        }

        // Step 3: Compare best versions with vault and filter (same logic as working import)
        const filterResult = this.filterConversationsForSelection(
            Array.from(conversationMap.values()),
            existingConversations
        );

        // Step 4: Complete file stats with selected/new/updated/skipped counts
        for (const conversation of filterResult.conversations) {
            const fileName = conversation.sourceFile;
            if (fileName && fileStatsMap.has(fileName)) {
                const stats = fileStatsMap.get(fileName)!;
                stats.selectedForImport++;

                if (conversation.existenceStatus === 'new') {
                    stats.newConversations++;
                } else if (conversation.existenceStatus === 'updated') {
                    stats.updatedConversations++;
                }
            }
        }

        // Count skipped conversations per file
        for (const conversation of filterResult.ignoredConversations) {
            const fileName = conversation.sourceFile;
            if (fileName && fileStatsMap.has(fileName)) {
                const stats = fileStatsMap.get(fileName)!;
                stats.skippedConversations++;
            }
        }

        // Step 5: Build analysis info with detailed breakdown
        const analysisInfo: AnalysisInfo = {
            totalConversationsFound: allConversationsFound.length,
            uniqueConversationsKept: conversationMap.size,
            duplicatesRemoved: allConversationsFound.length - conversationMap.size,
            hasMultipleFiles: files.length > 1,
            conversationsNew: filterResult.newCount,
            conversationsUpdated: filterResult.updatedCount,
            conversationsIgnored: filterResult.ignoredCount
        };

        return {
            conversations: filterResult.conversations,
            analysisInfo: analysisInfo,
            fileStats: fileStatsMap
        };
    }

    /**
     * @deprecated - Old deduplication methods, replaced by new chronological approach
     * Kept for compatibility but no longer used in the main flow
     */
    private deduplicateConversations(conversations: ConversationMetadata[]): ConversationMetadata[] {
        // This method is no longer used in the new logic
        return conversations;
    }

    /**
     * Filter conversations for selection dialog (same logic as working import process)
     * Only returns NEW and UPDATED conversations - filters out UNCHANGED completely
     */
    private filterConversationsForSelection(
        bestVersions: ConversationMetadata[],
        existingConversations?: Map<string, any>
    ): {
        conversations: ConversationMetadata[],
        ignoredConversations: ConversationMetadata[],
        newCount: number,
        updatedCount: number,
        ignoredCount: number
    } {
        const conversationsForSelection: ConversationMetadata[] = [];
        const ignoredConversations: ConversationMetadata[] = [];
        let newCount = 0;
        let updatedCount = 0;
        let ignoredCount = 0;

        for (const conversation of bestVersions) {
            if (!existingConversations) {
                // No vault data - mark all as new
                conversation.existenceStatus = 'new';
                conversation.hasNewerContent = true;
                conversationsForSelection.push(conversation);
                newCount++;
                continue;
            }

            const vaultConversation = existingConversations.get(conversation.id);

            if (!vaultConversation) {
                // Si absente du vault → NEW (toujours proposer)
                conversation.existenceStatus = 'new';
                conversation.hasNewerContent = true;
                conversationsForSelection.push(conversation);
                newCount++;
            } else {
                // Si présente dans le vault → comparer updateTime
                conversation.existingUpdateTime = vaultConversation.updateTime;

                // Normalize ZIP timestamp to match vault format (ISO 8601 → unix without milliseconds)
                // This ensures we compare apples to apples:
                // 1. ZIP has float with milliseconds: 1742761058.385406
                // 2. Convert to ISO 8601: "2025-10-04T22:30:45.385Z"
                // 3. Parse back to unix (loses milliseconds): 1742761058
                // This is the SAME process used when writing frontmatter, so comparison is consistent
                const { moment } = require("obsidian");
                const zipUpdateTimeISO = new Date(conversation.updateTime * 1000).toISOString();
                const normalizedZipUpdateTime = moment(zipUpdateTimeISO, moment.ISO_8601, true).unix();

                // Compare timestamps ignoring seconds (v1.2.0 → v1.3.0 compatibility)
                const comparison = compareTimestampsIgnoringSeconds(normalizedZipUpdateTime, vaultConversation.updateTime);

                if (comparison > 0) {
                    // ZIP plus récent que vault → UPDATED (proposer)
                    conversation.existenceStatus = 'updated';
                    conversation.hasNewerContent = true;
                    conversationsForSelection.push(conversation);
                    updatedCount++;
                } else {
                    // ZIP identique ou plus ancien que vault → UNCHANGED (IGNORER)
                    // Ne pas ajouter à conversationsForSelection mais tracker pour stats
                    conversation.existenceStatus = 'unchanged';
                    ignoredConversations.push(conversation);
                    ignoredCount++;
                }
            }
        }

        return {
            conversations: conversationsForSelection,
            ignoredConversations,
            newCount,
            updatedCount,
            ignoredCount
        };
    }

    /**
     * @deprecated - Old deduplication logic, replaced by new chronological approach
     */
    private ensureCorrectExistenceStatus(
        keptConversation: ConversationMetadata,
        currentConversation: ConversationMetadata,
        existingConversation: ConversationMetadata
    ): ConversationMetadata {
        // This method is no longer used in the new logic
        return keptConversation;
    }

    /**
     * Get total conversation count from ZIP without extracting all metadata
     */
    async getConversationCount(zip: JSZip): Promise<number> {
        try {
            const rawConversations = await this.extractRawConversationsFromZip(zip);
            return rawConversations.length;
        } catch (error) {
            return 0;
        }
    }
}
