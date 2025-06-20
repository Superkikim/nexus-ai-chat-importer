// types.ts
export interface PluginSettings {
    archiveFolder: string;
    addDatePrefix: boolean;
    dateFormat: 'YYYY-MM-DD' | 'YYYYMMDD';
    hasShownUpgradeNotice: boolean;
    hasCompletedUpgrade: boolean;
}

export interface ChatMessage {
    id: string;
    author: {
        role: 'user' | 'assistant';
    };
    content: {
        parts: string[];
        content_type?: string;
    };
    create_time: number;
}

export interface ChatMapping {
    id: string;
    message?: ChatMessage;
    parent?: string;
    children?: string[];
}

export interface Chat {
    id: string;
    title: string;
    create_time: number;
    update_time: number;
    mapping: Record<string, ChatMapping>;
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
