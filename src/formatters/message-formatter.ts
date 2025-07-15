// src/formatters/message-formatter.ts
import { StandardMessage, StandardAttachment } from "../types/standard";
import { formatTimestamp } from "../utils";
import { Logger } from "../logger";

export class MessageFormatter {
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
        const headingLevel = message.role === "user" ? "###" : "####";
        const quoteChar = message.role === "user" ? ">" : ">>";

        let messageContent = `${headingLevel} ${authorName}, on ${messageTime};\n`;

        // Format main message content
        if (message.content) {
            messageContent += message.content
                .split("\n")
                .map(line => `${quoteChar} ${line}`)
                .join("\n");
        } else {
            messageContent += `${quoteChar} [No content found]`;
        }

        // Format attachments if any
        if (message.attachments && message.attachments.length > 0) {
            messageContent += "\n\n" + this.formatAttachments(message.attachments, quoteChar);
        }

        // Add UID for update tracking
        messageContent += `\n<!-- UID: ${message.id} -->\n`;

        // Add separator for assistant messages
        if (message.role === "assistant") {
            messageContent += "\n---\n";
        }

        return messageContent + "\n\n";
    }

    private formatAttachments(attachments: StandardAttachment[], quoteChar: string): string {
        return attachments.map(attachment => {
            return this.formatSingleAttachment(attachment, quoteChar);
        }).join("\n\n");
    }

    /**
     * Format single attachment with status-aware display
     */
    private formatSingleAttachment(attachment: StandardAttachment, quoteChar: string): string {
        let content = "";

        // Status-aware header with appropriate icon
        if (attachment.status?.found) {
            content = `${quoteChar} **📎 Attachment:** ${attachment.fileName}`;
        } else if (attachment.status?.processed) {
            content = `${quoteChar} **📎 Missing Attachment:** ${attachment.fileName}`;
        } else {
            content = `${quoteChar} **📎 Attachment:** ${attachment.fileName}`;
        }
        
        // Add file metadata
        if (attachment.fileType) {
            content += ` (${attachment.fileType})`;
        }
        
        if (attachment.fileSize) {
            content += ` - ${this.formatFileSize(attachment.fileSize)}`;
        }

        // Handle successful extraction
        if (attachment.status?.found && attachment.url) {
            // Skip sandbox:// URLs - they don't work in Obsidian
            if (!attachment.url.startsWith('sandbox://')) {
                if (this.isImageFile(attachment)) {
                    content += `\n${quoteChar} ![[${attachment.url}]]`; // Embed images
                } else {
                    content += `\n${quoteChar} [[${attachment.url}]]`; // Link documents
                }
            } else {
                // Sandbox URL - explain to user
                content += `\n${quoteChar} **Status:** ⚠️ File not available in archive. Visit the original conversation to access it`;
            }
        }

        // Handle missing/failed attachments with informative notes
        if (attachment.status && !attachment.status.found) {
            content += `\n${quoteChar} **Status:** ⚠️ ${this.getStatusMessage(attachment.status.reason)}`;
            
            if (attachment.status.note) {
                content += `\n${quoteChar} **Note:** ${attachment.status.note}`;
            }
        }

        // Add DALL-E prompt in codebox (special case for DALL-E images)
        if (attachment.extractedContent && this.isDalleImage(attachment)) {
            content += `\n${quoteChar} **Prompt:**\n${quoteChar} \`\`\`\n${quoteChar} ${attachment.extractedContent}\n${quoteChar} \`\`\``;
        }
        // Add extracted content for other types (transcriptions, OCR, code, etc.)
        else if (attachment.extractedContent) {
            content += `\n${quoteChar} **Content:**\n`;
            content += attachment.extractedContent
                .split("\n")
                .map(line => `${quoteChar} ${line}`)
                .join("\n");
        }

        // Add raw content for text files - always show if available
        if (attachment.content && !attachment.extractedContent) {
            content += `\n${quoteChar} **Content:**\n`;
            content += attachment.content
                .split("\n")
                .map(line => `${quoteChar} ${line}`)
                .join("\n");
        }

        return content;
    }

    /**
     * Check if attachment is a DALL-E generated image
     */
    private isDalleImage(attachment: StandardAttachment): boolean {
        // Check if filename follows DALL-E pattern: dalle_genId_widthxheight.png
        return attachment.fileName.startsWith('dalle_') && 
               attachment.fileName.includes('_') && 
               attachment.fileType === 'image/png';
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