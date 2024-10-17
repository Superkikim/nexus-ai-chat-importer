// src/models/providers/Continue/MappingModel.ts

import { ContinueJsonModel } from "./JsonModel";

export class ContinueMappingModel {
    private jsonModel: ContinueJsonModel;

    constructor(jsonData: any) {
        this.jsonModel = new ContinueJsonModel(jsonData);
    }

    map(): any {
        return {
            conversation_id: this.jsonModel.getConversations()[0].uuid || null,
            conversation_model: this.getConversationModel(),
            create_time: this.jsonModel.getConversations()[0].created_at,
            update_time: this.jsonModel.getConversations()[0].updated_at,
            chat_messages: this.mapMessages(
                this.jsonModel.getConversations()[0].chat_messages
            ),
        };
    }

    private mapMessages(chatMessages: any[]): any[] {
        return chatMessages.map((message) => ({
            message_id: message.uuid,
            role: message.sender, // 'sender' indicates who sent the message
            created_at: message.created_at,
            updated_at: message.updated_at,
            message_model: message.model || "Unspecified", // Using the model if available, otherwise "Unspecified"
        }));
    }

    private getConversationModel(): string {
        return "Unspecified"; // Continue does not have an overall model at the conversation level
    }
}
