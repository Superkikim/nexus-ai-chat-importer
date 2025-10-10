// src/formatters/message-formatter.ts
import { StandardMessage, StandardAttachment } from "../types/standard";
import { formatTimestamp } from "../utils";
import { Logger } from "../logger";

export class MessageFormatter {
    // Nexus custom callouts with icons
    private static readonly CALLOUTS = {
        USER: 'nexus_user',         // 👤 User messages
        AGENT: 'nexus_agent',       // 🤖 Assistant/Agent messages
        ATTACHMENT: 'nexus_attachment', // 📎 Attachments
        ARTIFACT: 'nexus_artifact',     // 🛠️ Claude artifacts
        PROMPT: 'nexus_prompt'          // 💭 System prompts
    };

    constructor(private logger: Logger) {}

    formatMessages(messages: StandardMessage[]): string {
        return messages
            .filter(message => message !== undefined)
            .map(message => this.formatMessage(message))
            .filter(formattedMessage => formattedMessage !== "")
            .join("\n\n");
    }

    formatMessage(message: StandardMessage): string {
        if (!message) {
            this.logger.error("Message is null or undefined:", message);
            return "";
        }

        const messageTime =
            formatTimestamp(message.timestamp, "date") +
            " at " +
            formatTimestamp(message.timestamp, "time");

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
            messageContent += "\n\n" + this.formatAttachments(message.attachments);
        }

        // Add UID for update tracking
        messageContent += `\n<!-- UID: ${message.id} -->\n`;

        // Add separator for assistant messages
        if (message.role === "assistant") {
            messageContent += "\n---\n";
        }

        return messageContent + "\n\n";
    }

    private formatAttachments(attachments: StandardAttachment[]): string {
        return attachments.map(attachment => {
            return this.formatSingleAttachment(attachment);
        }).join("\n\n");
    }

    /**
     * Format single attachment with Nexus callout styling
     */
    private formatSingleAttachment(attachment: StandardAttachment): string {
        // For Claude attachments, check if already formatted as callout
        if (attachment.extractedContent && attachment.extractedContent.includes('nexus_attachment')) {
            return attachment.extractedContent;
        }

        // Create attachment callout
        let content = `>[!${MessageFormatter.CALLOUTS.ATTACHMENT}] `;

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
            content += ` - ${this.formatFileSize(attachment.fileSize)}`;
        }

        content += '\n';

        // Handle successful extraction
        if (attachment.status?.found && attachment.url) {
            // Skip sandbox:// URLs - they don't work in Obsidian
            if (!attachment.url.startsWith('sandbox://')) {
                if (this.isImageFile(attachment)) {
                    content += `> ![[${attachment.url}]]`; // Embed images
                } else {
                    content += `> [[${attachment.url}]]`; // Link documents
                }
            } else {
                // Sandbox URL - explain to user
                content += `> ⚠️ File not available in archive. Visit the original conversation to access it`;
            }
        }

        // Handle missing/failed attachments with informative notes
        else if (attachment.status && !attachment.status.found) {
            content += `> ⚠️ ${this.getStatusMessage(attachment.status.reason)}`;

            if (attachment.status.note) {
                content += `\n> **Note:** ${attachment.status.note}`;
            }

            // Add link to original conversation for missing attachments
            if (attachment.status.reason === 'missing_from_export') {
                // Try to extract conversation URL from attachment or use generic provider link
                if (attachment.url) {
                    content += `\n> [Open original conversation](${attachment.url})`;
                } else {
                    content += `\n> Original conversation link not available`;
                }
            }
        }

        // For generated images with extractedContent, use it directly (contains prompt + image/warning)
        else if (this.isGeneratedImage(attachment) && attachment.extractedContent) {
            // extractedContent already contains formatted callouts, just indent them
            const lines = attachment.extractedContent.split('\n');
            content += lines.map(line => `> ${line}`).join('\n');

            // Add image embed if found
            if (attachment.status?.found && attachment.url) {
                content += `\n> \n> >[!nexus_attachment] **${attachment.fileName}**`;
                if (this.isImageFile(attachment)) {
                    content += `\n> > ![[${attachment.url}]]`;
                } else {
                    content += `\n> > [[${attachment.url}]]`;
                }
            }
        }
        // Add extracted content for other types (transcriptions, OCR, code, etc.)
        else if (attachment.extractedContent) {
            content += `> ${attachment.extractedContent}`;
        }

        // Add raw content for text files - always show if available
        else if (attachment.content && !attachment.extractedContent) {
            content += `> ${attachment.content}`;
        }

        return content;
    }

    /**
     * Check if attachment is a generated image (provider-agnostic)
     */
    private isGeneratedImage(attachment: StandardAttachment): boolean {
        return attachment.attachmentType === 'generated_image';
    }

    /**
     * Check if attachment is an artifact (provider-agnostic)
     */
    private isArtifact(attachment: StandardAttachment): boolean {
        return attachment.attachmentType === 'artifact';
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

    /**
     * Check if attachment is an image file for embedding
     */
    private isImageFile(attachment: StandardAttachment): boolean {
        // Check MIME type first (most reliable)
        if (attachment.fileType?.startsWith('image/')) {
            return true;
        }
        
        // Fall back to file extension
        const fileName = attachment.fileName.toLowerCase();
        const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.tiff'];
        return imageExtensions.some(ext => fileName.endsWith(ext));
    }

    private formatFileSize(bytes: number): string {
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        if (bytes === 0) return '0 Bytes';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }
}