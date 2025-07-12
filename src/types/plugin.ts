// src/types/plugin.ts
export interface PluginSettings {
    archiveFolder: string;
    addDatePrefix: boolean;
    dateFormat: 'YYYY-MM-DD' | 'YYYYMMDD';
    hasShownUpgradeNotice: boolean;
    hasCompletedUpgrade: boolean;
    
    // Attachment settings
    importAttachments: boolean;
    attachmentFolder: string;
    skipMissingAttachments: boolean; // Skip instead of creating notes
    showAttachmentDetails: boolean; // Show detailed status in import report
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

/**
 * Attachment processing statistics for reports
 */
export interface AttachmentStats {
    total: number;
    found: number;
    missing: number;
    failed: number;
}