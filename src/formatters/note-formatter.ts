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

        // Generate ISO 8601 timestamps for frontmatter (v1.3.0+)
        const createTimeStr = new Date(conversation.createTime * 1000).toISOString();
        const updateTimeStr = new Date(conversation.updateTime * 1000).toISOString();

        // Generate user-friendly timestamps for note body
        const createTimeDisplay = `${formatTimestamp(conversation.createTime, "date")} at ${formatTimestamp(conversation.createTime, "time")}`;
        const updateTimeDisplay = `${formatTimestamp(conversation.updateTime, "date")} at ${formatTimestamp(conversation.updateTime, "time")}`;

        let content = this.generateHeader(safeTitle, conversation.id, createTimeStr, updateTimeStr, createTimeDisplay, updateTimeDisplay, conversation);
        content += this.generateMessagesContent(conversation);
        content += this.generateRelatedQueriesSection(conversation);

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

        const mode = this.extractMode(conversation);
        const models = this.extractModels(conversation);
        const modeLine = mode ? `mode: "${mode.replace(/"/g, '\\"')}"\n` : "";
        const modelsBlock = models.length > 0
            ? `models:\n${models.map(model => `  - "${model.replace(/"/g, '\\"')}"`).join("\n")}\n`
            : "";

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
${modeLine}${modelsBlock}---
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

    private extractMode(conversation: StandardConversation): string | undefined {
        const mode = conversation.metadata?.mode;
        return typeof mode === "string" && mode.trim().length > 0 ? mode.trim() : undefined;
    }

    private extractModels(conversation: StandardConversation): string[] {
        const metadata = conversation.metadata || {};
        const fromMetadata = Array.isArray(conversation.metadata?.models)
            ? (metadata.models as string[])
            : [];
        const fromMessages = conversation.messages
            .map(message => message.model)
            .filter((model): model is string => typeof model === "string" && model.trim().length > 0);

        const seen = new Set<string>();
        const models: string[] = [];
        for (const model of [...fromMetadata, ...fromMessages]) {
            const normalized = model.trim();
            if (!normalized || seen.has(normalized)) continue;
            seen.add(normalized);
            models.push(normalized);
        }
        return models;
    }

    private generateRelatedQueriesSection(conversation: StandardConversation): string {
        const relatedQueries = conversation.metadata?.related_queries;
        if (!Array.isArray(relatedQueries)) {
            return "";
        }

        const normalized = relatedQueries
            .filter((query): query is string => typeof query === "string")
            .map(query => query.trim())
            .filter(query => query.length > 0);

        if (normalized.length === 0) {
            return "";
        }

        const uniqueQueries = [...new Set(normalized)];
        const lines = uniqueQueries.map(query => `- ${query}`).join("\n");
        return `\n\n## Related Queries\n${lines}`;
    }
}
