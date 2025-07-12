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
     * Extract content from ChatGPT message parts
     */
    private static extractContent(chatMessage: ChatMessage): string {
        if (!chatMessage.content?.parts || !Array.isArray(chatMessage.content.parts)) {
            return "";
        }
        
        return chatMessage.content.parts
            .filter(part => typeof part === "string" && part.trim() !== "")
            .join("\n");
    }
}