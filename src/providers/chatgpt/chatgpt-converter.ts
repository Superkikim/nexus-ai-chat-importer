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


// src/providers/chatgpt/chatgpt-converter.ts
import { Chat, ChatMessage } from "./chatgpt-types";
import { StandardConversation, StandardMessage, StandardAttachment } from "../../types/standard";
import { ChatGPTDalleProcessor } from "./chatgpt-dalle-processor";
import { ChatGPTMessageFilter } from "./chatgpt-message-filter";

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
     * Convert single ChatGPT ChatMessage to StandardMessage
     */
    private static convertMessage(chatMessage: ChatMessage, conversationId?: string): StandardMessage {
        const contentResult = this.extractContent(chatMessage, conversationId);

        return {
            id: chatMessage.id || "",
            role: chatMessage.author?.role === "user" ? "user" : "assistant",
            content: contentResult.content,
            timestamp: chatMessage.create_time || 0,
            attachments: contentResult.attachments || []
        };
    }

    /**
     * Extract messages from ChatGPT mapping structure with DALL-E prompt association
     */
    private static extractMessagesFromMapping(chat: Chat): StandardMessage[] {
        const messages: StandardMessage[] = [];
        const conversationId = chat.id; // Pass conversation ID for smart linking

        // Extract DALL-E prompts using centralized processor (with orphaned prompts support)
        const { imagePrompts, orphanedPrompts } = ChatGPTDalleProcessor.extractDallePromptsFromMapping(chat);

        // Process all messages
        for (const messageObj of Object.values(chat.mapping)) {
            const message = messageObj?.message;
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
                    messages.push(dalleMessage);
                }
            }
            // Handle orphaned DALL-E prompts (no image found)
            else if (orphanedPrompts.has(messageObj.id || "")) {
                const prompt = orphanedPrompts.get(messageObj.id || "");
                if (prompt) {
                    const orphanedMessage = ChatGPTDalleProcessor.createOrphanedPromptMessage(message, prompt);
                    messages.push(orphanedMessage);
                }
            }
            // Handle regular messages (but skip DALL-E JSON prompts)
            else if (ChatGPTMessageFilter.shouldIncludeMessage(message)) {
                messages.push(this.convertMessage(message, conversationId));
            }
        }

        // Sort by timestamp with ID as secondary sort for chronological order
        if (messages.length <= 1) return messages;

        // Use native sort with proper comparison function
        return messages.sort((a, b) => {
            // Primary sort: timestamp
            if (a.timestamp !== b.timestamp) {
                return a.timestamp - b.timestamp;
            }

            // Secondary sort: ID (lexicographic order for same timestamp)
            // This ensures consistent ordering when messages have identical timestamps
            return a.id.localeCompare(b.id);
        });
    }







    /**
     * Extract content and attachments from ChatGPT message parts
     */
    private static extractContent(chatMessage: ChatMessage, conversationId?: string): {content: string, attachments?: StandardAttachment[]} {
        if (!chatMessage.content?.parts || !Array.isArray(chatMessage.content.parts)) {
            return { content: "" };
        }

        const contentParts: string[] = [];
        const attachments: StandardAttachment[] = [];
        
        for (const part of chatMessage.content.parts) {
            let textContent = "";
            
            if (typeof part === "string" && part.trim() !== "") {
                // FIXED: Check if string contains JSON with type/content structure
                if (part.trim().startsWith('{') && part.trim().endsWith('}')) {
                    try {
                        const parsed = JSON.parse(part);
                        if (parsed.type && parsed.content && typeof parsed.content === 'string') {
                            const codeType = parsed.type;
                            const codeContent = parsed.content;

                            if (codeContent.trim() !== "") {
                                // Extract language from type (e.g., "code/markdown" -> "markdown")
                                const language = codeType.includes('/') ? codeType.split('/')[1] : codeType;
                                textContent = `\`\`\`${language}\n${codeContent}\n\`\`\``;
                            }
                        } else {
                            // JSON without type/content, treat as normal text
                            textContent = part;
                        }
                    } catch (e) {
                        // Not valid JSON, treat as normal text
                        textContent = part;
                    }
                } else {
                    // Normal string
                    textContent = part;
                }
            } else if (typeof part === "object" && part !== null) {
                // Handle code blocks with type and content structure (ChatGPT artifacts)
                if ('type' in part && 'content' in part && typeof part.content === 'string') {
                    const codeType = part.type as string;
                    const codeContent = part.content as string;

                    if (codeContent.trim() !== "") {
                        // Extract language from type (e.g., "code/markdown" -> "markdown")
                        const language = codeType.includes('/') ? codeType.split('/')[1] : codeType;
                        textContent = `\`\`\`${language}\n${codeContent}\n\`\`\``;
                    }
                }
                // Handle different content types with proper type checking
                else if ('content_type' in part && 'text' in part && typeof part.text === 'string') {
                    if (part.content_type === "audio_transcription" && part.text.trim() !== "") {
                        textContent = part.text;
                    } else if (part.content_type === "text" && part.text.trim() !== "") {
                        textContent = part.text;
                    } else if (part.content_type === "multimodal_text" && part.text.trim() !== "") {
                        textContent = part.text;
                    }
                }
                // Handle image_asset_pointer content types as attachments
                else if ('content_type' in part && part.content_type === 'image_asset_pointer' && 'asset_pointer' in part) {
                    const attachment = this.extractImageAttachment(part, conversationId);
                    if (attachment) {
                        attachments.push(attachment);
                    }
                }
            }
            
            // Clean up ChatGPT control characters and formatting artifacts
            if (textContent) {
                textContent = this.cleanChatGPTArtifacts(textContent, conversationId);
                if (textContent.trim() !== "") {
                    contentParts.push(textContent);
                }
            }
        }

        const finalContent = contentParts.join("\n");

        // Extract attachments from message metadata if available
        if (chatMessage.attachments) {
            for (const att of chatMessage.attachments) {
                attachments.push({
                    fileName: att.file_name,
                    fileType: att.file_type || 'application/octet-stream',
                    fileSize: att.file_size,
                    extractedContent: att.extracted_content
                });
            }
        }

        return {
            content: finalContent,
            attachments: attachments.length > 0 ? attachments : undefined
        };
    }

    /**
     * Extract image attachment from content part
     */
    private static extractImageAttachment(part: any, conversationId?: string): StandardAttachment | null {
        if (!part.asset_pointer) return null;

        // Extract file ID from asset pointer
        let fileId = part.asset_pointer;
        if (fileId.includes('://')) {
            fileId = fileId.split('://')[1];
        }

        // Generate filename based on metadata
        let fileName = `image_${fileId}`;
        if (part.width && part.height) {
            fileName = `image_${fileId}_${part.width}x${part.height}`;
        }

        // Determine file extension from metadata or default to png
        const fileType = part.metadata?.mime_type || 'image/png';
        const extension = fileType.split('/')[1] || 'png';
        fileName += `.${extension}`;

        return {
            fileName,
            fileType,
            fileSize: part.size_bytes,
            fileId
        };
    }

    // Pre-compiled regex patterns for performance
    private static readonly CLEANUP_PATTERNS = [
        // SMART: Replace sandbox links with actual links to original conversation
        { pattern: /📄 \[([^\]]+)\]\(sandbox:\/[^)]+\)/g, replacement: (chatUrl: string) => `📄 [$1](${chatUrl}) *(visit original conversation to download)*` },
        { pattern: /📄 ([^-\n]+) - File not available in archive/g, replacement: (chatUrl: string) => `📄 [$1](${chatUrl}) *(visit original conversation to download)*` },
        { pattern: /\[([^\]]+)\]\(sandbox:\/[^)]+\)/g, replacement: (chatUrl: string) => `[$1](${chatUrl}) *(visit original conversation to download)*` },
        { pattern: /([^-\n]+) - File not available in archive\. Visit the original conversation to access it/g, replacement: (chatUrl: string) => `[$1](${chatUrl}) *(visit original conversation to download)*` },
        // Remove patterns (static replacements)
        { pattern: /cite[a-zA-Z0-9_\-]+/g, replacement: () => "" },
        { pattern: /link[a-zA-Z0-9_\-]+/g, replacement: () => "" },
        { pattern: /turn\d+search\d+/g, replacement: () => "" },
        { pattern: /[\uE000-\uF8FF]/g, replacement: () => "" }, // Unicode control characters
        { pattern: / {2,}/g, replacement: () => " " }, // Multiple spaces
        { pattern: /\n{3,}/g, replacement: () => "\n\n" } // Multiple newlines
    ];

    /**
     * Clean ChatGPT artifacts, citations, and control characters - SMART LINKING
     */
    private static cleanChatGPTArtifacts(text: string, conversationId?: string): string {
        if (!text || typeof text !== 'string') return '';

        const chatUrl = conversationId ? `https://chatgpt.com/c/${conversationId}` : "https://chatgpt.com";

        let cleanText = text;

        // Apply all cleanup patterns efficiently
        for (const { pattern, replacement } of this.CLEANUP_PATTERNS) {
            cleanText = cleanText.replace(pattern, replacement(chatUrl));
        }

        return cleanText.trim();
    }
}