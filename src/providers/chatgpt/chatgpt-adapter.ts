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

// src/providers/chatgpt/chatgpt-adapter.ts
import {
    StandardConversation,
    StandardMessage,
    StandardAttachment,
} from "../../types/standard";
import { ChatGPTConverter } from "./chatgpt-converter";
import { ChatGPTAttachmentExtractor } from "./chatgpt-attachment-extractor";
import { ChatGPTReportNamingStrategy } from "./chatgpt-report-naming";
import { ChatGPTDalleProcessor } from "./chatgpt-dalle-processor";
import { ChatGPTMessageFilter } from "./chatgpt-message-filter";
import {
    buildChatGPTLibraryIndex,
    ChatGPTLibraryIndex,
} from "./chatgpt-library-index";
import { Chat, ChatMessage } from "./chatgpt-types";
import { sanitizeFileName } from "../../utils/file-utils";
import { ZipArchiveReader } from "../../utils/zip-loader";
import type NexusAiChatImporterPlugin from "../../main";
import {
    BaseProviderAdapter,
    AttachmentExtractor,
} from "../base/base-provider-adapter";

export class ChatGPTAdapter extends BaseProviderAdapter<Chat> {
    private attachmentExtractor: ChatGPTAttachmentExtractor;
    private reportNamingStrategy: ChatGPTReportNamingStrategy;
    // Cache the library index per ZIP so it is parsed once per import.
    private libraryIndexCache = new WeakMap<
        ZipArchiveReader,
        Promise<ChatGPTLibraryIndex | null>
    >();

    constructor(private plugin: NexusAiChatImporterPlugin) {
        super(); // Call parent constructor
        this.attachmentExtractor = new ChatGPTAttachmentExtractor(
            plugin,
            plugin.logger
        );
        this.reportNamingStrategy = new ChatGPTReportNamingStrategy();
    }

    detect(rawConversations: any[]): boolean {
        if (rawConversations.length === 0) return false;

        const sample = rawConversations[0];

        // ChatGPT detection: has mapping property and typical structure
        return !!(
            sample.mapping &&
            sample.create_time &&
            sample.update_time &&
            sample.title
        );
    }

    getId(chat: Chat): string {
        return chat.id || "";
    }

    getTitle(chat: Chat): string {
        return chat.title || "Untitled";
    }

    getCreateTime(chat: Chat): number {
        return chat.create_time || 0;
    }

    getUpdateTime(chat: Chat): number {
        return chat.update_time || 0;
    }

    convertChat(chat: Chat): StandardConversation {
        return ChatGPTConverter.convertChat(chat);
    }

    getProviderName(): string {
        return "chatgpt";
    }

    getNewMessages(chat: Chat, existingMessageIds: string[]): ChatMessage[] {
        const newMessages: ChatMessage[] = [];

        // Extract DALL-E prompts using centralized processor (with orphaned prompts support)
        const { imagePrompts, orphanedPrompts } =
            ChatGPTDalleProcessor.extractDallePromptsFromMapping(chat);

        for (const messageObj of Object.values(chat.mapping)) {
            if (messageObj?.id && !existingMessageIds.includes(messageObj.id)) {
                const message = messageObj.message;
                if (!message) continue;

                // Handle DALL-E tool messages with images using processor
                if (
                    message.author?.role === "tool" &&
                    ChatGPTDalleProcessor.hasRealDalleImage(message)
                ) {
                    const promptData = imagePrompts.get(messageObj.id || "");
                    const dalleMessage =
                        ChatGPTDalleProcessor.createDalleAssistantMessage(
                            message,
                            promptData?.prompt,
                            promptData?.timestamp
                        );
                    if (dalleMessage) {
                        // Convert StandardMessage back to ChatMessage for compatibility
                        const chatMessage: ChatMessage = {
                            id: dalleMessage.id,
                            author: { role: dalleMessage.role },
                            content: { parts: [dalleMessage.content] },
                            create_time: dalleMessage.timestamp,
                            attachments: dalleMessage.attachments?.map(
                                (att) => ({
                                    file_name: att.fileName,
                                    file_size: att.fileSize,
                                    file_type: att.fileType,
                                    extracted_content: att.extractedContent,
                                })
                            ),
                        };
                        newMessages.push(chatMessage);
                    }
                }
                // Handle orphaned DALL-E prompts (no image found)
                else if (orphanedPrompts.has(messageObj.id || "")) {
                    const prompt = orphanedPrompts.get(messageObj.id || "");
                    if (prompt) {
                        const orphanedMessage =
                            ChatGPTDalleProcessor.createOrphanedPromptMessage(
                                message,
                                prompt
                            );
                        const chatMessage: ChatMessage = {
                            id: orphanedMessage.id,
                            author: { role: orphanedMessage.role },
                            content: { parts: [orphanedMessage.content] },
                            create_time: orphanedMessage.timestamp,
                        };
                        newMessages.push(chatMessage);
                    }
                }
                // Regular user/assistant messages with enhanced filtering
                else if (ChatGPTMessageFilter.shouldIncludeMessage(message)) {
                    newMessages.push(message);
                }
            }
        }

        return newMessages;
    }

