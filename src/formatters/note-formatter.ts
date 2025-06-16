// src/formatters/note-formatter.ts
import { Chat } from "../types";
import { formatTimestamp, formatTitle, isValidMessage } from "../utils";
import { MessageFormatter } from "./message-formatter";
import { Logger } from "../logger";

export class NoteFormatter {
    private messageFormatter: MessageFormatter;

    constructor(private logger: Logger, private pluginId: string) {
        this.messageFormatter = new MessageFormatter(logger);
    }

    generateMarkdownContent(chat: Chat): string {
        const formattedTitle = formatTitle(chat.title);
        const create_time_str = `${formatTimestamp(chat.create_time, "date")} at ${formatTimestamp(chat.create_time, "time")}`;
        const update_time_str = `${formatTimestamp(chat.update_time, "date")} at ${formatTimestamp(chat.update_time, "time")}`;

        let content = this.generateHeader(formattedTitle, chat.id, create_time_str, update_time_str);
        content += this.generateMessagesContent(chat);

        return content;
    }

    private generateHeader(title: string, conversationId: string, createTimeStr: string, updateTimeStr: string): string {
        return `---
nexus: ${this.pluginId}
provider: chatgpt
aliases: "${title}"
conversation_id: ${conversationId}
create_time: ${createTimeStr}
update_time: ${updateTimeStr}
---

# Title: ${title}

Created: ${createTimeStr}
Last Updated: ${updateTimeStr}\n\n
`;
    }

    private generateMessagesContent(chat: Chat): string {
        let messagesContent = "";
        for (const messageId in chat.mapping) {
            const messageObj = chat.mapping[messageId];
            if (messageObj?.message && isValidMessage(messageObj.message)) {
                messagesContent += this.messageFormatter.formatMessage(messageObj.message);
            }
        }
        return messagesContent;
    }
}