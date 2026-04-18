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
