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
import { ProviderAdapter } from "../provider-adapter";
import { PerplexityConversationFile, PerplexityTurn } from "./perplexity-types";
import { PerplexityConverter } from "./perplexity-converter";
import { PerplexityReportNamingStrategy } from "./perplexity-report-naming";

export class PerplexityAdapter implements ProviderAdapter<PerplexityConversationFile> {
    private reportNamingStrategy = new PerplexityReportNamingStrategy();
    constructor(_plugin?: unknown) {}

    detect(rawConversations: any[]): boolean {
        if (!Array.isArray(rawConversations) || rawConversations.length === 0) {
            return false;
        }

        const sample = rawConversations[0];
        if (!sample || typeof sample !== "object") return false;
        if (!sample.metadata || !Array.isArray(sample.conversations)) return false;
        if (!sample.metadata.thread_id || !sample.metadata.thread_title) return false;
        if (sample.conversations.length === 0) return false;

        const firstTurn = sample.conversations[0];
        return !!(firstTurn?.uuid && ("query" in firstTurn || "answer" in firstTurn));
    }

    getId(chat: PerplexityConversationFile): string {
        return chat.metadata?.thread_id || "";
    }

    getTitle(chat: PerplexityConversationFile): string {
        return (chat.metadata?.thread_title || "").trim() || "Untitled";
    }

    getCreateTime(chat: PerplexityConversationFile): number {
        const fromMeta = this.parseTimestamp(chat.metadata?.thread_created_at);
        if (fromMeta > 0) return fromMeta;

        const timestamps = (chat.conversations || [])
            .map(turn => this.parseTimestamp(turn.timestamp))
            .filter(ts => ts > 0);
        return timestamps.length > 0 ? Math.min(...timestamps) : 0;
    }

    getUpdateTime(chat: PerplexityConversationFile): number {
        const fromMeta = this.parseTimestamp(chat.metadata?.thread_updated_at);
        if (fromMeta > 0) return fromMeta;

        const timestamps = (chat.conversations || [])
            .map(turn => this.parseTimestamp(turn.timestamp))
            .filter(ts => ts > 0);
        return timestamps.length > 0 ? Math.max(...timestamps) : 0;
    }

    convertChat(chat: PerplexityConversationFile): StandardConversation {
        return PerplexityConverter.convertChat(chat);
    }

    getProviderName(): string {
        return "perplexity";
    }

    getNewMessages(chat: PerplexityConversationFile, existingMessageIds: string[]): PerplexityTurn[] {
        return (chat.conversations || []).filter(turn => !!turn?.uuid && !existingMessageIds.includes(turn.uuid));
    }

    getReportNamingStrategy() {
        return this.reportNamingStrategy;
    }

    private parseTimestamp(value?: string): number {
        if (!value) return 0;
        const timestamp = new Date(value).getTime();
        if (Number.isNaN(timestamp)) return 0;
        return Math.floor(timestamp / 1000);
    }
}
