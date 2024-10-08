// types.ts
export interface PluginSettings {
    archiveFolder: string;
    addDatePrefix: boolean;
    dateFormat: "YYYY-MM-DD" | "YYYYMMDD";
    hasShownUpgradeNotice: boolean; // Keep this as it is
    hasCompletedUpgrade: boolean; // New property added
}

export interface ChatMessage {
    id: string;
    author: {
        role: "user" | "assistant" | "system"; // Ensure all roles are represented
        name?: string | null; // Optional
        metadata: Record<string, unknown>; // Reflected from JSON structure
    };
    create_time: number | null; // Nullable
    update_time: number | null; // Nullable
    content: {
        content_type: string; // Add content_type in your ChatMessage
        parts: string[]; // Parts array containing message text
    };
    status: "finished_successfully" | "in_progress"; // Add status
    end_turn?: boolean; // Optional
    weight?: number; // Optional
    recipient: string; // Required
}

export interface Chat {
    id: string;
    title: string;
    create_time: number;
    update_time: number;
    mapping: Record<string, ChatMessage>;
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
    errorMessage?: string;
}

export interface ConversationCatalogEntry {
    conversationId: string;
    provider: string;
    path: string;
    updateTime: number; // Note the underscore
}

export interface CustomError {
    message: string; // A string representing the error message
    name?: string; // An optional string for the error name (like 'CustomError')
}

interface Timestamps {
    create_time: number;
    update_time: number;
}

export interface Chat extends Timestamps {
    id: string;
    title: string;
    mapping: Record<string, ChatMessage>;
}

export interface ConfirmationDialogOptions {
    url: string; // The URL to display in the dialog
    message?: string; // Optional additional message
    note?: string; // Optional note about deletion
}

export interface MappingEntry {
    id: string;
    message: ChatMessage; // This should reference the updated ChatMessage interface
    parent: string |
