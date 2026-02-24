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

import { StandardConversation, StandardMessage, StandardAttachment } from "../../types/standard";
import { LeChatConversation, LeChatMessage, LeChatContentChunk, LeChatToolCallChunk, LeChatImageUrlChunk } from "./lechat-types";

/**
 * Converter for Le Chat (Mistral AI) export format
 */
export class LeChatConverter {
    /**
     * Convert Le Chat conversation to StandardConversation
     * 
     * Note: Le Chat exports are arrays of messages without conversation-level metadata.
     * We derive conversation metadata from the messages themselves.
     */
    static convertChat(chat: LeChatConversation): StandardConversation {
        if (!chat || chat.length === 0) {
            throw new Error("Le Chat conversation is empty");
        }

        // CRITICAL: Le Chat messages are NOT in chronological order in the JSON!
        // We must sort them by timestamp first before any processing
        const sortedChat = this.sortMessagesByTimestamp(chat);

        // Extract conversation metadata from sorted messages
        const chatId = sortedChat[0]?.chatId || "";
        const title = this.deriveConversationTitle(sortedChat);
        const createTime = this.getMinTimestamp(sortedChat);
        const updateTime = this.getMaxTimestamp(sortedChat);

        // Convert messages (already sorted)
        const messages = this.convertMessages(sortedChat);

        return {
            id: chatId,
            title: title,
            provider: "lechat",
            createTime: createTime,
            updateTime: updateTime,
            messages: messages,
            chatUrl: `https://chat.mistral.ai/chat/${chatId}`,
            metadata: {}
        };
    }

    /**
     * Convert Le Chat messages to StandardMessage array
     *
     * IMPORTANT: Assumes messages are already sorted chronologically
     */
    static convertMessages(messages: LeChatMessage[]): StandardMessage[] {
        const standardMessages: StandardMessage[] = [];

        for (const message of messages) {
            const standardMessage = this.convertMessage(message);
            if (standardMessage) {
                standardMessages.push(standardMessage);
            }
        }

        // No need to sort - messages are already sorted in convertChat()
        return standardMessages;
    }

    /**
     * Convert single Le Chat message to StandardMessage
     */
    private static convertMessage(message: LeChatMessage): StandardMessage | null {
        if (!message.id || !message.role) {
            return null;
        }

        // Extract content from message
        const content = this.extractContent(message);

        // Extract attachments: user uploads from files array + assistant-generated images from content chunks
        const attachments = [
            ...this.extractAttachments(message),
            ...this.extractImageUrlAttachments(message)
        ];

        // Parse timestamp (ISO 8601 to Unix seconds)
        const timestamp = this.parseTimestamp(message.createdAt);

        return {
            id: message.id,
            role: message.role,
            content: content,
            timestamp: timestamp,
            attachments: attachments
        };
    }

    /**
     * Extract content from Le Chat message
     * IMPORTANT: message.content is a duplicate of text chunks combined
     * We use EITHER contentChunks OR content, not both!
     */
    private static extractContent(message: LeChatMessage): string {
        // If contentChunks exist, use them (they contain text + references + custom elements)
        if (message.contentChunks && message.contentChunks.length > 0) {
            const chunksContent = this.processContentChunks(message.contentChunks);
            return chunksContent || "(Empty message)";
        }

        // Fallback to simple content if no contentChunks
        if (message.content && message.content.trim()) {
            return message.content;
        }

        return "(Empty message)";
    }

    /**
     * Process contentChunks array
     * Handles text, tool_call, reference, and custom_element types
     */
    private static processContentChunks(chunks: LeChatContentChunk[]): string {
        const parts: string[] = [];

        for (const chunk of chunks) {
            if (chunk.type === 'text' && 'text' in chunk && chunk.text) {
                // Only add text chunks if they're not duplicates of main content
                parts.push(chunk.text);
            } else if (chunk.type === 'tool_call') {
                // Filter out tool calls - not useful for users (same as Claude's web_search filtering)
                // Tool calls like web_search, open_url, etc. are internal operations
                continue;
            } else if (chunk.type === 'reference' && 'referenceIds' in chunk && chunk.referenceIds) {
                // Format references as footnote markers
                const refMarkers = chunk.referenceIds.map(id => `[^${id}]`).join('');
                if (refMarkers) {
                    parts.push(refMarkers);
                }
            }
            // Ignore custom_element for now
        }

        return parts.join('\n').trim();
    }



