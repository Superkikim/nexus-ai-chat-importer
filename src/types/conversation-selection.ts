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
