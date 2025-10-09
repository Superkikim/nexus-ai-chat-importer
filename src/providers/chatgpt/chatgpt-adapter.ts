// src/providers/chatgpt/chatgpt-adapter.ts
import JSZip from "jszip";
import { ProviderAdapter } from "../provider-adapter";
import { StandardConversation, StandardMessage } from "../../types/standard";
import { ChatGPTConverter } from "./chatgpt-converter";
import { ChatGPTAttachmentExtractor } from "./chatgpt-attachment-extractor";
import { ChatGPTReportNamingStrategy } from "./chatgpt-report-naming";
import { ChatGPTDalleProcessor } from "./chatgpt-dalle-processor";
import { Chat, ChatMessage } from "./chatgpt-types";
import { isValidMessage } from "../../utils";
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

        // Extract DALL-E prompts using centralized processor
        const dallePrompts = ChatGPTDalleProcessor.extractDallePromptsFromMapping(chat);

        for (const messageObj of Object.values(chat.mapping)) {
            if (messageObj?.id && !existingMessageIds.includes(messageObj.id)) {
                const message = messageObj.message;
                if (!message) continue;

                // Handle DALL-E tool messages using processor
                if (message.author?.role === "tool" && ChatGPTDalleProcessor.hasRealDalleImage(message)) {
                    const prompt = dallePrompts.get(messageObj.id || "");
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
                } else if (this.shouldIncludeMessage(message)) {
                    // Regular user/assistant messages with enhanced filtering
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



    /**
     * Determine if a message should be included - same logic as ChatGPTConverter
     */
    private shouldIncludeMessage(message: any): boolean {
        // Safety check
        if (!message || !message.author) {
            return false;
        }
        
        // Skip ALL system messages
        if (message.author.role === "system") {
            return false;
        }
        
        // Skip ALL tool messages
        if (message.author.role === "tool") {
            return false;
        }
        
        // Skip hidden messages
        if (message.metadata?.is_visually_hidden_from_conversation === true) {
            return false;
        }
        
        // Skip user system messages
        if (message.metadata?.is_user_system_message === true) {
            return false;
        }
        
        // Skip user_editable_context content type
        if (message.content?.content_type === "user_editable_context") {
            return false;
        }
        
        // Assistant message filtering
        if (message.author.role === "assistant") {
            // Skip empty assistant messages
            if (message.content?.parts && 
                Array.isArray(message.content.parts) &&
                message.content.parts.every((part: any) => 
                    typeof part === "string" && part.trim() === ""
                )) {
                return false;
            }
            
            // Skip assistant messages that are just DALL-E JSON prompts
            if (message.content?.parts && 
                Array.isArray(message.content.parts) &&
                message.content.parts.length === 1 &&
                typeof message.content.parts[0] === "string") {
                
                const content = message.content.parts[0].trim();
                if (content.startsWith('{') && content.includes('"prompt"')) {
                    return false;
                }
            }
            
            // Skip various technical content types
            const excludedContentTypes = ["code", "system_error", "execution_output"];
            if (message.content?.content_type && excludedContentTypes.includes(message.content.content_type)) {
                return false;
            }
            
            // For multimodal_text, check if it has actual text content
            if (message.content?.content_type === "multimodal_text") {
                if (message.content?.parts && Array.isArray(message.content.parts)) {
                    const hasTextContent = message.content.parts.some((part: any) => {
                        if (typeof part === "string" && part.trim() !== "") {
                            return true;
                        }
                        if (typeof part === "object" && part !== null && 'text' in part) {
                            return typeof part.text === "string" && part.text.trim() !== "";
                        }
                        return false;
                    });
                    
                    if (!hasTextContent) {
                        return false;
                    }
                }
            }
        }
        
        // User message filtering
        if (message.author.role === "user") {
            const excludedContentTypes = ["user_editable_context"];
            
            if (message.content?.content_type && excludedContentTypes.includes(message.content.content_type)) {
                return false;
            }
        }
        
        // Final validation using existing function
        return isValidMessage(message);
    }
}
