// src/types/plugin.ts
export interface PluginSettings {
    // ========================================
    // 📁 FOLDER STRUCTURE
    // ========================================
    conversationFolder: string;
    reportFolder: string;
    attachmentFolder: string;

    // ========================================
    // 🎨 DISPLAY OPTIONS
    // ========================================
    addDatePrefix: boolean;
    dateFormat: 'YYYY-MM-DD' | 'YYYYMMDD';

    // ========================================
    // 🔧 INTERNAL SETTINGS (not shown in UI)
    // ========================================
    lastConversationsPerPage: number;

    // ========================================
    // 🔄 MIGRATION FLAGS
    // ========================================
    hasShownUpgradeNotice: boolean;
    hasCompletedUpgrade: boolean;
    currentVersion: string;
    previousVersion: string;

    // ========================================
    // 🗑️ DEPRECATED (will be removed in migration)
    // ========================================
    archiveFolder?: string;  // Renamed to conversationFolder
    importAttachments?: boolean;  // Always true now
    skipMissingAttachments?: boolean;  // Always handle attachments
    showAttachmentDetails?: boolean;  // Removed
    defaultImportMode?: 'all' | 'selective';  // Removed
    rememberLastImportMode?: boolean;  // Removed
    conversationPageSize?: number;  // Replaced by lastConversationsPerPage
    autoSelectAllOnOpen?: boolean;  // Removed
}

export interface ConversationRecord {
    path: string;
    updateTime: number;
}

export interface ReportEntry {
    title: string;
    filePath: string;
    createDate: string;
    updateDate: string;
    messageCount: number;
    reason?: string;
}

export interface ConversationCatalogEntry {
    conversationId: string;
    provider: string;
    updateTime: number;
    path: string;
    create_time: number;
    update_time: number;
}

export interface CustomError {
    message: string;
    name?: string;
}

export function isCustomError(error: unknown): error is CustomError {
    return (
        typeof error === 'object' &&
        error !== null &&
        'message' in error
    );
}

export interface ConfirmationDialogOptions {
    url: string;
    message?: string;
    note?: string;
}

export interface AttachmentStats {
    total: number;
    found: number;
    missing: number;
    failed: number;
}