    /**
     * ChatGPT-specific ZIP entry filter.
     *
     * ChatGPT exports can contain gigabytes of voice-recording files (.dat)
     * and audio/video files that are NOT user-uploaded attachments. Keeping
     * an entry only costs its central-directory metadata (both ZIP readers
     * are lazy), but filtering avoids polluting attachment lookups.
     *
     * Rules (first match wins):
     *  1. Small files (<1 MB) — always keep (JSON, metadata, tiny assets)
     *  2. User-uploaded attachments (basename starts with file- or file_) — keep
     *  3. Audio / video extensions — skip
     *  4. .dat files not matching user-attachment pattern — skip (voice recordings)
     *  5. Everything else — keep
     *
     * New 2026 export format: ALL attachments (including voice WAVs) are named
     * file[-_]<id>.dat and pass rule 2. Voice recordings are skipped later by
     * the attachment extractor — via the conversation_asset_file_names.json
     * index (isAudio) or RIFF/WAVE magic-byte detection — and are never read
     * unless a conversation actually references them.
     */
    shouldIncludeZipEntry(
        entryName: string,
        uncompressedSize: number
    ): boolean {
        // Rule 1: small files regardless of type
        if (uncompressedSize < 1 * 1024 * 1024) return true;

        const baseName = entryName.split("/").pop() ?? entryName;
        const ext = baseName.includes(".")
            ? baseName.split(".").pop()!.toLowerCase()
            : "";

        // Rule 2: user-uploaded attachments (IDs are case-sensitive — test original baseName)
        const USER_ATTACHMENT = /^file[-_][A-Za-z0-9]/;
        if (USER_ATTACHMENT.test(baseName)) return true;

        // Rule 3: audio / video — skip
        const AUDIO_VIDEO = new Set([
            "mp3",
            "m4a",
            "mp4",
            "webm",
            "ogg",
            "aac",
            "wav",
            "flac",
            "opus",
            "wma",
            "mov",
            "avi",
            "mkv",
        ]);
        if (AUDIO_VIDEO.has(ext)) return false;

        // Rule 4: .dat not matching user-attachment pattern — skip (voice recordings)
        if (ext === "dat") return false;

        // Rule 5: default keep
        return true;
    }

    /**
     * Provide ChatGPT-specific attachment extractor
     */
    protected getAttachmentExtractor(): AttachmentExtractor {
        return this.attachmentExtractor;
    }

    /**
     * Inject Canvas-generated library files (linked by origination_message_id),
     * then run the shared attachment extraction. Canvas documents (e.g. a
     * generated .docx) live in library_files.json rather than the message's
     * metadata.attachments, so they would otherwise never be imported.
     */
    async processMessageAttachments(
        messages: StandardMessage[],
        conversationId: string,
        zip: ZipArchiveReader
    ): Promise<StandardMessage[]> {
        const libraryIndex = await this.getLibraryIndex(zip);
        const prepared = libraryIndex
            ? messages.map((message) =>
                  this.injectLibraryAttachments(message, libraryIndex, zip)
              )
            : messages;

        return super.processMessageAttachments(prepared, conversationId, zip);
    }

    private getLibraryIndex(
        zip: ZipArchiveReader
    ): Promise<ChatGPTLibraryIndex | null> {
        let cached = this.libraryIndexCache.get(zip);
        if (!cached) {
            cached = buildChatGPTLibraryIndex(zip);
            this.libraryIndexCache.set(zip, cached);
        }
        return cached;
    }

    /**
     * Attach library files whose origination_message_id matches this message,
     * skipping anything already present (by fileId) and anything whose payload
     * is not actually in the ZIP (avoids spurious "missing" entries).
     */
    private injectLibraryAttachments(
        message: StandardMessage,
        libraryIndex: ChatGPTLibraryIndex,
        zip: ZipArchiveReader
    ): StandardMessage {
        if (!message.id) return message;

        const entries = libraryIndex.byOriginationMessageId.get(message.id);
        if (!entries || entries.length === 0) return message;

        const existing = message.attachments ?? [];
        const seenFileIds = new Set(
            existing.map((att) => att.fileId).filter(Boolean) as string[]
        );

        const additions: StandardAttachment[] = [];
        for (const entry of entries) {
            if (seenFileIds.has(entry.fileId)) continue;
            if (!zip.has(`${entry.fileId}.dat`)) continue;

            const baseName = entry.fileName.split("/").pop() || entry.fileName;
            additions.push({
                fileName: sanitizeFileName(baseName),
                fileType: entry.mimeType || "application/octet-stream",
                fileId: entry.fileId,
            });
            seenFileIds.add(entry.fileId);
        }

        if (additions.length === 0) return message;

        return { ...message, attachments: [...existing, ...additions] };
    }

    getReportNamingStrategy() {
        return this.reportNamingStrategy;
    }

    /**
     * Set attachment map for multi-ZIP support
     */
    setAttachmentMap(attachmentMap: any, allZips: any[]): void {
        this.attachmentExtractor.setAttachmentMap(attachmentMap, allZips);
    }

    /**
     * Clear attachment map after import completes
     */
    clearAttachmentMap(): void {
        this.attachmentExtractor.clearAttachmentMap();
    }
}
