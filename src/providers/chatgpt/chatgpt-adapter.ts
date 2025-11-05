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
import JSZip from "jszip";
import { StandardConversation, StandardMessage } from "../../types/standard";
import { ChatGPTConverter } from "./chatgpt-converter";
import { ChatGPTAttachmentExtractor } from "./chatgpt-attachment-extractor";
import { ChatGPTReportNamingStrategy } from "./chatgpt-report-naming";
import { ChatGPTDalleProcessor } from "./chatgpt-dalle-processor";
import { ChatGPTMessageFilter } from "./chatgpt-message-filter";
import { Chat, ChatMessage } from "./chatgpt-types";
import type NexusAiChatImporterPlugin from "../../main";
import { BaseProviderAdapter, AttachmentExtractor } from "../base/base-provider-adapter";

export class ChatGPTAdapter extends BaseProviderAdapter<Chat> {
    private attachmentExtractor: ChatGPTAttachmentExtractor;
    private reportNamingStrategy: ChatGPTReportNamingStrategy;

    constructor(private plugin: NexusAiChatImporterPlugin) {
        super(); // Call parent constructor
        this.attachmentExtractor = new ChatGPTAttachmentExtractor(plugin, plugin.logger);
        this.reportNamingStrategy = new ChatGPTReportNamingStrategy();
    }

    detect(rawConversations: any[]): boolean {
        if (rawConversations.length === 0) return false;
        
        const sample = rawConversations[0];
        
        // ChatGPT detection: has mapping property and typical structure
        return !!(sample.mapping && sample.create_time && sample.update_time && sample.title);
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
        const { imagePrompts, orphanedPrompts } = ChatGPTDalleProcessor.extractDallePromptsFromMapping(chat);

        for (const messageObj of Object.values(chat.mapping)) {
            if (messageObj?.id && !existingMessageIds.includes(messageObj.id)) {
                const message = messageObj.message;
                if (!message) continue;

                // Handle DALL-E tool messages with images using processor
                if (message.author?.role === "tool" && ChatGPTDalleProcessor.hasRealDalleImage(message)) {
                    const promptData = imagePrompts.get(messageObj.id || "");
                    const dalleMessage = ChatGPTDalleProcessor.createDalleAssistantMessage(
                        message,
                        promptData?.prompt,
                        promptData?.timestamp
                    );
                    if (dalleMessage) {
                        // Convert StandardMessage back to ChatMessage for compatibility
                        const chatMessage: ChatMessage = {
                            id: dalleMessage.id,
                            author: { role: dalleMessage.role as any },
                            content: { parts: [dalleMessage.content] },
                            create_time: dalleMessage.timestamp,
                            attachments: dalleMessage.attachments?.map(att => ({
                                file_name: att.fileName,
                                file_size: att.fileSize,
                                file_type: att.fileType,
                                extracted_content: att.extractedContent
                            }))
                        };
                        newMessages.push(chatMessage);
                    }
                }
                // Handle orphaned DALL-E prompts (no image found)
                else if (orphanedPrompts.has(messageObj.id || "")) {
                    const prompt = orphanedPrompts.get(messageObj.id || "");
                    if (prompt) {
                        const orphanedMessage = ChatGPTDalleProcessor.createOrphanedPromptMessage(message, prompt);
                        const chatMessage: ChatMessage = {
                            id: orphanedMessage.id,
                            author: { role: orphanedMessage.role as any },
                            content: { parts: [orphanedMessage.content] },
                            create_time: orphanedMessage.timestamp
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
     * Provide ChatGPT-specific attachment extractor
     * The actual processMessageAttachments() logic is inherited from BaseProviderAdapter
     */
    protected getAttachmentExtractor(): AttachmentExtractor {
        return this.attachmentExtractor;
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
