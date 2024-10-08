// src/utils/conversationProcessor.ts

import { Chat, ChatMessage, ConversationCatalogEntry } from "../types"; // Adjust path according to your project structure

export interface NewConversation {
    id: string;
    title: string;
    create_time: number;
    update_time: number;
    messages: ChatMessage[];
}

export interface UpdateConversation {
    id: string;
    update_time: number;
    newMessages: ChatMessage[];
}

export interface SkippedConversation {
    id: string;
    title: string;
    reason: string; // Reason for skipping
}

export interface ConversationProcessingResult {
    newConversations: NewConversation[];
    updateConversations: UpdateConversation[];
    skippedConversations: SkippedConversation[];
}

export function processConversations(
    chats: Chat[],
    existingConversations: Record<string, ConversationCatalogEntry>
): ConversationProcessingResult {
    const newConversations: NewConversation[] = [];
    const updateConversations: UpdateConversation[] = [];
    const skippedConversations: SkippedConversation[] = [];

    for (const chat of chats) {
        const existingRecord = existingConversations[chat.id];
        const totalMessageCount = Object.values(chat.mapping).filter(
            (msg) => isValidMessage(msg as ChatMessage) // Ensure valid messages
        ).length;

        // Determine how to categorize the conversation
        if (existingRecord) {
            if (existingRecord.updateTime < chat.update_time) {
                const newMessages = getNewMessages(
                    chat,
                    extractMessageUIDsFromRecord(existingRecord)
                );
                updateConversations.push({
                    id: chat.id,
                    update_time: chat.update_time,
                    newMessages,
                });
            } else {
                skippedConversations.push({
                    id: chat.id,
                    title: chat.title || "Untitled",
                    reason: "No Updates",
                });
            }
        } else {
            newConversations.push({
                id: chat.id,
                title: chat.title || "Untitled",
                create_time: chat.create_time,
                update_time: chat.update_time,
                messages: Object.values(chat.mapping).filter((msg) =>
                    isValidMessage(msg as ChatMessage)
                ),
            });
        }
    }

    return { newConversations, updateConversations, skippedConversations };
}

function extractMessageUIDsFromRecord(
    record: ConversationCatalogEntry
): string[] {
    // Logic to extract message UIDs from existing record if needed
    return []; // Implement as necessary
}

function getNewMessages(
    chat: Chat,
    existingMessageIds: string[]
): ChatMessage[] {
    return Object.values(chat.mapping)
        .filter((message) => isValidMessage(message as ChatMessage))
        .filter((message) => !existingMessageIds.includes(message.id));
}
