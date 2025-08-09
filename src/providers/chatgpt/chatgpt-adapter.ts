// src/providers/chatgpt/chatgpt-adapter.ts
import JSZip from "jszip";
import { ProviderAdapter } from "../provider-adapter";
import { StandardConversation, StandardMessage } from "../../types/standard";
import { ChatGPTConverter } from "./chatgpt-converter";
import { ChatGPTAttachmentExtractor } from "./chatgpt-attachment-extractor";
import { ChatGPTReportNamingStrategy } from "./chatgpt-report-naming";
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

    convertMessages(messages: ChatMessage[], conversationId?: string): StandardMessage[] {
        return ChatGPTConverter.convertMessages(messages, conversationId);
    }

    getProviderName(): string {
        return "chatgpt";
    }

    getNewMessages(chat: Chat, existingMessageIds: string[]): ChatMessage[] {
        const newMessages: ChatMessage[] = [];
        
        for (const messageObj of Object.values(chat.mapping)) {
            if (messageObj?.id && !existingMessageIds.includes(messageObj.id)) {
                const message = messageObj.message;
                if (!message) continue;

                // Apply same filtering logic as in ChatGPTConverter.extractMessagesFromMapping
                if (message.author?.role === "tool" && this.hasRealDalleImage(message)) {
                    // Create Assistant (DALL-E) message for real DALL-E generations
                    const dalleMessage = this.createDalleAssistantMessage(message);
                    if (dalleMessage) {
                        newMessages.push(dalleMessage);
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
                    message.attachments
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
     * Check if message contains REAL DALL-E image (not user upload)
     */
    private hasRealDalleImage(message: any): boolean {
        if (!message.content?.parts || !Array.isArray(message.content.parts)) {
            return false;
        }
        
        return message.content.parts.some((part: any) => {
            if (typeof part !== "object" || part === null) return false;
            
            return part.content_type === "image_asset_pointer" && 
                   part.asset_pointer &&
                   part.metadata?.dalle && 
                   part.metadata.dalle !== null;
        });
    }

    /**
     * Create Assistant (DALL-E) message from tool message
     */
    private createDalleAssistantMessage(toolMessage: any): ChatMessage | null {
        if (!toolMessage.content?.parts || !Array.isArray(toolMessage.content.parts)) {
            return null;
        }

        const attachments: any[] = [];
        
        for (const part of toolMessage.content.parts) {
            if (typeof part === "object" && part !== null) {
                if (part.content_type === "image_asset_pointer" && 
                    part.asset_pointer &&
                    part.metadata?.dalle &&
                    part.metadata.dalle !== null) {
                    
                    // Extract file ID from asset pointer
                    let fileId = part.asset_pointer;
                    if (fileId.includes('://')) {
                        fileId = fileId.split('://')[1];
                    }

                    // Generate descriptive filename
                    const genId = part.metadata.dalle.gen_id || 'unknown';
                    const width = part.width || 1024;
                    const height = part.height || 1024;
                    const fileName = `dalle_${genId}_${width}x${height}.png`;

                    const dalleAttachment = {
                        fileName: fileName,
                        fileSize: part.size_bytes,
                        fileType: "image/png",
                        fileId: fileId,
                        extractedContent: part.metadata.dalle.prompt
                    };
                    
                    attachments.push(dalleAttachment);
                }
            }
        }

        if (attachments.length === 0) {
            return null;
        }

        return {
            id: toolMessage.id || "",
            author: { role: "assistant" },
            content: {
                parts: ["Image générée par DALL-E"],
                content_type: "text"
            },
            create_time: toolMessage.create_time || 0,
            attachments: attachments
        };
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
