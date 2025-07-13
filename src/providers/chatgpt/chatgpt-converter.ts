// src/providers/chatgpt/chatgpt-converter.ts
import { Chat, ChatMessage, ChatGPTAttachment, ContentPart } from "./chatgpt-types";
import { StandardConversation, StandardMessage, StandardAttachment } from "../../types/standard";
import { isValidMessage } from "../../utils";

export class ChatGPTConverter {
    /**
     * Convert ChatGPT Chat to StandardConversation
     */
    static convertChat(chat: Chat): StandardConversation {
        const messages = this.extractMessagesFromMapping(chat);
        
        return {
            id: chat.id,
            title: chat.title,
            provider: "chatgpt",
            createTime: chat.create_time,
            updateTime: chat.update_time,
            messages: messages,
            metadata: {
                conversation_template_id: chat.conversation_template_id,
                gizmo_id: chat.gizmo_id,
                gizmo_type: chat.gizmo_type,
                default_model_slug: chat.default_model_slug,
                is_archived: chat.is_archived,
                is_starred: chat.is_starred,
                current_node: chat.current_node,
                memory_scope: chat.memory_scope
            }
        };
    }

    /**
     * Convert array of ChatGPT ChatMessages to StandardMessages
     */
    static convertMessages(chatMessages: ChatMessage[]): StandardMessage[] {
        return chatMessages
            .filter(msg => isValidMessage(msg))
            .map(msg => this.convertMessage(msg));
    }

    /**
     * Convert single ChatGPT ChatMessage to StandardMessage
     */
    private static convertMessage(chatMessage: ChatMessage): StandardMessage {
        return {
            id: chatMessage.id,
            role: chatMessage.author.role === "user" ? "user" : "assistant",
            content: this.extractContent(chatMessage),
            timestamp: chatMessage.create_time,
            attachments: this.convertAttachments(chatMessage)
        };
    }

    /**
     * Convert ChatGPT attachments to StandardAttachments - NOW WITH DALL-E SUPPORT
     */
    private static convertAttachments(chatMessage: ChatMessage): StandardAttachment[] {
        const attachments: StandardAttachment[] = [];

        // Process attachments from metadata (new format)
        if (chatMessage.metadata?.attachments && Array.isArray(chatMessage.metadata.attachments)) {
            for (const attachment of chatMessage.metadata.attachments) {
                const standardAttachment = {
                    fileName: attachment.name,
                    fileSize: attachment.size,
                    fileType: attachment.mime_type,
                    fileId: attachment.id // ChatGPT file ID for ZIP lookup
                };
                attachments.push(standardAttachment);
            }
        }

        // Process legacy attachments array if present
        if (chatMessage.attachments && Array.isArray(chatMessage.attachments)) {
            for (const attachment of chatMessage.attachments) {
                // Only add if not already processed from metadata
                const alreadyExists = attachments.some(att => att.fileName === attachment.file_name);
                if (!alreadyExists) {
                    const standardAttachment = {
                        fileName: attachment.file_name,
                        fileSize: attachment.file_size,
                        fileType: attachment.file_type,
                        extractedContent: attachment.extracted_content
                    };
                    attachments.push(standardAttachment);
                }
            }
        }

        // Process files array if present (simpler structure)
        if (chatMessage.files && Array.isArray(chatMessage.files)) {
            for (const file of chatMessage.files) {
                // Only add if not already processed from attachments array
                const alreadyExists = attachments.some(att => att.fileName === file.file_name);
                if (!alreadyExists) {
                    const standardAttachment = {
                        fileName: file.file_name
                    };
                    attachments.push(standardAttachment);
                }
            }
        }

        // *** NEW: Process DALL-E generated images ***
        if (chatMessage.content?.parts && Array.isArray(chatMessage.content.parts)) {
            for (const part of chatMessage.content.parts) {
                if (typeof part === "object" && part !== null && 
                    (part as ContentPart).content_type === "image_asset_pointer" && 
                    (part as ContentPart).asset_pointer) {
                    
                    const dalleAttachment = this.convertDalleImage(part as ContentPart);
                    if (dalleAttachment) {
                        attachments.push(dalleAttachment);
                    }
                }
            }
        }

        return attachments;
    }

