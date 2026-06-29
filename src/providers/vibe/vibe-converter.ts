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

import {
    StandardConversation,
    StandardMessage,
    StandardAttachment,
} from "../../types/standard";
import {
    MistralVibeConversation,
    MistralVibeMessage,
    MistralVibeContentChunk,
    MistralVibeImageUrlChunk,
    MistralVibeFileReferenceChunk,
    MistralVibeCanvasItem,
} from "./vibe-types";
import { deriveMistralVibeConversationTitle } from "./vibe-title";

/**
 * Converter for Mistral Vibe (formerly Le Chat) export format
 */
export class MistralVibeConverter {
    /**
     * Convert Le Chat conversation to StandardConversation
     *
     * Note: Le Chat exports are arrays of messages without conversation-level metadata.
     * We derive conversation metadata from the messages themselves.
     */
    static convertChat(chat: MistralVibeConversation): StandardConversation {
        if (!chat || chat.length === 0) {
            throw new Error("Mistral Vibe conversation is empty");
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
            provider: "vibe",
            createTime: createTime,
            updateTime: updateTime,
            messages: messages,
            chatUrl: `https://chat.mistral.ai/chat/${chatId}`,
            metadata: {},
        };
    }

    /**
     * Convert Le Chat messages to StandardMessage array
     *
     * IMPORTANT: Assumes messages are already sorted chronologically
     */
    static convertMessages(messages: MistralVibeMessage[]): StandardMessage[] {
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
    private static convertMessage(
        message: MistralVibeMessage
    ): StandardMessage | null {
        if (!message.id || !message.role) {
            return null;
        }

        // Extract content from message
        const content = this.extractContent(message);

        // Extract attachments: user uploads + generated images + generated file references
        const attachments = [
            ...this.extractAttachments(message),
            ...this.extractImageUrlAttachments(message),
            ...this.extractFileReferenceAttachments(message),
        ];

        // Parse timestamp (ISO 8601 to Unix seconds)
        const timestamp = this.parseTimestamp(message.createdAt);

        return {
            id: message.id,
            role: message.role,
            content: content,
            timestamp: timestamp,
            attachments: attachments,
        };
    }

    /**
     * Extract content from Le Chat message.
     * IMPORTANT: message.content is a duplicate of text chunks combined —
     * use EITHER contentChunks OR content, never both.
     * Canvas items (slides, markdown documents) are appended after the main text.
     */
    private static extractContent(message: MistralVibeMessage): string {
        const parts: string[] = [];

        if (message.contentChunks && message.contentChunks.length > 0) {
            const chunksContent = this.processContentChunks(
                message.contentChunks
            );
            if (chunksContent) parts.push(chunksContent);
        } else if (message.content && message.content.trim()) {
            parts.push(message.content);
        }

        const canvasContent = this.renderCanvasItems(message.canvas);
        if (canvasContent) parts.push(canvasContent);

        return parts.join("\n\n") || "(Empty message)";
    }

    /**
     * Process contentChunks array
     * Handles text, tool_call, reference, and custom_element types
     */
    private static processContentChunks(
        chunks: MistralVibeContentChunk[]
    ): string {
        const parts: string[] = [];

        for (const chunk of chunks) {
            if (chunk.type === "text" && "text" in chunk && chunk.text) {
                // Only add text chunks if they're not duplicates of main content
                parts.push(chunk.text);
            } else if (chunk.type === "tool_call") {
                // Filter out tool calls - not useful for users (same as Claude's web_search filtering)
                // Tool calls like web_search, open_url, etc. are internal operations
                continue;
            } else if (
                chunk.type === "reference" &&
                "referenceIds" in chunk &&
                chunk.referenceIds
            ) {
                // Format references as footnote markers
                const refMarkers = chunk.referenceIds
                    .map((id) => `[^${id}]`)
                    .join("");
                if (refMarkers) {
                    parts.push(refMarkers);
                }
            } else if (
                chunk.type === "file_reference" ||
                chunk.type === "canva"
            ) {
                // file_reference → handled as attachment in extractFileReferenceAttachments
                // canva → content rendered from message.canvas in renderCanvasItems
                continue;
            }
            // Ignore custom_element
        }

        return parts.join("\n").trim();
    }

    /**
     * Extract attachments from Le Chat message files array
     */
    private static extractAttachments(
        message: MistralVibeMessage
    ): StandardAttachment[] {
        const attachments: StandardAttachment[] = [];

        if (!message.files || message.files.length === 0) {
            return attachments;
        }

        for (const file of message.files) {
            const attachment: StandardAttachment = {
                fileName: file.name,
                fileType: this.getFileTypeFromVibeType(file.type),
                fileSize: undefined, // Size not available in Le Chat export
                status: {
                    processed: false,
                    found: false,
                },
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
    private static extractImageUrlAttachments(
        message: MistralVibeMessage
    ): StandardAttachment[] {
        if (!message.contentChunks) return [];

        const chatUrl = `https://chat.mistral.ai/chat/${message.chatId}`;
        const imageChunks = message.contentChunks.filter(
            (chunk): chunk is MistralVibeImageUrlChunk =>
                chunk.type === "image_url" && "imageUrl" in chunk
        );

        return imageChunks.map((chunk, index) => {
            // Derive extension from URL (strip query params first)
            const urlPath = chunk.imageUrl.split("?")[0];
            const urlExt = urlPath.split(".").pop()?.toLowerCase() || "";
            const validExts = ["jpg", "jpeg", "png", "gif", "webp"];
            const ext = validExts.includes(urlExt) ? urlExt : "jpg";

            // Clean filename — no UUIDs, numbered only when multiple images
            const fileName =
                imageChunks.length === 1
                    ? `generated-image.${ext}`
                    : `generated-image-${index + 1}.${ext}`;
            const fileType = ext === "png" ? "image/png" : "image/jpeg";

            // Pre-format the callout: formatter returns extractedContent immediately,
            // bypassing any status.note rewriting by the attachment extractor
            const extractedContent = `>>[!nexus_attachment] **${fileName}** *(missing)* (${fileType})\n>>\n>> ⚠️ Not included in export. [Open original conversation](${chatUrl})`;

            return {
                fileName,
                fileType,
                attachmentType: "generated_image" as const,
                url: chatUrl,
                extractedContent,
                status: {
                    processed: true,
                    found: false,
                    reason: "missing_from_export" as const,
                },
            };
        });
    }

    /**
     * Extract assistant-generated file references from file_reference content chunks.
     * These files (e.g. a generated .docx) are hosted on Mistral servers and are not
     * included in the ZIP export — only a placeholder is inserted.
     */
    private static extractFileReferenceAttachments(
        message: MistralVibeMessage
    ): StandardAttachment[] {
        if (!message.contentChunks) return [];

        const chatUrl = `https://chat.mistral.ai/chat/${message.chatId}`;
        const fileChunks = message.contentChunks.filter(
            (chunk): chunk is MistralVibeFileReferenceChunk =>
                chunk.type === "file_reference" && "fileReference" in chunk
        );

        return fileChunks.map((chunk) => {
            const fileName = chunk.fileReference;
            const ext = fileName.split(".").pop()?.toLowerCase() || "";
            const fileType = this.mimeFromExtension(ext);
            const displayName = chunk.fileAlt || fileName;

            const extractedContent = `>>[!nexus_attachment] **${displayName}** *(not in export)* (${fileType})\n>>\n>> ⚠️ Not included in export. [Open original conversation](${chatUrl})`;

            return {
                fileName,
                fileType,
                extractedContent,
                status: {
                    processed: true,
                    found: false,
                    reason: "missing_from_export" as const,
                },
            };
        });
    }

    /**
     * Render Vibe canvas items (slides presentations, markdown documents) as
     * collapsible nexus_canvas callouts appended to the message content.
     * The single leading ">" is doubled by the message formatter when the
     * callout is nested inside a message callout.
     */
    private static renderCanvasItems(canvas: MistralVibeCanvasItem[]): string {
        if (!canvas || canvas.length === 0) return "";

        const callouts: string[] = [];
        for (const item of canvas) {
            const title = (item.title || "Canvas").trim();
            const isSlides = item.type === "slides";
            const label = isSlides ? `${title} *(presentation)*` : title;

            const lines: string[] = [`>[!nexus_canvas]- **${label}**`];

            if (isSlides) {
                lines.push("> ```");
                for (const line of (item.content || "").split("\n")) {
                    lines.push(line === "" ? ">" : `> ${line}`);
                }
                lines.push("> ```");
            } else {
                for (const line of (item.content || "").split("\n")) {
                    lines.push(line === "" ? ">" : `> ${line}`);
                }
            }

            callouts.push(lines.join("\n"));
        }

        return callouts.join("\n\n");
    }

    /** Derive MIME type from a file extension. */
    private static mimeFromExtension(ext: string): string {
        const map: Record<string, string> = {
            pdf: "application/pdf",
            docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            doc: "application/msword",
            xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            txt: "text/plain",
            md: "text/markdown",
            csv: "text/csv",
            json: "application/json",
            png: "image/png",
            jpg: "image/jpeg",
            jpeg: "image/jpeg",
            webp: "image/webp",
        };
        return map[ext] || "application/octet-stream";
    }

    /**
     * Convert Le Chat file type to MIME type
     */
    private static getFileTypeFromVibeType(type: string): string {
        switch (type) {
            case "image":
                return "image/*";
            case "text":
                return "text/plain";
            case "document":
                return "application/octet-stream";
            default:
                return "application/octet-stream";
        }
    }

    /**
     * Sort messages by timestamp (chronological order)
     * CRITICAL: Le Chat exports messages in random order, not chronological!
     * Uses MILLISECOND precision for accurate sorting (even for sub-second responses)
     */
    private static sortMessagesByTimestamp(
        chat: MistralVibeConversation
    ): MistralVibeConversation {
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
    private static deriveConversationTitle(
        chat: MistralVibeConversation
    ): string {
        return deriveMistralVibeConversationTitle(chat, { assumeSorted: true });
    }

    /**
     * Get minimum timestamp from messages (conversation create time)
     */
    private static getMinTimestamp(chat: MistralVibeConversation): number {
        const timestamps = chat
            .map((msg) => this.parseTimestamp(msg.createdAt))
            .filter((ts) => ts > 0);

        return timestamps.length > 0 ? Math.min(...timestamps) : 0;
    }

    /**
     * Get maximum timestamp from messages (conversation update time)
     */
    private static getMaxTimestamp(chat: MistralVibeConversation): number {
        const timestamps = chat
            .map((msg) => this.parseTimestamp(msg.createdAt))
            .filter((ts) => ts > 0);

        return timestamps.length > 0 ? Math.max(...timestamps) : 0;
    }

    /**
     * Parse ISO 8601 timestamp to Unix seconds
     */
    private static parseTimestamp(isoString: string): number {
        try {
            const date = new Date(isoString);
            return Math.floor(date.getTime() / 1000);
        } catch {
            return 0;
        }
    }
}
