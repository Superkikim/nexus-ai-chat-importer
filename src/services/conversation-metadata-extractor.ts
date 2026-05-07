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

import { Platform } from "obsidian";
import { ProviderRegistry } from "../providers/provider-adapter";
import { Chat } from "../providers/chatgpt/chatgpt-types";
import { ClaudeConversation } from "../providers/claude/claude-types";
import { isValidMessage, compareTimestampsIgnoringSeconds } from "../utils";
import type NexusAiChatImporterPlugin from "../main";
import { createZipArchiveReader, ZipArchiveReader } from "../utils/zip-loader";
import {
    classifyArchiveEntries,
    extractConversationsStream,
    extractRawConversations,
    getArchiveProviderMismatchMessage,
    getArchiveUnsupportedFormatMessage,
    SupportedArchiveProvider,
} from "../utils/zip-content-reader";
import { decideArchiveMode } from "./archive-mode-decider";
import { Logger, ScopedLogger } from "../logger";
import { normalizePerplexityConversationFile } from "../providers/perplexity/perplexity-normalizer";
import { deriveLeChatConversationTitle } from "../providers/lechat/lechat-title";

export type ConversationExistenceStatus = "new" | "updated" | "unchanged" | "unknown";

export interface AnalysisInfo {
    totalConversationsFound: number;
    uniqueConversationsKept: number;
    duplicatesRemoved: number;
    hasMultipleFiles: boolean;
    conversationsNew: number;
    conversationsUpdated: number;
    conversationsIgnored: number;
}

export interface ConversationMetadata {
    id: string;
    title: string;
    createTime: number;
    updateTime: number;
    messageCount: number;
    provider: string;
    isStarred?: boolean;
    isArchived?: boolean;
    sourceFile?: string;
    sourceFileIndex?: number;
    existenceStatus?: ConversationExistenceStatus;
    existingUpdateTime?: number;
    hasNewerContent?: boolean;
}

export interface FileAnalysisStats {
    fileName: string;
    totalConversations: number;
    duplicates: number;
    uniqueContributed: number;
    selectedForImport: number;
    newConversations: number;
    updatedConversations: number;
    skippedConversations: number;
}

export interface IgnoredArchiveInfo {
    fileName: string;
    reason: "unsupported-format" | "provider-mismatch" | "empty" | "nested-zip-container" | "read-error";
    message: string;
}

export interface MetadataExtractionResult {
    conversations: ConversationMetadata[];
    analysisInfo?: AnalysisInfo;
    fileStats?: Map<string, FileAnalysisStats>;
    supportedFiles: File[];
    ignoredArchives: IgnoredArchiveInfo[];
}

export class ConversationMetadataExtractor {
    private readonly metadataLogger: ScopedLogger;

    constructor(
        private providerRegistry: ProviderRegistry,
        private plugin: NexusAiChatImporterPlugin
    ) {
        const pluginLogger = plugin.logger as Logger & { child?: (moduleName: string) => ScopedLogger };
        this.metadataLogger =
            typeof pluginLogger.child === "function"
                ? pluginLogger.child("Metadata")
                : new Logger().child("Metadata");
    }

