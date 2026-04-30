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
import { PerplexityConversationFile, PerplexityRawConversationFile, PerplexityTurn } from "./perplexity-types";
import { PerplexityConverter } from "./perplexity-converter";
import { PerplexityReportNamingStrategy } from "./perplexity-report-naming";
import { normalizePerplexityConversationFile } from "./perplexity-normalizer";

export class PerplexityAdapter implements ProviderAdapter<PerplexityRawConversationFile> {
    private reportNamingStrategy = new PerplexityReportNamingStrategy();
    constructor(_plugin?: unknown) {}

    detect(rawConversations: any[]): boolean {
        if (!Array.isArray(rawConversations) || rawConversations.length === 0) {
            return false;
        }

        const sample = this.normalize(rawConversations[0]);
        if (!sample) return false;
        if (!sample.metadata.thread_id || !sample.metadata.thread_title) return false;
        if (sample.conversations.length === 0) return false;

        const firstTurn = sample.conversations[0];
        return !!(firstTurn?.uuid && ("query" in firstTurn || "answer" in firstTurn));
    }

    getId(chat: PerplexityRawConversationFile): string {
        const normalized = this.normalize(chat);
        return normalized?.metadata?.thread_id || "";
    }

    getTitle(chat: PerplexityRawConversationFile): string {
        const normalized = this.normalize(chat);
        return (normalized?.metadata?.thread_title || "").trim() || "Untitled";
    }

    getCreateTime(chat: PerplexityRawConversationFile): number {
        const normalized = this.normalize(chat);
        if (!normalized) return 0;

        const fromMeta = this.parseTimestamp(normalized.metadata?.thread_created_at);
        if (fromMeta > 0) return fromMeta;

        const timestamps = (normalized.conversations || [])
            .map(turn => this.parseTimestamp(turn.timestamp))
            .filter(ts => ts > 0);
        return timestamps.length > 0 ? Math.min(...timestamps) : 0;
    }

    getUpdateTime(chat: PerplexityRawConversationFile): number {
        const normalized = this.normalize(chat);
        if (!normalized) return 0;

        const fromMeta = this.parseTimestamp(normalized.metadata?.thread_updated_at);
        if (fromMeta > 0) return fromMeta;

        const timestamps = (normalized.conversations || [])
            .map(turn => this.parseTimestamp(turn.timestamp))
            .filter(ts => ts > 0);
        return timestamps.length > 0 ? Math.max(...timestamps) : 0;
    }

    convertChat(chat: PerplexityRawConversationFile): StandardConversation {
        const normalized = this.normalize(chat);
        if (!normalized) {
            throw new Error("Invalid Perplexity conversation format");
        }
        return PerplexityConverter.convertChat(normalized);
    }

    getProviderName(): string {
        return "perplexity";
    }

    getNewMessages(chat: PerplexityRawConversationFile, existingMessageIds: string[]): PerplexityTurn[] {
        const normalized = this.normalize(chat);
        if (!normalized) return [];

        return (normalized.conversations || []).filter(turn => !!turn?.uuid && !existingMessageIds.includes(turn.uuid));
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

    private normalize(chat: PerplexityRawConversationFile): PerplexityConversationFile | null {
        return normalizePerplexityConversationFile(chat);
    }
}
