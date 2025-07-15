// src/providers/chatgpt/chatgpt-converter.ts
import { Chat, ChatMessage } from "./chatgpt-types";
import { StandardConversation, StandardMessage } from "../../types/standard";
import { isValidMessage } from "../../utils";

export class ChatGPTConverter {
    /**
     * Convert ChatGPT Chat to StandardConversation
     */
    static convertChat(chat: Chat): StandardConversation {
        const messages = this.extractMessagesFromMapping(chat);
        
        return {
            id: chat.id || "",
            title: chat.title || "Untitled",
            provider: "chatgpt",
            createTime: chat.create_time || 0,
            updateTime: chat.update_time || 0,
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
            id: chatMessage.id || "",
            role: chatMessage.author?.role === "user" ? "user" : "assistant",
            content: this.extractContent(chatMessage),
            timestamp: chatMessage.create_time || 0,
            attachments: []
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

            // Handle different message types with ENHANCED filtering
            if (message.author?.role === "tool" && this.hasRealDalleImage(message)) {
                // Create Assistant (DALL-E) message ONLY for real DALL-E generations
                const dalleMessage = this.createDalleAssistantMessage(message);
                if (dalleMessage) {
                    messages.push(dalleMessage);
                }
            } else if (this.shouldIncludeMessage(message)) {
                // Regular user/assistant messages - ENHANCED filtering
                messages.push(this.convertMessage(message));
            }
        }
        
        // Sort by timestamp to maintain order
        return messages.sort((a, b) => a.timestamp - b.timestamp);
    }

    /**
     * Determine if a message should be included in the conversation - ENHANCED VERSION
     */
    private static shouldIncludeMessage(message: ChatMessage): boolean {
        // Safety check
        if (!message || !message.author) {
            return false;
        }
        
        // ===== STRICT EXCLUSIONS =====
        
        // 1. Skip ALL system messages (always internal ChatGPT stuff)
        if (message.author.role === "system") {
            return false;
        }
        
        // 2. Skip ALL tool messages (browsing, code execution, etc.)
        if (message.author.role === "tool") {
            return false;
        }
        
        // 3. Skip hidden messages (user profile, system instructions)
        if (message.metadata?.is_visually_hidden_from_conversation === true) {
            return false;
        }
        
        // 4. Skip user system messages (user_editable_context)
        if (message.metadata?.is_user_system_message === true) {
            return false;
        }
        
        // 5. Skip user_editable_context content type
        if (message.content?.content_type === "user_editable_context") {
            return false;
        }
        
        // ===== ASSISTANT MESSAGE FILTERING =====
        
        if (message.author.role === "assistant") {
            // Skip empty assistant messages
            if (message.content?.parts && 
                Array.isArray(message.content.parts) &&
                message.content.parts.every(part => 
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
                // Check if it's a JSON prompt (starts with { and contains "prompt")
                if (content.startsWith('{') && content.includes('"prompt"')) {
                    return false;
                }
            }
            
            // Skip code execution assistant messages (these are intermediate outputs)
            if (message.content?.content_type === "code") {
                return false;
            }
            
            // Skip system error messages
            if (message.content?.content_type === "system_error") {
                return false;
            }
            
            // Skip execution output messages  
            if (message.content?.content_type === "execution_output") {
                return false;
            }
            
            // Keep multimodal_text messages ONLY if they have actual text content
            if (message.content?.content_type === "multimodal_text") {
                // Check if parts contain actual text (not just objects)
                if (message.content?.parts && Array.isArray(message.content.parts)) {
                    const hasTextContent = message.content.parts.some(part => {
                        if (typeof part === "string" && part.trim() !== "") {
                            return true;
                        }
                        if (typeof part === "object" && part !== null && 'text' in part) {
                            return typeof part.text === "string" && part.text.trim() !== "";
                        }
                        return false;
                    });
                    
                    if (!hasTextContent) {
                        return false; // Skip multimodal messages without text
                    }
                }
            }
        }
        
        // ===== USER MESSAGE FILTERING =====
        
        if (message.author.role === "user") {
            // User messages should generally be kept, but exclude special content types
            const excludedContentTypes = [
                "user_editable_context" // Already covered above but double-check
            ];
            
            if (message.content?.content_type && excludedContentTypes.includes(message.content.content_type)) {
                return false;
            }
        }
        
        // ===== FINAL VALIDATION =====
        
        // Use existing validation for basic message structure
        return isValidMessage(message);
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
            
            const contentPart = part as any;
            return contentPart.content_type === "image_asset_pointer" && 
                   contentPart.asset_pointer &&
                   contentPart.metadata?.dalle && 
                   contentPart.metadata.dalle !== null; // REAL DALL-E check
        });
    }

    /**
     * Create Assistant (DALL-E) message from tool message
     */
    private static createDalleAssistantMessage(toolMessage: ChatMessage): StandardMessage | null {
        if (!toolMessage.content?.parts || !Array.isArray(toolMessage.content.parts)) {
            return null;
        }

        const attachments: any[] = [];
        
        for (const part of toolMessage.content.parts) {
            if (typeof part === "object" && part !== null) {
                const contentPart = part as any;
                if (contentPart.content_type === "image_asset_pointer" && 
                    contentPart.asset_pointer &&
                    contentPart.metadata?.dalle &&
                    contentPart.metadata.dalle !== null) {
                    
                    // Extract file ID from asset pointer
                    let fileId = contentPart.asset_pointer;
                    if (fileId.includes('://')) {
                        fileId = fileId.split('://')[1];
                    }

                    // Generate descriptive filename
                    const genId = contentPart.metadata.dalle.gen_id || 'unknown';
                    const width = contentPart.width || 1024;
                    const height = contentPart.height || 1024;
                    const fileName = `dalle_${genId}_${width}x${height}.png`;

                    const dalleAttachment = {
                        fileName: fileName,
                        fileSize: contentPart.size_bytes,
                        fileType: "image/png",
                        fileId: fileId,
                        extractedContent: contentPart.metadata.dalle.prompt
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
            role: "assistant",
            content: "Image générée par DALL-E",
            timestamp: toolMessage.create_time || 0,
            attachments: attachments
        };
    }

    /**
     * Extract content from ChatGPT message parts
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