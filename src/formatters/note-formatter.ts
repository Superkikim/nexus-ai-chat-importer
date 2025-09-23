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
        const createTimeStr = `${formatTimestamp(conversation.createTime, "date")} at ${formatTimestamp(conversation.createTime, "time")}`;
        const updateTimeStr = `${formatTimestamp(conversation.updateTime, "date")} at ${formatTimestamp(conversation.updateTime, "time")}`;

        let content = this.generateHeader(safeTitle, conversation.id, createTimeStr, updateTimeStr, conversation);
        content += this.generateMessagesContent(conversation);

        return content;
    }

    private generateHeader(
        title: string, 
        conversationId: string, 
        createTimeStr: string, 
        updateTimeStr: string,
        conversation: StandardConversation
    ): string {
        // Generate chat URL
        let chatUrl = conversation.chatUrl;
        if (!chatUrl && URL_GENERATORS[conversation.provider]) {
            chatUrl = URL_GENERATORS[conversation.provider].generateChatUrl(conversationId);
        }

        // Build frontmatter with plugin_version after nexus
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
        let header = `# Title: ${conversation.title}\n\n`;
        header += `Created: ${createTimeStr}\n`;
        header += `Last Updated: ${updateTimeStr}\n`;

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