    async extractMetadataFromZip(
        zip: ZipArchiveReader,
        forcedProvider?: string,
        sourceFileName?: string,
        sourceFileIndex?: number,
        existingConversations?: Map<string, any>
    ): Promise<ConversationMetadata[]> {
        const startedAt = Date.now();
        const entries = await zip.listEntries();
        const classification = classifyArchiveEntries(entries.map(entry => entry.path), forcedProvider);

        if (!classification.supported) {
            this.metadataLogger.debug(`Archive skipped during single-file metadata extraction`, {
                sourceFileName,
                reason: classification.reason,
                message: classification.message,
                durationMs: Date.now() - startedAt,
            });
            return [];
        }

        const provider = (forcedProvider || classification.provider) as SupportedArchiveProvider;
        let metadata: ConversationMetadata[] = [];

        if (provider === "gemini") {
            const rawConversations = await extractRawConversations(zip);
            if (rawConversations.conversations.length > 0) {
                metadata = this.extractMetadataByProvider(rawConversations.conversations, provider);
            }
        } else {
            for await (const rawConversation of extractConversationsStream(zip, {
                mobileRuntime: Platform.isMobile,
                enforceChunkedForLargeJsonOnMobile: Platform.isMobile,
                largeJsonThresholdBytes: 32 * 1024 * 1024,
                streamYieldEvery: 25,
            })) {
                const singleConversationMetadata = this.extractSingleMetadataByProvider(rawConversation, provider);
                if (singleConversationMetadata) {
                    metadata.push(singleConversationMetadata);
                }
            }
        }

        if (metadata.length === 0) {
            this.metadataLogger.warn(`Archive produced no conversations during metadata extraction`, {
                sourceFileName,
                provider,
                durationMs: Date.now() - startedAt,
            });
            return [];
        }

        const enhancedMetadata = metadata.map(conv => {
            const enhanced: ConversationMetadata = {
                ...conv,
                sourceFile: sourceFileName,
                sourceFileIndex,
            };

            if (!existingConversations) {
                enhanced.existenceStatus = "unknown";
                return enhanced;
            }

            const existing = existingConversations.get(conv.id);
            if (!existing) {
                enhanced.existenceStatus = "new";
                enhanced.hasNewerContent = true;
                return enhanced;
            }

            enhanced.existingUpdateTime = existing.updateTime;
            const comparison = compareTimestampsIgnoringSeconds(conv.updateTime, existing.updateTime);
            if (comparison > 0) {
                enhanced.existenceStatus = "updated";
                enhanced.hasNewerContent = true;
            } else {
                enhanced.existenceStatus = "unchanged";
                enhanced.hasNewerContent = false;
            }

            return enhanced;
        });

        this.metadataLogger.debug(`Metadata extracted from archive`, {
            sourceFileName,
            provider,
            entryCount: entries.length,
            conversationCount: enhancedMetadata.length,
            durationMs: Date.now() - startedAt,
        });

        return enhancedMetadata;
    }

