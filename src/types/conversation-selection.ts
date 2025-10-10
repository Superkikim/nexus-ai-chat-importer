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


// src/types/conversation-selection.ts

/**
 * Import mode selection
 */
export type ImportMode = 'all' | 'selective';

/**
 * File selection result with import mode
 */
export interface FileSelectionResult {
    files: File[];
    mode: ImportMode;
    provider: string;
}

/**
 * Conversation selection result
 */
export interface ConversationSelectionResult {
    selectedIds: string[];
    totalAvailable: number;
    mode: ImportMode;
}

/**
 * Pagination settings for conversation selection
 */
export interface PaginationSettings {
    pageSize: number;
    currentPage: number;
    totalPages: number;
    totalItems: number;
}

/**
 * Sort options for conversation list
 */
export interface SortOptions {
    field: 'title' | 'createTime' | 'updateTime' | 'messageCount';
    direction: 'asc' | 'desc';
}

/**
 * Filter options for conversation list
 */
export interface FilterOptions {
    searchTerm?: string;
    dateRange?: {
        start?: Date;
        end?: Date;
    };
    minMessages?: number;
    maxMessages?: number;
    showStarred?: boolean;
    showArchived?: boolean;
    existenceStatus?: 'all' | 'new' | 'updated' | 'unchanged'; // New filter for existence status
}

/**
 * Conversation selection state
 */
export interface ConversationSelectionState {
    allConversations: import('../services/conversation-metadata-extractor').ConversationMetadata[];
    filteredConversations: import('../services/conversation-metadata-extractor').ConversationMetadata[];
    selectedIds: Set<string>;
    pagination: PaginationSettings;
    sort: SortOptions;
    filter: FilterOptions;
    isLoading: boolean;
    error?: string;
}
