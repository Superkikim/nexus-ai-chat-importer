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


// src/formatters/message-formatter.ts
import { StandardMessage, StandardAttachment } from "../types/standard";
import { formatMessageTimestamp } from "../utils";
import { formatFileSize, isImageFile } from "../utils/file-utils";
import { Logger } from "../logger";
import type NexusAiChatImporterPlugin from "../main";

export class MessageFormatter {
    // Nexus custom callouts with icons
    private static readonly CALLOUTS = {
        USER: 'nexus_user',         // 👤 User messages
        AGENT: 'nexus_agent',       // 🤖 Assistant/Agent messages
        ATTACHMENT: 'nexus_attachment', // 📎 Attachments
        ARTIFACT: 'nexus_artifact',     // 🛠️ Claude artifacts
        PROMPT: 'nexus_prompt'          // 💭 System prompts
    };

    constructor(
        private logger: Logger,
        private plugin: NexusAiChatImporterPlugin
    ) {}

    formatMessages(messages: StandardMessage[]): string {
        return messages
            .filter(message => message !== undefined)
            .map(message => this.formatMessage(message))
            .filter(formattedMessage => formattedMessage !== "")
            .join("\n");
    }

    formatMessage(message: StandardMessage): string {
        if (!message) {
            this.logger.error("Message is null or undefined:", message);
            return "";
        }

        // Get custom format if enabled
        const customFormat = this.plugin.settings.useCustomMessageTimestampFormat
            ? this.plugin.settings.messageTimestampFormat
            : undefined;

        const messageTime = formatMessageTimestamp(message.timestamp, customFormat);

        const authorName = message.role === "user" ? "User" : "Assistant";
        const calloutType = message.role === "user" ? MessageFormatter.CALLOUTS.USER : MessageFormatter.CALLOUTS.AGENT;

        // Create callout with timestamp and content
        let messageContent = `>[!${calloutType}] **${authorName}** - ${messageTime}\n`;

        // Format main message content
        if (message.content) {
            // Add content inside the callout (no need for quote chars)
            messageContent += `> ${message.content.split("\n").join("\n> ")}`;
        } else {
            messageContent += `> [No content found]`;
        }

        // Format attachments if any
        if (message.attachments && message.attachments.length > 0) {
            messageContent += "\n" + this.formatAttachments(message.attachments);
        }

        // Add UID for update tracking
        messageContent += `\n<!-- UID: ${message.id} -->`;

        // Add separator for assistant messages
        if (message.role === "assistant") {
            messageContent += "\n\n---";
        }

        return messageContent;
    }

    private formatAttachments(attachments: StandardAttachment[]): string {
        return attachments.map(attachment => {
            return this.formatSingleAttachment(attachment);
        }).join("\n\n");
    }

    /**
     * Format single attachment with Nexus callout styling
     *
     * Provider-formatted attachments (with extractedContent) are displayed as-is.
     * Generic attachments get basic formatting.
     */
    private formatSingleAttachment(attachment: StandardAttachment): string {
        // If extractedContent exists, display it as-is (already formatted by provider)
        if (attachment.extractedContent) {
            return attachment.extractedContent;
        }

        // Generic formatting for attachments without extractedContent (nested in message callout)
        let content = `>>[!${MessageFormatter.CALLOUTS.ATTACHMENT}] `;

        // Status-aware header
        if (attachment.status?.found) {
            content += `**${attachment.fileName}**`;
        } else {
            content += `**${attachment.fileName}** *(missing)*`;
        }

        // Add file metadata
        if (attachment.fileType) {
            content += ` (${attachment.fileType})`;
        }

        if (attachment.fileSize) {
            content += ` - ${formatFileSize(attachment.fileSize)}`;
        }

        content += '\n';

        // Handle successful extraction
        if (attachment.status?.found && attachment.url) {
            // Skip sandbox:// URLs - they don't work in Obsidian
            if (!attachment.url.startsWith('sandbox://')) {
                if (isImageFile(attachment)) {
                    content += `>> ![[${attachment.url}]]`; // Embed images
                } else {
                    content += `>> [[${attachment.url}]]`; // Link documents
                }
            } else {
                // Sandbox URL - explain to user
                content += `>> ⚠️ File not available in archive. Visit the original conversation to access it`;
            }
        }

        // Handle missing/failed attachments with informative notes
        else if (attachment.status && !attachment.status.found) {
            content += `>> ⚠️ ${this.getStatusMessage(attachment.status.reason)}`;

            if (attachment.status.note) {
                content += `\n>> **Note:** ${attachment.status.note}`;
            }

            // Add link to original conversation for missing attachments
            if (attachment.status.reason === 'missing_from_export') {
                // Try to extract conversation URL from attachment or use generic provider link
                if (attachment.url) {
                    content += `\n>> [Open original conversation](${attachment.url})`;
                } else {
                    content += `\n>> Original conversation link not available`;
                }
            }
        }

        // Add raw content for text files
        else if (attachment.content) {
            content += `>> ${attachment.content}`;
        }

        return content;
    }

    /**
     * Get user-friendly status message
     */
    private getStatusMessage(reason?: string): string {
        switch (reason) {
            case 'missing_from_export':
                return 'Not included in export';
            case 'extraction_failed':
                return 'Extraction failed';
            case 'corrupted':
                return 'File appears corrupted';
            case 'unsupported_format':
                return 'Unsupported file format';
            default:
                return 'Processing issue';
        }
    }

}