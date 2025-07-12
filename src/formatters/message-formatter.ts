// src/formatters/message-formatter.ts
import { StandardMessage, StandardAttachment } from "../types/standard-types";
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
            this.logger.warn("Message content missing:", message.id);
            messageContent += `${quoteChar} [No content]`;
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
            let content = `${quoteChar} **📎 Attachment:** ${attachment.fileName}`;
            
            if (attachment.fileType) {
                content += ` (${attachment.fileType})`;
            }
            
            if (attachment.fileSize) {
                content += ` - ${this.formatFileSize(attachment.fileSize)}`;
            }

            // Add URL if available
            if (attachment.url) {
                content += `\n${quoteChar} **Link:** ${attachment.url}`;
            }

            // Add extracted content (transcriptions, OCR, code, etc.)
            if (attachment.extractedContent) {
                content += `\n${quoteChar} **Content:**\n`;
                content += attachment.extractedContent
                    .split("\n")
                    .map(line => `${quoteChar} ${line}`)
                    .join("\n");
            }

            // Add raw content for text files
            if (attachment.content && !attachment.extractedContent) {
                content += `\n${quoteChar} **Content:**\n`;
                content += attachment.content
                    .split("\n")
                    .map(line => `${quoteChar} ${line}`)
                    .join("\n");
            }

            return content;
        }).join("\n\n");
    }

    private formatFileSize(bytes: number): string {
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        if (bytes === 0) return '0 Bytes';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }
}