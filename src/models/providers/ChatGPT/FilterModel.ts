// src/models/providers/ChatGPT/FilterModel.ts

import { ChatGPTJsonModel } from "./JsonModel";

export class ChatGPTFilterModel {
    private jsonModel: ChatGPTJsonModel;

    constructor(jsonData: any) {
        this.jsonModel = new ChatGPTJsonModel(jsonData);
    }

    extract(): any {
        // Extracting standardized fields
        return {
            conversation_id:
                this.jsonModel.getConversation().conversation_id || null,
            conversation_model: this.getConversationModel(),
            create_time: this.jsonModel.getConversation().create_time,
            update_time: this.jsonModel.getConversation().update_time,
            chat_messages: this.extractMessages(
                this.jsonModel.getConversation().mapping
            ),
        };
    }

    private extractMessages(mapping: Record<string, any>): any[] {
        return Object.values(mapping).map((message) => ({
            message_id: message.uuid,
            role: message.role,
            created_at: message.created_at,
            updated_at: message.updated_at,
            message_model: message.model_slug || "Unspecified", // Using model_slug if available
        }));
    }

    private getConversationModel(): string {
        // Implement logic to determine the conversation model
        return "Unspecified"; // As specified for ChatGPT
    }
}
