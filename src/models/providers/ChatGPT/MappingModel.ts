// src/models/providers/ChatGPT/MappingModel.ts

import { ChatGPTJsonModel } from "./JsonModel";

export class ChatGPTMappingModel {
    private jsonModel: ChatGPTJsonModel;

    constructor(jsonData: any) {
        this.jsonModel = new ChatGPTJsonModel(jsonData);
    }

    map(): any {
        const messageData = this.jsonModel.getConversation().mapping;

        return {
            conversation_id:
                this.jsonModel.getConversation().conversation_id || null,
            conversation_model: this.getConversationModel(),
            create_time: this.jsonModel.getConversation().create_time,
            update_time: this.jsonModel.getConversation().update_time,
            chat_messages: this.mapMessages(messageData),
        };
    }

    private mapMessages(mapping: Record<string, any>): any[] {
        return Object.values(mapping).map((message) => ({
            message_id: message.uuid,
            role: message.role,
            created_at: message.created_at,
            updated_at: message.updated_at,
            message_model: message.model_slug || "Unspecified", // Using model_slug if available
        }));
    }

    private getConversationModel(): string {
        return "Unspecified"; // ChatGPT does not have an overall model at the conversation level
    }
}
