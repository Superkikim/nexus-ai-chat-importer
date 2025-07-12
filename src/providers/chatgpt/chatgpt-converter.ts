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
            // Note: ChatGPT doesn't have attachments in current implementation
            // This will be added in Step 3
            attachments: []
        };
    }

    /**
     * Extract messages from ChatGPT mapping structure
     */
    private static extractMessagesFromMapping(chat: Chat): StandardMessage[] {
        const messages: StandardMessage[] = [];
        
        for (const messageObj of Object.values(chat.mapping)) {
            if (messageObj?.message && isValidMessage(messageObj.message)) {
                messages.push(this.convertMessage(messageObj.message));
            }
        }
        
        // Sort by timestamp to maintain order
        return messages.sort((a, b) => a.timestamp - b.timestamp);
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
                // Handle different content types
                if (part.content_type === "audio_transcription" && part.text && part.text.trim() !== "") {
                    textContent = part.text;
                } else if (part.content_type === "text" && part.text && part.text.trim() !== "") {
                    textContent = part.text;
                } else if (part.content_type === "multimodal_text" && part.text && part.text.trim() !== "") {
                    textContent = part.text;
                }
                // Note: audio_asset_pointer and other non-text content types are ignored for now
                // These could be handled as attachments in the future
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