    async extractMetadataFromMultipleZips(
        files: File[],
        forcedProvider?: string,
        existingConversations?: Map<string, any>
    ): Promise<MetadataExtractionResult> {
        const batchStartedAt = Date.now();
        this.metadataLogger.debug(`Begin metadata extraction batch`, {
            fileCount: files.length,
            forcedProvider: forcedProvider || "auto",
        });

        const conversationMap = new Map<string, ConversationMetadata>();
        const allConversationsFound: ConversationMetadata[] = [];
        const fileStatsMap = new Map<string, FileAnalysisStats>();
        const conversationToFileMap = new Map<string, string>();
        const supportedFiles: File[] = [];
        const ignoredArchives: IgnoredArchiveInfo[] = [];

        const adapter = forcedProvider ? this.providerRegistry.getAdapter(forcedProvider) : undefined;
        const entryFilter = adapter?.shouldIncludeZipEntry?.bind(adapter);

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const fileStartedAt = Date.now();

            try {
                this.metadataLogger.debug(`Analyze archive [${i + 1}/${files.length}]`, {
                    fileName: file.name,
                    fileSize: file.size,
                });

                const archiveModeDecision = decideArchiveMode({ zipSizeBytes: file.size });
                if (archiveModeDecision.mode === "large-archive") {
                    this.metadataLogger.debug(`Large archive detected`, {
                        fileName: file.name,
                        reason: archiveModeDecision.reason,
                        fileSize: file.size,
                    });
                }

                const zip = await createZipArchiveReader(file, entryFilter);
                const entries = await zip.listEntries();
                const classification = classifyArchiveEntries(entries.map(entry => entry.path), forcedProvider);

                this.metadataLogger.debug(`Archive classified`, {
                    fileName: file.name,
                    entryCount: entries.length,
                    supported: classification.supported,
                    reason: classification.reason,
                    provider: classification.supported ? classification.provider : undefined,
                    durationMs: Date.now() - fileStartedAt,
                });

                if (!classification.supported) {
                    ignoredArchives.push({
                        fileName: file.name,
                        reason: classification.reason,
                        message: classification.message ?? "Unsupported archive format.",
                    });
                    this.metadataLogger.debug(`Skipping unsupported archive`, {
                        fileName: file.name,
                        reason: classification.reason,
                        message: classification.message,
                        durationMs: Date.now() - fileStartedAt,
                    });
                    continue;
                }

                const metadata = await this.extractMetadataFromZip(
                    zip,
                    classification.provider ?? forcedProvider,
                    file.name,
                    i,
                    undefined
                );

                supportedFiles.push(file);
                allConversationsFound.push(...metadata);

                this.metadataLogger.debug(`Archive metadata extraction complete`, {
                    fileName: file.name,
                    provider: classification.provider,
                    conversationCount: metadata.length,
                    durationMs: Date.now() - fileStartedAt,
                });

                let duplicatesInFile = 0;
                let uniqueFromFile = 0;

                for (const conversation of metadata) {
                    const existing = conversationMap.get(conversation.id);

                    if (!existing) {
                        uniqueFromFile++;
                        conversationMap.set(conversation.id, conversation);
                        conversationToFileMap.set(conversation.id, file.name);
                        continue;
                    }

                    let shouldReplace = false;
                    const comparison = compareTimestampsIgnoringSeconds(
                        conversation.updateTime,
                        existing.updateTime
                    );

                    if (comparison > 0) {
                        shouldReplace = true;
                    } else if (comparison === 0) {
                        const currentFileIndex = conversation.sourceFileIndex || 0;
                        const existingFileIndex = existing.sourceFileIndex || 0;
                        if (currentFileIndex > existingFileIndex) {
                            shouldReplace = true;
                        }
                    }

                    if (shouldReplace) {
                        const oldFileName = conversationToFileMap.get(conversation.id)!;
                        const oldFileStats = fileStatsMap.get(oldFileName);
                        if (oldFileStats) {
                            oldFileStats.uniqueContributed--;
                            oldFileStats.duplicates++;
                        }

                        uniqueFromFile++;
                        conversationMap.set(conversation.id, conversation);
                        conversationToFileMap.set(conversation.id, file.name);
                    } else {
                        duplicatesInFile++;
                    }
                }

                fileStatsMap.set(file.name, {
                    fileName: file.name,
                    totalConversations: metadata.length,
                    duplicates: duplicatesInFile,
                    uniqueContributed: uniqueFromFile,
                    selectedForImport: 0,
                    newConversations: 0,
                    updatedConversations: 0,
                    skippedConversations: 0,
                });
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                const ignoredArchive = this.classifyReadFailure(file.name, message, forcedProvider);
                ignoredArchives.push(ignoredArchive);

                const logDetails = {
                    fileName: file.name,
                    fileSize: file.size,
                    durationMs: Date.now() - fileStartedAt,
                    reason: ignoredArchive.reason,
                    message,
                    userMessage: ignoredArchive.message,
                };
                if (ignoredArchive.reason === "read-error") {
                    this.metadataLogger.error(`Archive analysis failed and was ignored`, logDetails);
                } else {
                    this.metadataLogger.warn(`Archive analysis failed and was ignored`, logDetails);
                }
            }
        }

        const filterResult = this.filterConversationsForSelection(
            Array.from(conversationMap.values()),
            existingConversations
        );

        for (const conversation of filterResult.conversations) {
            const fileName = conversation.sourceFile;
            if (!fileName) continue;

            const stats = fileStatsMap.get(fileName);
            if (!stats) continue;

            stats.selectedForImport++;
            if (conversation.existenceStatus === "new") {
                stats.newConversations++;
            } else if (conversation.existenceStatus === "updated") {
                stats.updatedConversations++;
            }
        }

        for (const conversation of filterResult.ignoredConversations) {
            const fileName = conversation.sourceFile;
            if (!fileName) continue;

            const stats = fileStatsMap.get(fileName);
            if (stats) {
                stats.skippedConversations++;
            }
        }

        const result: MetadataExtractionResult = {
            conversations: filterResult.conversations,
            analysisInfo: {
                totalConversationsFound: allConversationsFound.length,
                uniqueConversationsKept: conversationMap.size,
                duplicatesRemoved: allConversationsFound.length - conversationMap.size,
                hasMultipleFiles: files.length > 1,
                conversationsNew: filterResult.newCount,
                conversationsUpdated: filterResult.updatedCount,
                conversationsIgnored: filterResult.ignoredCount,
            },
            fileStats: fileStatsMap,
            supportedFiles,
            ignoredArchives,
        };

