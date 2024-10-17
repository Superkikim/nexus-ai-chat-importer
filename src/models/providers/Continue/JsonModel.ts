// src/models/providers/Continue/JsonModel.ts

interface Message {
    uuid: string; // Unique identifier for the message
    text: string; // Text content of the message
    sender: string; // "human" or "assistant" (role of the sender)
    created_at: string; // Timestamp of when the message was created
    updated_at: string; // Timestamp of the last update to the message
    attachments: any[]; // Attachments associated with the message
    files: any[]; // Files sent with the message
}

interface Conversation {
    uuid: string; // Unique identifier for the conversation
    name: string; // Name/title of the conversation
    created_at: string; // Creation time of the conversation
    updated_at: string; // Last updated time of the conversation
    chat_messages: Message[]; // Array of messages in the conversation
}

/**
 * Represents a model for a Continue conversation.
 * The model maps the expected structure of a Continue conversation.
 * - `uuid` serves as the identifier for messages.
 * - The `conversation_model` is currently unspecified; consider adapting this to represent
 *   specific models, especially when they become available.
 */
export class ContinueJsonModel {
    private conversations: Conversation[];

    constructor(jsonData: any) {
        this.conversations = jsonData as Conversation[];
    }

    validate(): boolean {
        return Array.isArray(this.conversations); // Basic validation to check if it's an array
    }

    getConversations(): Conversation[] {
        return this.conversations;
    }
}
