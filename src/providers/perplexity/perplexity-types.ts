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

export interface PerplexitySource {
    title?: string;
    url?: string;
    snippet?: string;
}

export interface PerplexityTurn {
    index?: number;
    uuid: string;
    query?: string;
    answer?: string;
    model?: string;
    mode?: string;
    timestamp?: string;
    language?: string;
    related_queries?: string[];
    sources?: PerplexitySource[];
}

export interface PerplexityThreadMetadata {
    thread_title?: string;
    thread_url?: string;
    thread_id?: string;
    total_entries?: number;
    exported_at?: string;
    export_version?: string;
    thread_created_at?: string;
    thread_updated_at?: string;
}

export interface PerplexityConversationFile {
    metadata: PerplexityThreadMetadata;
    conversations: PerplexityTurn[];
}

export interface PerplexityEntryMarkdownBlock {
    answer?: string;
    chunks?: string[];
}

export interface PerplexityEntryBlock {
    intended_usage?: string;
    markdown_block?: PerplexityEntryMarkdownBlock;
}

export interface PerplexityRelatedQueryItem {
    text?: string;
    type?: string;
}

export interface PerplexityEntry {
    uuid?: string;
    backend_uuid?: string;
    context_uuid?: string;
    thread_title?: string;
    thread_url_slug?: string;
    query_str?: string;
    display_model?: string;
    user_selected_model?: string;
    mode?: string;
    related_queries?: string[];
    related_query_items?: PerplexityRelatedQueryItem[];
    blocks?: PerplexityEntryBlock[];
    entry_created_datetime?: string;
    entry_updated_datetime?: string;
    updated_datetime?: string;
}

export interface PerplexityEntryThreadMetadata {
    title?: string;
    created_at?: string;
    updated_at?: string;
}

export interface PerplexityEntryExportFile {
    status?: string;
    entries?: PerplexityEntry[];
    thread_metadata?: PerplexityEntryThreadMetadata;
}

export type PerplexityRawConversationFile = PerplexityConversationFile | PerplexityEntryExportFile;
