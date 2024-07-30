// types.ts
export interface PluginSettings {
    archiveFolder: string;
    addDatePrefix: boolean;
    dateFormat: 'YYYY-MM-DD' | 'YYYYMMDD';
}

export interface ChatMessage {
    id: string;
    author: {
        role: 'user' | 'assistant';
    };
    content: {
        parts: string[];
    };
    create_time: number;
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
}

export interface ConversationCatalogEntry {
    conversationId: string; // Unique ID
    provider: string;       // Source provider
    updateTime: number;     // Last update timestamp
    path: string;           // Path to the conversation file
}






export interface CustomError {
    message: string; // A string representing the error message
    name?: string; // An optional string for the error name (like 'CustomError')
}