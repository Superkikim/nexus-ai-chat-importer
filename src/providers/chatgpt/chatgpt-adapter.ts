// src/providers/chatgpt/chatgpt-adapter.ts
import JSZip from "jszip";
import { ProviderAdapter } from "../provider-adapter";
import { StandardConversation, StandardMessage } from "../../types/standard";
import { ChatGPTConverter } from "./chatgpt-converter";
import { ChatGPTAttachmentExtractor } from "./chatgpt-attachment-extractor";
import { ChatGPTReportNamingStrategy } from "./chatgpt-report-naming";
import { ChatGPTDalleProcessor } from "./chatgpt-dalle-processor";
import { ChatGPTMessageFilter } from "./chatgpt-message-filter";
import { Chat, ChatMessage } from "./chatgpt-types";
import type NexusAiChatImporterPlugin from "../../main";

export class ChatGPTAdapter implements ProviderAdapter<Chat> {
    private attachmentExtractor: ChatGPTAttachmentExtractor;
    private reportNamingStrategy: ChatGPTReportNamingStrategy;

    constructor(private plugin: NexusAiChatImporterPlugin) {
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
                    const prompt = imagePrompts.get(messageObj.id || "");
                    const dalleMessage = ChatGPTDalleProcessor.createDalleAssistantMessage(message, prompt);
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

    async processMessageAttachments(
        messages: StandardMessage[],
        conversationId: string,
        zip: JSZip
    ): Promise<StandardMessage[]> {
        const processedMessages: StandardMessage[] = [];

        for (const message of messages) {
            if (message.attachments && message.attachments.length > 0) {
                const processedAttachments = await this.attachmentExtractor.extractAttachments(
                    zip,
                    conversationId,
                    message.attachments,
                    message.id // Pass message ID for better logging
                );

                processedMessages.push({
                    ...message,
                    attachments: processedAttachments
                });
            } else {
                processedMessages.push(message);
            }
        }

        return processedMessages;
    }

    getReportNamingStrategy() {
        return this.reportNamingStrategy;
    }




}
