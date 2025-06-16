// src/formatters/message-formatter.ts
import { ChatMessage } from "../types";
import { formatTimestamp } from "../utils";
import { Logger } from "../logger";

export class MessageFormatter {
    constructor(private logger: Logger) {}

    formatMessages(messages: ChatMessage[]): string {
        return messages
            .filter(message => message !== undefined)
            .map(message => this.formatMessage(message))
            .filter(formattedMessage => formattedMessage !== "")
            .join("\n\n");
    }

    formatMessage(message: ChatMessage): string {
        if (!message) {
            this.logger.error("Message is null or undefined:", message);
            return "";
        }

        const messageTime = 
            formatTimestamp(message.create_time || Date.now() / 1000, "date") +
            " at " +
            formatTimestamp(message.create_time || Date.now() / 1000, "time");

        let authorName = "Unknown";
        if (message.author && typeof message.author === "object" && "role" in message.author) {
            authorName = message.author.role === "user" ? "User" : "ChatGPT";
        } else {
            this.logger.warn("Author information missing or invalid:", message.author);
        }

        const headingLevel = authorName === "User" ? "###" : "####";
        const quoteChar = authorName === "User" ? ">" : ">>";

        let messageContent = `${headingLevel} ${authorName}, on ${messageTime};\n`;

        if (
            message.content &&
            typeof message.content === "object" &&
            Array.isArray(message.content.parts)
        ) {
            if (message.content.content_type === "multimodal_text") {
                console.log("Processing multimodal message:", message.id);
            }
            
            const messageText = message.content.parts
                .filter(part => 
                    typeof part === "string" || 
                    (typeof part === "object" && (part.content_type === "audio_transcription" || part.text))
                )
                .map(part => {
                    if (typeof part === "string") return part;
                    return part.text || "";
                })
                .join("\n");

            if (messageText) {
                messageContent += messageText
                    .split("\n")
                    .map(line => `${quoteChar} ${line}`)
                    .join("\n");
            } else {
                this.logger.warn("Message content has no text parts:", message.content);
                messageContent += `${quoteChar} [No text content]`;
            }
        } else {
            this.logger.warn("Message content missing or invalid:", message.content);
            messageContent += `${quoteChar} [No content]`;
        }

        messageContent += `\n<!-- UID: ${message.id || "unknown"} -->\n`;

        if (authorName === "ChatGPT") {
            messageContent += "\n---\n";
        }

        return messageContent + "\n\n";
    }
}