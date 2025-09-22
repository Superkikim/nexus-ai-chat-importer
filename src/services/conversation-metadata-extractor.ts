// src/services/conversation-metadata-extractor.ts
import JSZip from "jszip";
import { ProviderRegistry } from "../providers/provider-adapter";
import { Chat } from "../providers/chatgpt/chatgpt-types";
import { ClaudeConversation, ClaudeExportData } from "../providers/claude/claude-types";
import { isValidMessage } from "../utils";

/**
 * Lightweight conversation metadata for preview purposes
 */
export interface ConversationMetadata {
    id: string;
    title: string;
    createTime: number; // Unix timestamp
    updateTime: number; // Unix timestamp
    messageCount: number;
    provider: string;
    isStarred?: boolean;
    isArchived?: boolean;
}

/**
 * Service for extracting conversation metadata without full processing
 * Used for conversation selection preview
 */
export class ConversationMetadataExtractor {
    constructor(private providerRegistry: ProviderRegistry) {}

    /**
     * Extract conversation metadata from ZIP file
     */
    async extractMetadataFromZip(zip: JSZip, forcedProvider?: string): Promise<ConversationMetadata[]> {
        try {
            // Extract raw conversation data
            const rawConversations = await this.extractRawConversationsFromZip(zip);
            
            if (rawConversations.length === 0) {
                return [];
            }

            // Detect provider if not forced
            const provider = forcedProvider || this.providerRegistry.detectProvider(rawConversations);
            
            if (provider === 'unknown') {
                throw new Error('Could not detect conversation provider from data structure');
            }

            // Extract metadata based on provider
            return this.extractMetadataByProvider(rawConversations, provider);
        } catch (error) {
            throw new Error(`Failed to extract conversation metadata: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Extract raw conversation data from ZIP (provider-agnostic)
     */
    private async extractRawConversationsFromZip(zip: JSZip): Promise<any[]> {
        const conversationsFile = zip.file("conversations.json");
        if (!conversationsFile) {
            throw new Error("Missing conversations.json file in ZIP archive");
        }

        const conversationsJson = await conversationsFile.async("string");
        const parsedData = JSON.parse(conversationsJson);

        // Handle different data structures
        if (Array.isArray(parsedData)) {
            // Direct array of conversations (ChatGPT format)
            return parsedData;
        } else if (parsedData.conversations && Array.isArray(parsedData.conversations)) {
            // Nested structure (Claude format)
            return parsedData.conversations;
        } else {
            throw new Error("Invalid conversations.json structure");
        }
    }

    /**
     * Extract metadata based on detected provider
     */
    private extractMetadataByProvider(rawConversations: any[], provider: string): ConversationMetadata[] {
        switch (provider) {
            case 'chatgpt':
                return this.extractChatGPTMetadata(rawConversations);
            case 'claude':
                return this.extractClaudeMetadata(rawConversations);
            default:
                throw new Error(`Unsupported provider: ${provider}`);
        }
    }

    /**
     * Extract metadata from ChatGPT conversations
     */
    private extractChatGPTMetadata(conversations: Chat[]): ConversationMetadata[] {
        return conversations.map(chat => ({
            id: chat.id || "",
            title: chat.title || "Untitled",
            createTime: chat.create_time || 0,
            updateTime: chat.update_time || 0,
            messageCount: this.countChatGPTMessages(chat),
            provider: "chatgpt",
            isStarred: chat.is_starred || false,
            isArchived: chat.is_archived || false
        }));
    }

    /**
     * Extract metadata from Claude conversations
     */
    private extractClaudeMetadata(conversations: ClaudeConversation[]): ConversationMetadata[] {
        return conversations.map(chat => ({
            id: chat.uuid || "",
            title: chat.name || "Untitled",
            createTime: chat.created_at ? Math.floor(new Date(chat.created_at).getTime() / 1000) : 0,
            updateTime: chat.updated_at ? Math.floor(new Date(chat.updated_at).getTime() / 1000) : 0,
            messageCount: this.countClaudeMessages(chat),
            provider: "claude",
            isStarred: chat.is_starred || false,
            isArchived: false // Claude doesn't have archived status
        }));
    }

    /**
     * Count messages in ChatGPT conversation (lightweight version)
     */
    private countChatGPTMessages(chat: Chat): number {
        if (!chat.mapping) {
            return 0;
        }

        let count = 0;
        for (const messageObj of Object.values(chat.mapping)) {
            const message = messageObj?.message;
            if (!message) continue;

            // Use same filtering logic as ChatGPTConverter but without full processing
            if (this.shouldIncludeChatGPTMessage(message)) {
                count++;
            }
        }

        return count;
    }

    /**
     * Count messages in Claude conversation (lightweight version)
     */
    private countClaudeMessages(chat: ClaudeConversation): number {
        if (!chat.chat_messages || !Array.isArray(chat.chat_messages)) {
            return 0;
        }

        let count = 0;
        for (const message of chat.chat_messages) {
            if (this.shouldIncludeClaudeMessage(message)) {
                count++;
            }
        }

        return count;
    }

    /**
     * Lightweight version of ChatGPT message filtering
     */
    private shouldIncludeChatGPTMessage(message: any): boolean {
        if (!message || !message.author) {
            return false;
        }

        // Skip system and tool messages (same logic as ChatGPTConverter)
        if (message.author.role === "system" || message.author.role === "tool") {
            return false;
        }

        // Skip hidden messages
        if (message.metadata?.is_visually_hidden_from_conversation === true) {
            return false;
        }

        // Use existing validation
        return isValidMessage(message);
    }

    /**
     * Lightweight version of Claude message filtering
     */
    private shouldIncludeClaudeMessage(message: any): boolean {
        if (!message || !message.uuid || !message.sender) {
            return false;
        }

        // Include both human and assistant messages
        return message.sender === 'human' || message.sender === 'assistant';
    }

    /**
     * Get total conversation count from ZIP without extracting all metadata
     */
    async getConversationCount(zip: JSZip): Promise<number> {
        try {
            const rawConversations = await this.extractRawConversationsFromZip(zip);
            return rawConversations.length;
        } catch (error) {
            return 0;
        }
    }
}