    /**
     * Convert DALL-E image asset pointer to StandardAttachment
     */
    private static convertDalleImage(imagePart: ContentPart): StandardAttachment | null {
        if (!imagePart.asset_pointer) return null;

        // Extract file ID from asset pointer
        // Examples: 
        // "sediment://file_00000000797851f6b6d36db4894cab3b"
        // "file-service://file-2CCzBDHWNCL434hx9TvkMu"
        let fileId = imagePart.asset_pointer;
        
        // Extract just the file identifier
        if (fileId.includes('://')) {
            fileId = fileId.split('://')[1];
        }
        if (fileId.startsWith('file_') || fileId.startsWith('file-')) {
            // Keep as is - this will be used for ZIP lookup
        }

        // Generate descriptive filename
        const genId = imagePart.metadata?.dalle?.gen_id || 'unknown';
        const width = imagePart.width || 1024;
        const height = imagePart.height || 1024;
        const fileName = `dalle_${genId}_${width}x${height}.png`;

        return {
            fileName: fileName,
            fileSize: imagePart.size_bytes,
            fileType: "image/png", // DALL-E generates PNG by default
            fileId: fileId, // For ZIP lookup in dalle-generations/
            extractedContent: imagePart.metadata?.dalle?.prompt // Include the generation prompt
        };
    }

    /**
     * Convert single ChatGPT attachment to StandardAttachment
     */
    private static convertSingleAttachment(attachment: ChatGPTAttachment): StandardAttachment {
        return {
            fileName: attachment.file_name,
            fileSize: attachment.file_size,
            fileType: attachment.file_type,
            extractedContent: attachment.extracted_content
        };
    }

    /**
     * Extract messages from ChatGPT mapping structure
     */
    private static extractMessagesFromMapping(chat: Chat): StandardMessage[] {
        // First pass: extract all attachments from tool messages and associate them
        const attachmentsByParent = this.extractAttachmentsFromToolMessages(chat);
        
        const messages: StandardMessage[] = [];
        
        for (const messageObj of Object.values(chat.mapping)) {
            if (messageObj?.message && this.shouldIncludeMessage(messageObj.message)) {
                const standardMessage = this.convertMessage(messageObj.message);
                
                // Add attachments from associated tool messages
                const toolAttachments = attachmentsByParent.get(messageObj.id) || [];
                if (standardMessage.attachments) {
                    standardMessage.attachments.push(...toolAttachments);
                } else {
                    standardMessage.attachments = toolAttachments;
                }
                
                messages.push(standardMessage);
            }
        }
        
        // Sort by timestamp to maintain order
        return messages.sort((a, b) => a.timestamp - b.timestamp);
    }

    /**
     * Extract attachments from tool messages and map them to their parent messages
     */
    private static extractAttachmentsFromToolMessages(chat: Chat): Map<string, StandardAttachment[]> {
        const attachmentsByParent = new Map<string, StandardAttachment[]>();
        
        for (const messageObj of Object.values(chat.mapping)) {
            const message = messageObj?.message;
            if (!message || message.author?.role !== "tool") continue;
            
            const attachments: StandardAttachment[] = [];
            
            // Extract DALL-E images from tool messages
            if (message.content?.parts && Array.isArray(message.content.parts)) {
                for (const part of message.content.parts) {
                    if (typeof part === "object" && part !== null && 
                        (part as ContentPart).content_type === "image_asset_pointer" && 
                        (part as ContentPart).asset_pointer) {
                        
                        const dalleAttachment = this.convertDalleImage(part as ContentPart);
                        if (dalleAttachment) {
                            attachments.push(dalleAttachment);
                        }
                    }
                }
            }
            
            // Associate attachments with parent message
            if (attachments.length > 0 && messageObj.parent) {
                const existing = attachmentsByParent.get(messageObj.parent) || [];
                attachmentsByParent.set(messageObj.parent, [...existing, ...attachments]);
            }
        }
        
        return attachmentsByParent;
    }

