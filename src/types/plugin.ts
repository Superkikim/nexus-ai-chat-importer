// src/types/plugin.ts
export interface PluginSettings {
    archiveFolder: string;
    addDatePrefix: boolean;
    dateFormat: 'YYYY-MM-DD' | 'YYYYMMDD';
    hasShownUpgradeNotice: boolean;
    hasCompletedUpgrade: boolean;
    
    // Version tracking for migrations
    currentVersion: string;
    previousVersion: string;
    
    // Attachment settings
    importAttachments: boolean;
    attachmentFolder: string;
    skipMissingAttachments: boolean;
    showAttachmentDetails: boolean;
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