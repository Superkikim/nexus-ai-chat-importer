// src/formatters/note-formatter.ts
import { StandardConversation } from "../types/standard";
import { formatTimestamp, generateSafeAlias } from "../utils";
import { MessageFormatter } from "./message-formatter";
import { Logger } from "../logger";
import { URL_GENERATORS } from "../types/standard";

export class NoteFormatter {
    private messageFormatter: MessageFormatter;

    constructor(private logger: Logger, private pluginId: string, private pluginVersion: string) {
        this.messageFormatter = new MessageFormatter(logger);
    }

    generateMarkdownContent(conversation: StandardConversation): string {
        const safeTitle = generateSafeAlias(conversation.title);

        // Generate ISO 8601 timestamps for frontmatter (v1.3.0+)
        const createTimeStr = new Date(conversation.createTime * 1000).toISOString();
        const updateTimeStr = new Date(conversation.updateTime * 1000).toISOString();

        // Generate user-friendly timestamps for note body
        const createTimeDisplay = `${formatTimestamp(conversation.createTime, "date")} at ${formatTimestamp(conversation.createTime, "time")}`;
        const updateTimeDisplay = `${formatTimestamp(conversation.updateTime, "date")} at ${formatTimestamp(conversation.updateTime, "time")}`;

        let content = this.generateHeader(safeTitle, conversation.id, createTimeStr, updateTimeStr, createTimeDisplay, updateTimeDisplay, conversation);
        content += this.generateMessagesContent(conversation);

        return content;
    }

    private generateHeader(
        title: string,
        conversationId: string,
        createTimeStr: string,
        updateTimeStr: string,
        createTimeDisplay: string,
        updateTimeDisplay: string,
        conversation: StandardConversation
    ): string {
        // Generate chat URL
        let chatUrl = conversation.chatUrl;
        if (!chatUrl && URL_GENERATORS[conversation.provider]) {
            chatUrl = URL_GENERATORS[conversation.provider].generateChatUrl(conversationId);
        }

        // Build frontmatter with plugin_version after nexus
        // Timestamps in ISO 8601 format (v1.3.0+)
        let frontmatter = `---
nexus: ${this.pluginId}
plugin_version: "${this.pluginVersion}"
provider: ${conversation.provider}
aliases: ${title}
conversation_id: ${conversationId}
create_time: ${createTimeStr}
update_time: ${updateTimeStr}
---

`;

        // Build header content - use original title for display, safe title for frontmatter
        // Display timestamps in user-friendly format
        let header = `# Title: ${conversation.title}\n\n`;
        header += `Created: ${createTimeDisplay}\n`;
        header += `Last Updated: ${updateTimeDisplay}\n`;

        if (chatUrl) {
            header += `Chat URL: ${chatUrl}\n`;
        }

        header += '\n\n';

        return frontmatter + header;
    }

    private generateMessagesContent(conversation: StandardConversation): string {
        return this.messageFormatter.formatMessages(conversation.messages);
    }
}