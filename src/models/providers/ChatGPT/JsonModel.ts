// src/models/providers/ChatGPT/JsonModel.ts

interface Message {
    uuid: string;
    role: string; // "user" or "assistant"
    content: Array<{ type: string; text: string }>;
    created_at: string;
    updated_at: string;
    attachments: any[];
    files: any[];
}

interface Conversation {
    title: string;
    create_time: number;
    update_time: number;
    mapping: Record<string, Message>;
    moderation_results: any[];
    current_node: string;
    conversation_id?: string; // Optional
    id?: string; // Optional
}

export class ChatGPTJsonModel {
    private conversation: Conversation;

    constructor(jsonData: any) {
        this.conversation = jsonData as Conversation;

        // Normalize the identifiers
        if (this.conversation.conversation_id) {
            this.conversation.id = this.conversation.conversation_id; // Use conversation_id as the main ID
        }
    }

    // Unified property for conversation ID
    get conversationId(): string {
        return this.conversation.id || null;
    }

    validate(): boolean {
        // Ensure at least one ID is present
        return !!this.conversationId;
    }

    getConversation(): Conversation {
        return this.conversation;
    }
}
