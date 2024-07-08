// types.ts
interface PluginSettings {
    archiveFolder: string;
    addDatePrefix: boolean;
    dateFormat: 'YYYY-MM-DD' | 'YYYYMMDD';
}

interface ChatMessage {
    id: string;
    author: {
        role: 'user' | 'assistant';
    };
    content: {
        parts: string[];
    };
    create_time: number;
}

interface Chat {
    id: string;
    title: string;
    create_time: number;
    update_time: number;
    mapping: Record<string, ChatMessage>;
}

interface ConversationRecord {
    path: string;
    updateTime: number;
}
