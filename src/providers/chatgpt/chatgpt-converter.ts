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
     * Convert ChatGPT attachments to StandardAttachments - FIXED: No more fake DALL-E
     */
    private static convertAttachments(chatMessage: ChatMessage): StandardAttachment[] {
        const attachments: StandardAttachment[] = [];

        // Process attachments from metadata (new format) - THIS IS THE MAIN SOURCE
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

        // *** REMOVED: Don't process image_asset_pointer here - they're already in metadata.attachments ***
        // The metadata.attachments array contains the real file info, including user uploads
        // Only tool messages with actual DALL-E generation should create separate DALL-E messages

        return attachments;
    }

    /**
     * Convert DALL-E image asset pointer to StandardAttachment - ONLY for real DALL-E
     */
    private static convertDalleImage(imagePart: ContentPart): StandardAttachment | null {
        if (!imagePart.asset_pointer) return null;

        // CHECK: Only process if it's actually DALL-E generated
        if (!imagePart.metadata?.dalle || imagePart.metadata.dalle === null) {
            return null; // Not a DALL-E image, skip it
        }

        // Extract file ID from asset pointer
        let fileId = imagePart.asset_pointer;
        
        // Extract just the file identifier
        if (fileId.includes('://')) {
            fileId = fileId.split('://')[1];
        }

        // Generate descriptive filename
        const genId = imagePart.metadata.dalle.gen_id || 'unknown';
        const width = imagePart.width || 1024;
        const height = imagePart.height || 1024;
        const fileName = `dalle_${genId}_${width}x${height}.png`;

        return {
            fileName: fileName,
            fileSize: imagePart.size_bytes,
            fileType: "image/png", // DALL-E generates PNG by default
            fileId: fileId, // For ZIP lookup in dalle-generations/
            extractedContent: imagePart.metadata.dalle.prompt // Include the generation prompt
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
        const messages: StandardMessage[] = [];
        
        for (const messageObj of Object.values(chat.mapping)) {
            const message = messageObj?.message;
            if (!message) continue;

            // Handle different message types
            if (message.author?.role === "tool" && this.hasRealDalleImage(message)) {
                // Create Assistant (DALL-E) message ONLY for real DALL-E generations
                const dalleMessage = this.createDalleAssistantMessage(message);
                if (dalleMessage) {
                    messages.push(dalleMessage);
                }
            } else if (this.shouldIncludeMessage(message)) {
                // Regular user/assistant messages
                messages.push(this.convertMessage(message));
            }
        }
        
        // Sort by timestamp to maintain order
        return messages.sort((a, b) => a.timestamp - b.timestamp);
    }

    /**
     * Check if message contains REAL DALL-E image (not user upload)
     */
    private static hasRealDalleImage(message: ChatMessage): boolean {
        if (!message.content?.parts || !Array.isArray(message.content.parts)) {
            return false;
        }
        
        return message.content.parts.some(part => {
            if (typeof part !== "object" || part === null) return false;
            
            const contentPart = part as ContentPart;
            return contentPart.content_type === "image_asset_pointer" && 
                   contentPart.asset_pointer &&
                   contentPart.metadata?.dalle && 
                   contentPart.metadata.dalle !== null; // REAL DALL-E check
        });
    }

    /**
     * Create Assistant (DALL-E) message from tool message - ONLY for real DALL-E
     */
    private static createDalleAssistantMessage(toolMessage: ChatMessage): StandardMessage | null {
        if (!toolMessage.content?.parts || !Array.isArray(toolMessage.content.parts)) {
            return null;
        }

        const attachments: StandardAttachment[] = [];
        
        for (const part of toolMessage.content.parts) {
            if (typeof part === "object" && part !== null) {
                const contentPart = part as ContentPart;
                if (contentPart.content_type === "image_asset_pointer" && 
                    contentPart.asset_pointer &&
                    contentPart.metadata?.dalle &&
                    contentPart.metadata.dalle !== null) { // Only real DALL-E
                    
                    const dalleAttachment = this.convertDalleImage(contentPart);
                    if (dalleAttachment) {
                        attachments.push(dalleAttachment);
                    }
                }
            }
        }

        if (attachments.length === 0) {
            return null;
        }

        return {
            id: toolMessage.id,
            role: "assistant",
            content: "Image générée par DALL-E",
            timestamp: toolMessage.create_time,
            attachments: attachments
        };
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
                // Skip image_asset_pointer content types - they become attachments via metadata
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