        this.metadataLogger.debug(`Metadata extraction batch complete`, {
            fileCount: files.length,
            supportedFileCount: supportedFiles.length,
            ignoredArchiveCount: ignoredArchives.length,
            conversationCount: result.conversations.length,
            totalConversationsFound: allConversationsFound.length,
            durationMs: Date.now() - batchStartedAt,
        });

        return result;
    }

    private classifyReadFailure(
        fileName: string,
        message: string,
        forcedProvider?: string
    ): IgnoredArchiveInfo {
        const normalized = message.toLowerCase();
        const looksUnsupportedArchive =
            normalized.includes("central directory not found") ||
            normalized.includes("not a valid zip") ||
            normalized.includes("zip64") ||
            normalized.includes("object can not be found here") ||
            normalized.includes("notfounderror");

        if (looksUnsupportedArchive) {
            return {
                fileName,
                reason: "unsupported-format",
                message: this.getUnsupportedArchiveMessage(forcedProvider),
            };
        }

        return {
            fileName,
            reason: "read-error",
            message,
        };
    }

    private getUnsupportedArchiveMessage(forcedProvider?: string): string {
        if (forcedProvider === "chatgpt") {
            return getArchiveProviderMismatchMessage("chatgpt");
        }
        if (forcedProvider === "claude") {
            return getArchiveProviderMismatchMessage("claude");
        }
        if (forcedProvider === "lechat") {
            return getArchiveProviderMismatchMessage("lechat");
        }
        if (forcedProvider === "gemini") {
            return getArchiveProviderMismatchMessage("gemini");
        }
        if (forcedProvider === "perplexity") {
            return getArchiveProviderMismatchMessage("perplexity");
        }

        return getArchiveUnsupportedFormatMessage();
    }

    private extractSingleMetadataByProvider(rawConversation: any, provider: string): ConversationMetadata | null {
        const metadata = this.extractMetadataByProvider([rawConversation], provider);
        return metadata.length > 0 ? metadata[0] : null;
    }

    private extractMetadataByProvider(rawConversations: any[], provider: string): ConversationMetadata[] {
        switch (provider) {
            case "chatgpt":
                return this.extractChatGPTMetadata(rawConversations);
            case "claude":
                return this.extractClaudeMetadata(rawConversations);
            case "lechat":
                return this.extractLeChatMetadata(rawConversations);
            case "gemini":
                return this.extractGeminiMetadata(rawConversations);
            case "perplexity":
                return this.extractPerplexityMetadata(rawConversations);
            default:
                throw new Error(`Unsupported provider: ${provider}`);
        }
    }

    private extractChatGPTMetadata(conversations: Chat[]): ConversationMetadata[] {
        return conversations
            .filter(chat => {
                if (!chat.id || chat.id.trim() === "") {
                    this.plugin.logger.warn("Skipping ChatGPT conversation with missing ID", chat.title || "Untitled");
                    return false;
                }
                if (!chat.create_time || !chat.update_time) {
                    this.plugin.logger.warn("Skipping ChatGPT conversation with missing timestamps", chat.id);
                    return false;
                }
                return true;
            })
            .map(chat => ({
                id: chat.id,
                title: chat.title || "Untitled",
                createTime: chat.create_time,
                updateTime: chat.update_time,
                messageCount: this.countChatGPTMessages(chat),
                provider: "chatgpt",
                isStarred: chat.is_starred || false,
                isArchived: chat.is_archived || false,
            }))
            .filter(metadata => metadata.messageCount > 0);
    }

    private extractClaudeMetadata(conversations: ClaudeConversation[]): ConversationMetadata[] {
        return conversations
            .filter(chat => {
                if (!chat.uuid || chat.uuid.trim() === "") {
                    this.plugin.logger.warn("Skipping Claude conversation with missing UUID", chat.name || "Untitled");
                    return false;
                }
                if (!chat.created_at || !chat.updated_at) {
                    this.plugin.logger.warn("Skipping Claude conversation with missing timestamps", chat.uuid);
                    return false;
                }
                return true;
            })
            .map(chat => ({
                id: chat.uuid,
                title: chat.name || "Untitled",
                createTime: Math.floor(new Date(chat.created_at).getTime() / 1000),
                updateTime: Math.floor(new Date(chat.updated_at).getTime() / 1000),
                messageCount: this.countClaudeMessages(chat),
                provider: "claude",
                isStarred: chat.is_starred || false,
                isArchived: false,
            }))
            .filter(metadata => metadata.messageCount > 0);
    }

    private extractLeChatMetadata(conversations: any[]): ConversationMetadata[] {
        return conversations
            .filter(chat => {
                if (!Array.isArray(chat) || chat.length === 0) {
                    this.plugin.logger.warn("Skipping invalid Le Chat conversation: not an array or empty");
                    return false;
                }

                const firstMessage = chat[0];
                if (!firstMessage.chatId || !firstMessage.createdAt) {
                    this.plugin.logger.warn("Skipping Le Chat conversation with missing chatId or createdAt");
                    return false;
                }

                return true;
            })
            .map(chat => {
                const sortedChat = [...chat].sort((a: any, b: any) => {
                    const timeA = new Date(a.createdAt).getTime();
                    const timeB = new Date(b.createdAt).getTime();
                    return timeA - timeB;
                });

                const chatId = sortedChat[0].chatId;
                const title = deriveLeChatConversationTitle(sortedChat as any, { assumeSorted: true });

                const timestamps = sortedChat.map((msg: any) => new Date(msg.createdAt).getTime() / 1000);

                return {
                    id: chatId,
                    title,
                    createTime: Math.floor(Math.min(...timestamps)),
                    updateTime: Math.floor(Math.max(...timestamps)),
                    messageCount: sortedChat.length,
                    provider: "lechat",
                    isStarred: false,
                    isArchived: false,
                };
            })
            .filter(metadata => metadata.messageCount > 0);
    }

    private extractGeminiMetadata(entries: any[]): ConversationMetadata[] {
        return entries
            .filter(entry => {
                if (!entry.time || !entry.title) {
                    this.plugin.logger.warn("Skipping Gemini entry with missing time or title");
                    return false;
                }

                const hasHtmlContent = entry.safeHtmlItem && entry.safeHtmlItem.length > 0;
                const hasAttachments = entry.attachedFiles && entry.attachedFiles.length > 0;
                return hasHtmlContent || hasAttachments;
            })
            .map(entry => {
                const adapter = this.providerRegistry.getAdapter("gemini");
                if (!adapter) {
                    throw new Error("Gemini adapter not found in registry");
                }

                return {
                    id: adapter.getId(entry),
                    title: adapter.getTitle(entry),
                    createTime: adapter.getCreateTime(entry),
                    updateTime: adapter.getUpdateTime(entry),
                    messageCount: 2,
                    provider: "gemini",
                    isStarred: false,
                    isArchived: false,
                };
            });
    }

    private extractPerplexityMetadata(conversations: any[]): ConversationMetadata[] {
        return conversations
            .filter(chat => {
                const normalized = normalizePerplexityConversationFile(chat);
                if (!normalized) {
                    this.plugin.logger.warn("Skipping invalid Perplexity conversation: not an object");
                    return false;
                }

                if (!normalized.metadata?.thread_id || !Array.isArray(normalized.conversations)) {
                    this.plugin.logger.warn("Skipping Perplexity conversation with missing normalized metadata.thread_id or conversations[]");
                    return false;
                }

                return normalized.conversations.length > 0;
            })
            .map(chat => {
                const normalized = normalizePerplexityConversationFile(chat)!;
                const turns = [...normalized.conversations].sort((a: any, b: any) => {
                    const timeA = new Date(a.timestamp || 0).getTime();
                    const timeB = new Date(b.timestamp || 0).getTime();
                    return timeA - timeB;
                });

                const timestamps = turns
                    .map((turn: any) => new Date(turn.timestamp || 0).getTime())
                    .filter((ts: number) => Number.isFinite(ts) && ts > 0);

                const metaCreateMs = new Date(normalized.metadata?.thread_created_at || "").getTime();
                const metaUpdateMs = new Date(normalized.metadata?.thread_updated_at || "").getTime();
                const createTime = Number.isFinite(metaCreateMs) && metaCreateMs > 0
                    ? Math.floor(metaCreateMs / 1000)
                    : timestamps.length > 0 ? Math.floor(Math.min(...timestamps) / 1000) : 0;
                const updateTime = Number.isFinite(metaUpdateMs) && metaUpdateMs > 0
                    ? Math.floor(metaUpdateMs / 1000)
                    : timestamps.length > 0 ? Math.floor(Math.max(...timestamps) / 1000) : 0;
                const messageCount = turns.reduce((count: number, turn: any) => {
                    const query = typeof turn.query === "string" ? turn.query.trim() : "";
                    const answer = typeof turn.answer === "string" ? turn.answer.trim() : "";
                    return count + (query ? 1 : 0) + (answer ? 1 : 0);
                }, 0);

                return {
                    id: normalized.metadata.thread_id || "",
                    title: (normalized.metadata.thread_title || "Untitled").trim() || "Untitled",
                    createTime,
                    updateTime,
                    messageCount,
                    provider: "perplexity",
                    isStarred: false,
                    isArchived: false,
                };
            })
            .filter(metadata => metadata.messageCount > 0);
    }

    private countChatGPTMessages(chat: Chat): number {
        if (!chat.mapping) {
            return 0;
        }

        let count = 0;
        for (const messageObj of Object.values(chat.mapping)) {
            const message = messageObj?.message;
            if (message && this.shouldIncludeChatGPTMessage(message)) {
                count++;
            }
        }

        return count;
    }

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

    private shouldIncludeChatGPTMessage(message: any): boolean {
        if (!message || !message.author) {
            return false;
        }

        if (message.author.role === "system" || message.author.role === "tool") {
            return false;
        }

        if (message.metadata?.is_visually_hidden_from_conversation === true) {
            return false;
        }

        return isValidMessage(message);
    }

    private shouldIncludeClaudeMessage(message: any): boolean {
        if (!message || !message.uuid || !message.sender) {
            return false;
        }

        return message.sender === "human" || message.sender === "assistant";
    }

    private filterConversationsForSelection(
        bestVersions: ConversationMetadata[],
        existingConversations?: Map<string, any>
    ): {
        conversations: ConversationMetadata[];
        ignoredConversations: ConversationMetadata[];
        newCount: number;
        updatedCount: number;
        ignoredCount: number;
    } {
        const conversationsForSelection: ConversationMetadata[] = [];
        const ignoredConversations: ConversationMetadata[] = [];
        let newCount = 0;
        let updatedCount = 0;
        let ignoredCount = 0;

        for (const conversation of bestVersions) {
            if (!existingConversations) {
                conversation.existenceStatus = "new";
                conversation.hasNewerContent = true;
                conversationsForSelection.push(conversation);
                newCount++;
                continue;
            }

            const vaultConversation = existingConversations.get(conversation.id);
            if (!vaultConversation) {
                conversation.existenceStatus = "new";
                conversation.hasNewerContent = true;
                conversationsForSelection.push(conversation);
                newCount++;
                continue;
            }

            conversation.existingUpdateTime = vaultConversation.updateTime;

            const { moment } = require("obsidian");
            const zipUpdateTimeISO = new Date(conversation.updateTime * 1000).toISOString();
            const normalizedZipUpdateTime = moment(zipUpdateTimeISO, moment.ISO_8601, true).unix();
            const comparison = compareTimestampsIgnoringSeconds(
                normalizedZipUpdateTime,
                vaultConversation.updateTime
            );

            if (comparison > 0) {
                conversation.existenceStatus = "updated";
                conversation.hasNewerContent = true;
                conversationsForSelection.push(conversation);
                updatedCount++;
            } else {
                conversation.existenceStatus = "unchanged";
                ignoredConversations.push(conversation);
                ignoredCount++;
            }
        }

        return {
            conversations: conversationsForSelection,
            ignoredConversations,
            newCount,
            updatedCount,
            ignoredCount,
        };
    }
}