    /**
     * Extract attachments from Le Chat message files array
     */
    private static extractAttachments(message: LeChatMessage): StandardAttachment[] {
        const attachments: StandardAttachment[] = [];

        if (!message.files || message.files.length === 0) {
            return attachments;
        }

        for (const file of message.files) {
            const attachment: StandardAttachment = {
                fileName: file.name,
                fileType: this.getFileTypeFromLeChatType(file.type),
                fileSize: undefined, // Size not available in Le Chat export
                status: {
                    processed: false,
                    found: false
                }
            };

            attachments.push(attachment);
        }

        return attachments;
    }

    /**
     * Extract assistant-generated images from image_url content chunks.
     * These images are hosted on Mistral servers and never included in the ZIP export.
     * We pre-format the callout via extractedContent so the attachment extractor cannot
     * overwrite the note with an ugly internal ZIP path.
     */
    private static extractImageUrlAttachments(message: LeChatMessage): StandardAttachment[] {
        if (!message.contentChunks) return [];

        const chatUrl = `https://chat.mistral.ai/chat/${message.chatId}`;
        const imageChunks = message.contentChunks
            .filter((chunk): chunk is LeChatImageUrlChunk => chunk.type === 'image_url' && 'imageUrl' in chunk);

        return imageChunks.map((chunk, index) => {
            // Derive extension from URL (strip query params first)
            const urlPath = chunk.imageUrl.split('?')[0];
            const urlExt = urlPath.split('.').pop()?.toLowerCase() || '';
            const validExts = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
            const ext = validExts.includes(urlExt) ? urlExt : 'jpg';

            // Clean filename — no UUIDs, numbered only when multiple images
            const fileName = imageChunks.length === 1
                ? `generated-image.${ext}`
                : `generated-image-${index + 1}.${ext}`;
            const fileType = ext === 'png' ? 'image/png' : 'image/jpeg';

            // Pre-format the callout: formatter returns extractedContent immediately,
            // bypassing any status.note rewriting by the attachment extractor
            const extractedContent = `>>[!nexus_attachment] **${fileName}** *(missing)* (${fileType})\n>>\n>> ⚠️ Not included in export. [Open original conversation](${chatUrl})`;

            return {
                fileName,
                fileType,
                attachmentType: 'generated_image' as const,
                url: chatUrl,
                extractedContent,
                status: {
                    processed: true,
                    found: false,
                    reason: 'missing_from_export' as const
                }
            };
        });
    }

    /**
     * Convert Le Chat file type to MIME type
     */
    private static getFileTypeFromLeChatType(type: string): string {
        switch (type) {
            case 'image':
                return 'image/*';
            case 'text':
                return 'text/plain';
            case 'document':
                return 'application/octet-stream';
            default:
                return 'application/octet-stream';
        }
    }

    /**
     * Sort messages by timestamp (chronological order)
     * CRITICAL: Le Chat exports messages in random order, not chronological!
     * Uses MILLISECOND precision for accurate sorting (even for sub-second responses)
     */
    private static sortMessagesByTimestamp(chat: LeChatConversation): LeChatConversation {
        return [...chat].sort((a, b) => {
            // Use milliseconds for precise sorting
            const timeA = new Date(a.createdAt).getTime();
            const timeB = new Date(b.createdAt).getTime();
            return timeA - timeB;
        });
    }

    /**
     * Derive conversation title from first user message (chronologically)
     * Truncates to 50 characters if needed
     *
     * IMPORTANT: Assumes messages are already sorted chronologically
     */
    private static deriveConversationTitle(chat: LeChatConversation): string {
        // Find first user message (should be first or second message after sorting)
        const firstUserMessage = chat.find(msg => msg.role === 'user');

        if (firstUserMessage && firstUserMessage.content) {
            const content = firstUserMessage.content.trim();
            if (content.length > 50) {
                return content.substring(0, 50).trim() + '...';
            }
            return content;
        }

        return "Untitled";
    }

    /**
     * Get minimum timestamp from messages (conversation create time)
     */
    private static getMinTimestamp(chat: LeChatConversation): number {
        const timestamps = chat
            .map(msg => this.parseTimestamp(msg.createdAt))
            .filter(ts => ts > 0);

        return timestamps.length > 0 ? Math.min(...timestamps) : 0;
    }

    /**
     * Get maximum timestamp from messages (conversation update time)
     */
    private static getMaxTimestamp(chat: LeChatConversation): number {
        const timestamps = chat
            .map(msg => this.parseTimestamp(msg.createdAt))
            .filter(ts => ts > 0);

        return timestamps.length > 0 ? Math.max(...timestamps) : 0;
    }

    /**
     * Parse ISO 8601 timestamp to Unix seconds
     */
    private static parseTimestamp(isoString: string): number {
        try {
            const date = new Date(isoString);
            return Math.floor(date.getTime() / 1000);
        } catch (error) {
            return 0;
        }
    }
}

