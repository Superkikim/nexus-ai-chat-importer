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
import { MistralVibeConverter } from "./vibe-converter";
import { MistralVibeAttachmentExtractor } from "./vibe-attachment-extractor";
import { MistralVibeReportNamingStrategy } from "./vibe-report-naming";
import { MistralVibeConversation, MistralVibeMessage } from "./vibe-types";
import { deriveMistralVibeConversationTitle } from "./vibe-title";
import type NexusAiChatImporterPlugin from "../../main";
import {
    BaseProviderAdapter,
    AttachmentExtractor,
} from "../base/base-provider-adapter";

/**
 * Provider adapter for Le Chat (Mistral AI)
 *
 * Le Chat exports conversations as individual JSON files:
 * - chat-{uuid}.json - Array of messages (no wrapper object)
 * - chat-{uuid}-files/ - Directory containing attachments
 */
export class MistralVibeAdapter extends BaseProviderAdapter<MistralVibeConversation> {
    private attachmentExtractor: MistralVibeAttachmentExtractor;
    private reportNamingStrategy: MistralVibeReportNamingStrategy;

    constructor(private plugin: NexusAiChatImporterPlugin) {
        super();
        this.attachmentExtractor = new MistralVibeAttachmentExtractor(
            plugin,
            plugin.logger
        );
        this.reportNamingStrategy = new MistralVibeReportNamingStrategy();
    }

    /**
     * Detect if raw data is from Le Chat
     *
     * Le Chat format:
     * - Array of messages (not wrapped in conversation object)
     * - Each message has: chatId, contentChunks, createdAt, role
     */
    detect(rawConversations: unknown[]): boolean {
        if (rawConversations.length === 0) return false;

        const sample = rawConversations[0];

        // Le Chat: array of messages with specific structure
        return (
            Array.isArray(sample) &&
            sample.length > 0 &&
            sample[0].chatId !== undefined &&
            sample[0].contentChunks !== undefined &&
            sample[0].createdAt !== undefined &&
            sample[0].role !== undefined
        );
    }

    /**
     * Get conversation ID from first message's chatId field
     */
    getId(chat: MistralVibeConversation): string {
        return chat[0]?.chatId || "";
    }

    /**
     * Get conversation title
     * Derived from first user message (truncated to 50 chars)
     */
    getTitle(chat: MistralVibeConversation): string {
        return deriveMistralVibeConversationTitle(chat);
    }

    /**
     * Get conversation creation time (minimum message timestamp)
     */
    getCreateTime(chat: MistralVibeConversation): number {
        const timestamps = chat
            .map((msg) => this.parseTimestamp(msg.createdAt))
            .filter((ts) => ts > 0);

        return timestamps.length > 0 ? Math.min(...timestamps) : 0;
    }

    /**
     * Get conversation update time (maximum message timestamp)
     */
    getUpdateTime(chat: MistralVibeConversation): number {
        const timestamps = chat
            .map((msg) => this.parseTimestamp(msg.createdAt))
            .filter((ts) => ts > 0);

        return timestamps.length > 0 ? Math.max(...timestamps) : 0;
    }

    /**
     * Convert Le Chat conversation to StandardConversation
     */
    convertChat(chat: MistralVibeConversation): StandardConversation {
        return MistralVibeConverter.convertChat(chat);
    }

    /**
     * Get provider name
     */
    getProviderName(): string {
        return "vibe";
    }

    /**
     * Get new messages not in existing message IDs
     */
    getNewMessages(
        chat: MistralVibeConversation,
        existingMessageIds: string[]
    ): MistralVibeMessage[] {
        return chat.filter((msg) => !existingMessageIds.includes(msg.id));
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
        } catch {
            return 0;
        }
    }
}
