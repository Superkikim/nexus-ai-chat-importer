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

import { StandardConversation, StandardMessage } from "../../types/standard";
import { PerplexityConversationFile, PerplexityTurn } from "./perplexity-types";
import { PROVIDER_URLS } from "../../config/constants";

export class PerplexityConverter {
    static convertChat(chat: PerplexityConversationFile): StandardConversation {
        const turns = [...(chat.conversations || [])]
            .filter(turn => !!turn?.uuid)
            .sort((a, b) => this.parseTimestamp(a.timestamp) - this.parseTimestamp(b.timestamp));

        const messages: StandardMessage[] = [];
        for (const turn of turns) {
            const timestamp = this.parseTimestamp(turn.timestamp);
            const query = (turn.query || "").trim();
            const answer = (turn.answer || "").trim();

            if (query.length > 0) {
                messages.push({
                    id: `${turn.uuid}-user`,
                    role: "user",
                    content: query,
                    timestamp,
                });
            }

            if (answer.length > 0) {
                messages.push({
                    id: turn.uuid,
                    role: "assistant",
                    content: this.withReferences(answer, turn.sources),
                    timestamp: timestamp + 1,
                    model: turn.model,
                });
            }
        }

        const uniqueModels = this.uniqueNonEmpty(turns.map(turn => turn.model));
        const uniqueModes = this.uniqueNonEmpty(turns.map(turn => turn.mode));
        const relatedQueries = this.uniqueNonEmpty(turns.flatMap(turn => turn.related_queries || []));

        const threadId = chat.metadata?.thread_id || "";
        const title = (chat.metadata?.thread_title || "").trim() || "Untitled";
        const createTime = this.parseTimestamp(chat.metadata?.thread_created_at) || this.getMinTimestamp(turns);
        const updateTime = this.parseTimestamp(chat.metadata?.thread_updated_at) || this.getMaxTimestamp(turns);

        return {
            id: threadId,
            title,
            provider: "perplexity",
            createTime,
            updateTime,
            messages,
            chatUrl: this.buildThreadUrl(chat.metadata?.thread_url),
            metadata: {
                mode: uniqueModes.length === 1 ? uniqueModes[0] : undefined,
                models: uniqueModels,
                related_queries: relatedQueries,
                thread_url: chat.metadata?.thread_url,
                exported_at: chat.metadata?.exported_at,
                export_version: chat.metadata?.export_version,
            },
        };
    }

    private static withReferences(answer: string, sources?: { title?: string; url?: string; snippet?: string }[]): string {
        if (!sources || sources.length === 0) {
            return answer;
        }

        const referenceLines = sources
            .map((source, index) => {
                const title = (source.title || "").trim() || `Source ${index + 1}`;
                const url = (source.url || "").trim();
                const snippet = (source.snippet || "").trim();

                let line = `${index + 1}. ${url ? `[${title}](${url})` : title}`;
                if (snippet) {
                    line += `\n   - ${snippet}`;
                }
                return line;
            })
            .filter(Boolean);

        if (referenceLines.length === 0) {
            return answer;
        }

        return `${answer}\n\n### References\n${referenceLines.join("\n")}`;
    }

    private static parseTimestamp(value?: string): number {
        if (!value) return 0;
        const timestamp = new Date(value).getTime();
        if (Number.isNaN(timestamp)) return 0;
        return Math.floor(timestamp / 1000);
    }

    private static getMinTimestamp(turns: PerplexityTurn[]): number {
        const timestamps = turns
            .map(turn => this.parseTimestamp(turn.timestamp))
            .filter(ts => ts > 0);
        return timestamps.length > 0 ? Math.min(...timestamps) : 0;
    }

    private static getMaxTimestamp(turns: PerplexityTurn[]): number {
        const timestamps = turns
            .map(turn => this.parseTimestamp(turn.timestamp))
            .filter(ts => ts > 0);
        return timestamps.length > 0 ? Math.max(...timestamps) : 0;
    }

    private static uniqueNonEmpty(values: Array<string | undefined>): string[] {
        const seen = new Set<string>();
        const result: string[] = [];
        for (const value of values) {
            const normalized = (value || "").trim();
            if (!normalized || seen.has(normalized)) continue;
            seen.add(normalized);
            result.push(normalized);
        }
        return result;
    }

    private static buildThreadUrl(threadUrl?: string): string | undefined {
        const value = (threadUrl || "").trim();
        if (!value) return undefined;
        if (value.startsWith("http://") || value.startsWith("https://")) {
            return value;
        }
        return `${PROVIDER_URLS.PERPLEXITY.BASE}/search/${value}`;
    }
}
