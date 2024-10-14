// src/models/providers/Claude/JsonModel.ts

interface ChatMessage {
    uuid: string;
    text: string;
    sender: string; // "human" or "assistant"
    created_at: string;
    updated_at: string;
    attachments: any[]; // You can further define the structure based on your needs
    files: any[]; // Same as attachments
}

interface Conversation {
    uuid: string;
    name: string;
    created_at: string;
    updated_at: string;
    chat_messages: ChatMessage[];
}

export class ClaudeJsonModel {
    private conversations: Conversation[];

    constructor(jsonData: any) {
        this.conversations = jsonData as Conversation[];
    }

    // Method to validate conversations structure if needed
    validate(): boolean {
        // Implement validation logic if required
        return true; // Placeholder for actual validation
    }

    // Additional methods to extract necessary information
    getConversations(): Conversation[] {
        return this.conversations;
    }
}
