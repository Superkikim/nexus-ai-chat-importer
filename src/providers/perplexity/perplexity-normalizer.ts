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

import {
    PerplexityConversationFile,
    PerplexityEntry,
    PerplexityEntryExportFile,
    PerplexityRawConversationFile,
    PerplexitySource,
    PerplexityTurn,
} from "./perplexity-types";

export function normalizePerplexityConversationFile(raw: PerplexityRawConversationFile): PerplexityConversationFile | null {
    if (!raw || typeof raw !== "object") {
        return null;
    }

    const legacy = tryNormalizeLegacy(raw as Partial<PerplexityConversationFile>);
    if (legacy) {
        return legacy;
    }

    return tryNormalizeEntriesExport(raw as Partial<PerplexityEntryExportFile>);
}

function tryNormalizeLegacy(raw: Partial<PerplexityConversationFile>): PerplexityConversationFile | null {
    if (!raw.metadata || !Array.isArray(raw.conversations)) {
        return null;
    }

    const turns = raw.conversations
        .map(turn => normalizeTurnFromLegacy(turn))
        .filter((turn): turn is PerplexityTurn => turn !== null);

    const threadId = normalizeString(raw.metadata.thread_id) || turns[0]?.uuid || "";
    const threadTitle = normalizeString(raw.metadata.thread_title) || "Untitled";
    const threadUrl = normalizeString(raw.metadata.thread_url);

    return {
        metadata: {
            thread_id: threadId,
            thread_title: threadTitle,
            thread_url: threadUrl,
            total_entries: raw.metadata.total_entries,
            exported_at: normalizeString(raw.metadata.exported_at),
            export_version: normalizeString(raw.metadata.export_version),
            thread_created_at: normalizeString(raw.metadata.thread_created_at),
            thread_updated_at: normalizeString(raw.metadata.thread_updated_at),
        },
        conversations: turns,
    };
}

function tryNormalizeEntriesExport(raw: Partial<PerplexityEntryExportFile>): PerplexityConversationFile | null {
    if (!Array.isArray(raw.entries)) {
        return null;
    }

    const turns = raw.entries
        .map(entry => normalizeTurnFromEntry(entry))
        .filter((turn): turn is PerplexityTurn => turn !== null)
        .sort((a, b) => parseTimestampMs(a.timestamp) - parseTimestampMs(b.timestamp));

    if (turns.length === 0) {
        return null;
    }

    const firstEntry = raw.entries.find(isRecord) as PerplexityEntry | undefined;
    const slug = normalizeString(firstEntry?.thread_url_slug);
    const firstEntryTimestamp = normalizeString(firstEntry?.entry_created_datetime)
        || normalizeString(firstEntry?.entry_updated_datetime)
        || normalizeString(firstEntry?.updated_datetime);
    const lastEntry = [...raw.entries]
        .filter(isRecord)
        .sort((a, b) => {
            const aEntry = a as PerplexityEntry;
            const bEntry = b as PerplexityEntry;
            const aTimestamp = normalizeString(aEntry.entry_updated_datetime)
                || normalizeString(aEntry.updated_datetime)
                || normalizeString(aEntry.entry_created_datetime);
            const bTimestamp = normalizeString(bEntry.entry_updated_datetime)
                || normalizeString(bEntry.updated_datetime)
                || normalizeString(bEntry.entry_created_datetime);
            return parseTimestampMs(aTimestamp) - parseTimestampMs(bTimestamp);
        })
        .pop() as PerplexityEntry | undefined;

    const threadId = slug || turns[0].uuid;
    const threadTitle = normalizeString(raw.thread_metadata?.title)
        || normalizeString(firstEntry?.thread_title)
        || "Untitled";

    const threadCreatedAt = normalizeString(raw.thread_metadata?.created_at)
        || firstEntryTimestamp
        || turns[0].timestamp;
    const threadUpdatedAt = normalizeString(raw.thread_metadata?.updated_at)
        || normalizeString(lastEntry?.entry_updated_datetime)
        || normalizeString(lastEntry?.updated_datetime)
        || turns[turns.length - 1].timestamp;

    return {
        metadata: {
            thread_id: threadId,
            thread_title: threadTitle,
            thread_url: slug,
            total_entries: raw.entries.length,
            thread_created_at: threadCreatedAt,
            thread_updated_at: threadUpdatedAt,
        },
        conversations: turns,
    };
}

