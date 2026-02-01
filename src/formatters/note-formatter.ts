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


// src/formatters/note-formatter.ts
import { StandardConversation } from "../types/standard";
import { formatTimestamp, generateSafeAlias } from "../utils";
import { MessageFormatter } from "./message-formatter";
import { Logger } from "../logger";
import { URL_GENERATORS } from "../types/standard";
import type NexusAiChatImporterPlugin from "../main";

export class NoteFormatter {
    private messageFormatter: MessageFormatter;

    constructor(
        private logger: Logger,
        private pluginId: string,
        private pluginVersion: string,
        private plugin: NexusAiChatImporterPlugin
    ) {
        this.messageFormatter = new MessageFormatter(logger, plugin);
    }

    generateMarkdownContent(conversation: StandardConversation): string {
        const safeTitle = generateSafeAlias(conversation.title);

        // Generate local ISO 8601 timestamps for frontmatter (Obsidian format: YYYY-MM-DDTHH:mm:ss)
        const createTimeStr = this.toLocalISOString(new Date(conversation.createTime * 1000));
        const updateTimeStr = this.toLocalISOString(new Date(conversation.updateTime * 1000));

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
update_time: ${updateTimeStr}`;

        if (chatUrl) {
            frontmatter += `\nchat_url: ${chatUrl}`;
        }

        frontmatter += `\n---\n`;

        // Build header content
        let header = `# ${conversation.title}\n\n`;

        return frontmatter + header;
    }

    private toLocalISOString(date: Date): string {
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
    }

    private generateMessagesContent(conversation: StandardConversation): string {
        return this.messageFormatter.formatMessages(conversation.messages);
    }
}