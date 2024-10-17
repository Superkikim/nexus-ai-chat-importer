// src/models/providers/ChatGPT/JsonModel.ts

interface Message {
    uuid: string; // Unique identifier for the message
    role: string; // "user" or "assistant"
    content: Array<{ type: string; text: string }>; // Content of the message
    created_at: string; // Timestamp of when the message was created
    updated_at: string; // Timestamp of the last update to the message
    attachments: any[]; // Any attachments associated with the message
    files: any[]; // Files sent with the message
}

interface Conversation {
    title: string; // Title of the conversation
    create_time: number; // Time when the conversation was created (standardized field)
    update_time: number; // Time when the conversation was last updated (standardized field)
    mapping: Record<string, Message>; // Mapping of message IDs to message objects
    moderation_results: any[]; // Results from moderation checks
    current_node: string; // Current state of the conversation node
    conversation_id?: string; // Conversation ID, optional field
    id?: string; // Alternate identifier for the conversation, optional field
}

/**
 * Represents a model for a ChatGPT conversation.
 * The model maps the expected structure of a ChatGPT conversation.
 * - `conversation_id` is normalized to `id` for internal consistency.
 * - The `message_model` derives from internal mapping and is currently unspecified;
 *   consider adapting this to represent specific models if available.
 */
export class ChatGPTJsonModel {
    private conversation: Conversation;

    constructor(jsonData: any) {
        this.conversation = jsonData as Conversation;

        // Normalize the identifiers
        if (this.conversation.conversation_id) {
            this.conversation.id = this.conversation.conversation_id; // Use conversation_id as the main ID
        }
    }

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
