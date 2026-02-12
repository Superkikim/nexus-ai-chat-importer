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

import { StandardConversation } from "../../types/standard";
import { LeChatConverter } from "./lechat-converter";
import { LeChatAttachmentExtractor } from "./lechat-attachment-extractor";
import { LeChatReportNamingStrategy } from "./lechat-report-naming";
import { LeChatConversation, LeChatMessage } from "./lechat-types";
import type NexusAiChatImporterPlugin from "../../main";
import { BaseProviderAdapter, AttachmentExtractor } from "../base/base-provider-adapter";

/**
 * Provider adapter for Le Chat (Mistral AI)
 * 
 * Le Chat exports conversations as individual JSON files:
 * - chat-{uuid}.json - Array of messages (no wrapper object)
 * - chat-{uuid}-files/ - Directory containing attachments
 */
export class LeChatAdapter extends BaseProviderAdapter<LeChatConversation> {
    private attachmentExtractor: LeChatAttachmentExtractor;
    private reportNamingStrategy: LeChatReportNamingStrategy;

    constructor(private plugin: NexusAiChatImporterPlugin) {
        super();
        this.attachmentExtractor = new LeChatAttachmentExtractor(plugin, plugin.logger);
        this.reportNamingStrategy = new LeChatReportNamingStrategy();
    }

    /**
     * Detect if raw data is from Le Chat
     * 
     * Le Chat format:
     * - Array of messages (not wrapped in conversation object)
     * - Each message has: chatId, contentChunks, createdAt, role
     */
    detect(rawConversations: any[]): boolean {
        if (rawConversations.length === 0) return false;
        
        const sample = rawConversations[0];
        
        // Le Chat: array of messages with specific structure
        return Array.isArray(sample) && 
               sample.length > 0 &&
               sample[0].chatId !== undefined &&
               sample[0].contentChunks !== undefined &&
               sample[0].createdAt !== undefined &&
               sample[0].role !== undefined;
    }

    /**
     * Get conversation ID from first message's chatId field
     */
    getId(chat: LeChatConversation): string {
        return chat[0]?.chatId || "";
    }

    /**
     * Get conversation title
     * Derived from first user message (truncated to 50 chars)
     */
    getTitle(chat: LeChatConversation): string {
        const firstUserMessage = chat.find(msg => msg.role === 'user');
        
        if (firstUserMessage && firstUserMessage.content) {
            const content = firstUserMessage.content.trim();
            if (content.length > 50) {
                return content.substring(0, 50).trim() + '...';
            }
            return content;
        }

        return "Untitled";
    }

    /**
     * Get conversation creation time (minimum message timestamp)
     */
    getCreateTime(chat: LeChatConversation): number {
        const timestamps = chat
            .map(msg => this.parseTimestamp(msg.createdAt))
            .filter(ts => ts > 0);

        return timestamps.length > 0 ? Math.min(...timestamps) : 0;
    }

    /**
     * Get conversation update time (maximum message timestamp)
     */
    getUpdateTime(chat: LeChatConversation): number {
        const timestamps = chat
            .map(msg => this.parseTimestamp(msg.createdAt))
            .filter(ts => ts > 0);

        return timestamps.length > 0 ? Math.max(...timestamps) : 0;
    }

    /**
     * Convert Le Chat conversation to StandardConversation
     */
    convertChat(chat: LeChatConversation): StandardConversation {
        return LeChatConverter.convertChat(chat);
    }

    /**
     * Get provider name
     */
    getProviderName(): string {
        return "lechat";
    }

    /**
     * Get new messages not in existing message IDs
     */
    getNewMessages(chat: LeChatConversation, existingMessageIds: string[]): LeChatMessage[] {
        return chat.filter(msg => !existingMessageIds.includes(msg.id));
    }

    /**
     * Get report naming strategy
     */
    getReportNamingStrategy() {
        return this.reportNamingStrategy;
    }

    /**
     * Get attachment extractor (required by BaseProviderAdapter)
     */
    protected getAttachmentExtractor(): AttachmentExtractor {
        return this.attachmentExtractor;
    }

    /**
     * Parse ISO 8601 timestamp to Unix seconds
     */
    private parseTimestamp(isoString: string): number {
        try {
            const date = new Date(isoString);
            return Math.floor(date.getTime() / 1000);
        } catch (error) {
            return 0;
        }
    }
}