    /**
     * Determine if a message should be included in the conversation
     */
    private static shouldIncludeMessage(message: ChatMessage): boolean {
        // Skip tool messages (internal ChatGPT processing)
        if (message.author?.role === "tool") {
            return false;
        }
        
        // Skip empty assistant messages
        if (message.author?.role === "assistant" && 
            message.content?.parts && 
            Array.isArray(message.content.parts) &&
            message.content.parts.every(part => 
                typeof part === "string" && part.trim() === ""
            )) {
            return false;
        }
        
        // Skip assistant messages that are just DALL-E JSON prompts
        if (message.author?.role === "assistant" && 
            message.content?.parts && 
            Array.isArray(message.content.parts) &&
            message.content.parts.length === 1 &&
            typeof message.content.parts[0] === "string") {
            
            const content = message.content.parts[0].trim();
            // Check if it's a JSON prompt (starts with { and contains "prompt")
            if (content.startsWith('{') && content.includes('"prompt"')) {
                return false;
            }
        }
        
        // Use existing validation for other checks
        return isValidMessage(message);
    }

    /**
     * Extract content from ChatGPT message parts - FIXED FOR CONVERSATION MODE
     */
    private static extractContent(chatMessage: ChatMessage): string {
        if (!chatMessage.content?.parts || !Array.isArray(chatMessage.content.parts)) {
            return "";
        }
        
        const contentParts: string[] = [];
        
        for (const part of chatMessage.content.parts) {
            let textContent = "";
            
            if (typeof part === "string" && part.trim() !== "") {
                // Simple string part
                textContent = part;
            } else if (typeof part === "object" && part !== null) {
                // Handle different content types with proper type checking
                if ('content_type' in part && 'text' in part && typeof part.text === 'string') {
                    if (part.content_type === "audio_transcription" && part.text.trim() !== "") {
                        textContent = part.text;
                    } else if (part.content_type === "text" && part.text.trim() !== "") {
                        textContent = part.text;
                    } else if (part.content_type === "multimodal_text" && part.text.trim() !== "") {
                        textContent = part.text;
                    }
                }
                // Skip image_asset_pointer content types - they become attachments
                // Note: audio_asset_pointer and other non-text content types are ignored for now
            }
            
            // Clean up ChatGPT control characters and formatting artifacts
            if (textContent) {
                textContent = this.cleanChatGPTArtifacts(textContent);
                if (textContent.trim() !== "") {
                    contentParts.push(textContent);
                }
            }
        }
        
        return contentParts.join("\n");
    }

    /**
     * Clean ChatGPT artifacts, citations, and control characters
     * Phase 1: Remove all artifacts without trying to preserve links
     * TODO: Later add proper citation/link extraction
     */
    private static cleanChatGPTArtifacts(text: string): string {
        return text
            // Remove citation patterns: cite + identifier
            .replace(/cite[a-zA-Z0-9_\-]+/g, "")
            // Remove link patterns: link + identifier  
            .replace(/link[a-zA-Z0-9_\-]+/g, "")
            // Remove turn patterns: turn + number + search + number
            .replace(/turn\d+search\d+/g, "")
            // Remove any remaining Unicode control characters (Private Use Area E000-F8FF)
            .replace(/[\uE000-\uF8FF]/g, "")
            // Clean up multiple consecutive spaces
            .replace(/ {2,}/g, " ")
            // Clean up multiple consecutive newlines
            .replace(/\n{3,}/g, "\n\n")
            // Trim whitespace
            .trim();
    }
}