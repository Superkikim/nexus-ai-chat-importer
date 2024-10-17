// src/models/providers/Continue/FilterModel.ts

import { ContinueJsonModel } from "./JsonModel";

export class ContinueFilterModel {
    private jsonModel: ContinueJsonModel;

    constructor(jsonData: any) {
        this.jsonModel = new ContinueJsonModel(jsonData);
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
            message_model: message.model || "Unspecified", // Using the model if provided, otherwise "Unspecified"
        }));
    }

    private getConversationModel(): string {
        // If there is a model in the conversation or prompt logs, return it
        return "Unspecified"; // Assuming there's no overall conversation model in Continue
    }
}
