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


// src/providers/chatgpt/chatgpt-message-filter.ts
import { ChatMessage } from "./chatgpt-types";
import { ChatGPTDalleProcessor } from "./chatgpt-dalle-processor";
import { isValidMessage } from "../../utils";

/**
 * Centralized message filtering logic for ChatGPT conversations
 * Determines which messages should be included in the final output
 */
export class ChatGPTMessageFilter {
    /**
     * Determine if a message should be included in the conversation
     */
    static shouldIncludeMessage(message: ChatMessage): boolean {
        // Safety check
        if (!message || !message.author) {
            return false;
        }
        
        // ===== STRICT EXCLUSIONS =====
        
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
        
        // ===== ASSISTANT MESSAGE FILTERING =====
        
        if (message.author.role === "assistant") {
            // Skip empty assistant messages
            if (message.content?.parts && 
                Array.isArray(message.content.parts) &&
                message.content.parts.every((part: any) => 
                    typeof part === "string" && part.trim() === ""
                )) {
                return false;
            }
            
            // Skip DALL-E JSON prompt messages (handled separately)
            if (ChatGPTDalleProcessor.isDallePromptMessage(message)) {
                return false;
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
        
        // ===== USER MESSAGE FILTERING =====
        
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
