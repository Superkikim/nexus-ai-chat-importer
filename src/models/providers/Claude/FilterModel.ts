// src/models/providers/Claude/FilterModel.ts

import { ClaudeJsonModel } from "./JsonModel";

export class ClaudeFilterModel {
    private jsonModel: ClaudeJsonModel;

    constructor(jsonData: any) {
        this.jsonModel = new ClaudeJsonModel(jsonData);
    }

    extract(): any {
        // Extracting standardized fields
        return {
            conversation_id: this.jsonModel.getConversations()[0].uuid || null, // Assuming we're getting the first conversation
            conversation_model: this.getConversationModel(),
            create_time: this.jsonModel.getConversations()[0].created_at,
            update_time: this.jsonModel.getConversations()[0].updated_at,
            chat_messages: this.extractMessages(
                this.jsonModel.getConversations()[0].chat_messages
            ),
        };
    }

    private extractMessages(chatMessages: any[]): any[] {
        return chatMessages.map((message) => ({
            message_id: message.uuid,
            role: message.sender, // 'sender' indicates who sent the message
            created_at: message.created_at,
            updated_at: message.updated_at,
            message_model: "Unspecified", // Claude does not provide a model at message level
        }));
    }

    private getConversationModel(): string {
        // Implement logic to determine the conversation model
        return "Unspecified"; // No model information available
    }
}