function normalizeTurnFromLegacy(raw: unknown): PerplexityTurn | null {
    if (!isRecord(raw)) return null;

    const uuid = normalizeString(raw.uuid);
    if (!uuid) return null;

    const query = normalizeString(raw.query);
    const answer = normalizeString(raw.answer);

    if (!query && !answer) {
        return null;
    }

    return {
        uuid,
        query,
        answer,
        model: normalizeString(raw.model),
        mode: normalizeString(raw.mode),
        timestamp: normalizeString(raw.timestamp),
        language: normalizeString(raw.language),
        related_queries: normalizeRelatedQueries(raw.related_queries),
        sources: normalizeSources(raw.sources),
    };
}

function normalizeTurnFromEntry(raw: unknown): PerplexityTurn | null {
    if (!isRecord(raw)) return null;

    const entry = raw as PerplexityEntry;
    const uuid = normalizeString(entry.uuid) || normalizeString(entry.backend_uuid);
    if (!uuid) return null;

    const query = normalizeString(entry.query_str);
    const answer = extractAnswer(entry);

    if (!query && !answer) {
        return null;
    }

    const relatedQueries = normalizeRelatedQueries(entry.related_queries)
        || normalizeRelatedQueryItems(entry.related_query_items);

    return {
        uuid,
        query,
        answer,
        model: normalizeString(entry.display_model) || normalizeString(entry.user_selected_model),
        mode: normalizeString(entry.mode),
        timestamp: normalizeString(entry.entry_created_datetime)
            || normalizeString(entry.entry_updated_datetime)
            || normalizeString(entry.updated_datetime),
        related_queries: relatedQueries,
    };
}

function extractAnswer(entry: PerplexityEntry): string | undefined {
    if (!Array.isArray(entry.blocks)) return undefined;

    for (const block of entry.blocks) {
        if (!isRecord(block) || !isRecord(block.markdown_block)) continue;

        const directAnswer = normalizeString(block.markdown_block.answer);
        if (directAnswer) return directAnswer;

        if (Array.isArray(block.markdown_block.chunks)) {
            const merged = block.markdown_block.chunks
                .filter((chunk): chunk is string => typeof chunk === "string")
                .join("")
                .trim();
            if (merged.length > 0) return merged;
        }
    }

    return undefined;
}

function normalizeRelatedQueries(value: unknown): string[] | undefined {
    if (!Array.isArray(value)) return undefined;

    const seen = new Set<string>();
    const queries: string[] = [];

    for (const item of value) {
        const text = normalizeString(item);
        if (!text || seen.has(text)) continue;
        seen.add(text);
        queries.push(text);
    }

    return queries.length > 0 ? queries : undefined;
}

function normalizeRelatedQueryItems(value: unknown): string[] | undefined {
    if (!Array.isArray(value)) return undefined;

    const seen = new Set<string>();
    const queries: string[] = [];

    for (const item of value) {
        if (!isRecord(item)) continue;
        const text = normalizeString(item.text);
        if (!text || seen.has(text)) continue;
        seen.add(text);
        queries.push(text);
    }

    return queries.length > 0 ? queries : undefined;
}

function normalizeSources(value: unknown): PerplexitySource[] | undefined {
    if (!Array.isArray(value)) return undefined;

    const sources: PerplexitySource[] = value
        .filter(isRecord)
        .map(source => ({
            title: normalizeString(source.title),
            url: normalizeString(source.url),
            snippet: normalizeString(source.snippet),
        }))
        .filter(source => !!(source.title || source.url || source.snippet));

    return sources.length > 0 ? sources : undefined;
}

function normalizeString(value: unknown): string | undefined {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}

function parseTimestampMs(value?: string): number {
    if (!value) return 0;
    const ts = new Date(value).getTime();
    return Number.isFinite(ts) ? ts : 0;
}

function isRecord(value: unknown): value is Record<string, any> {
    return !!value && typeof value === "object" && !Array.isArray(value);
}
