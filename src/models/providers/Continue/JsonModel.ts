// src/models/providers/Continue/JsonModel.ts

interface Message {
    uuid: string;
    text: string;
    sender: string; // "human" or "assistant"
    created_at: string;
    updated_at: string;
    attachments: any[];
    files: any[];
}

interface Conversation {
    uuid: string;
    name: string;
    created_at: string;
    updated_at: string;
    chat_messages: Message[];
}

export class ContinueJsonModel {
    private conversations: Conversation[];

    constructor(jsonData: any) {
        this.conversations = jsonData as Conversation[];
    }

    validate(): boolean {
        // Implement validation logic specific to Continue
        return Array.isArray(this.conversations); // Basic validation to check if it's an array
    }

    getConversations(): Conversation[] {
        return this.conversations;
    }
}
