// src/formatters/note-formatter.ts
import { StandardConversation } from "../types/standard-types";
import { formatTimestamp, formatTitle } from "../utils";
import { MessageFormatter } from "./message-formatter";
import { Logger } from "../logger";
import { URL_GENERATORS } from "../types/standard-types";

export class NoteFormatter {
    private messageFormatter: MessageFormatter;

    constructor(private logger: Logger, private pluginId: string) {
        this.messageFormatter = new MessageFormatter(logger);
    }

    generateMarkdownContent(conversation: StandardConversation): string {
        const formattedTitle = formatTitle(conversation.title);
        const createTimeStr = `${formatTimestamp(conversation.createTime, "date")} at ${formatTimestamp(conversation.createTime, "time")}`;
        const updateTimeStr = `${formatTimestamp(conversation.updateTime, "date")} at ${formatTimestamp(conversation.updateTime, "time")}`;

        let content = this.generateHeader(formattedTitle, conversation.id, createTimeStr, updateTimeStr, conversation);
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

        // Build frontmatter
        let frontmatter = `---
nexus: ${this.pluginId}
provider: ${conversation.provider}
aliases: "${title}"
conversation_id: ${conversationId}
create_time: ${createTimeStr}
update_time: ${updateTimeStr}`;

        // Add provider-specific metadata
        if (conversation.metadata) {
            Object.entries(conversation.metadata).forEach(([key, value]) => {
                frontmatter += `\n${key}: ${value}`;
            });
        }

        frontmatter += `\n---\n\n`;

        // Build header content
        let header = `# Title: ${title}\n\n`;
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