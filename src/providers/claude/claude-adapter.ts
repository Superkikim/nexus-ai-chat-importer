// src/providers/claude/claude-adapter.ts
import JSZip from "jszip";
import { ProviderAdapter } from "../provider-adapter";
import { StandardConversation, StandardMessage } from "../../types/standard";
import { ClaudeConverter } from "./claude-converter";
import { ClaudeAttachmentExtractor } from "./claude-attachment-extractor";
import { ClaudeReportNamingStrategy } from "./claude-report-naming";
import { ClaudeConversation, ClaudeMessage } from "./claude-types";
import type NexusAiChatImporterPlugin from "../../main";

export class ClaudeAdapter implements ProviderAdapter<ClaudeConversation> {
    private attachmentExtractor: ClaudeAttachmentExtractor;
    private reportNamingStrategy: ClaudeReportNamingStrategy;

    constructor(private plugin: NexusAiChatImporterPlugin) {
        this.attachmentExtractor = new ClaudeAttachmentExtractor(plugin, plugin.logger);
        this.reportNamingStrategy = new ClaudeReportNamingStrategy();
    }

    detect(rawConversations: any[]): boolean {
        if (rawConversations.length === 0) return false;

        const sample = rawConversations[0];

        // Claude detection: has uuid, name field, chat_messages array, created_at/updated_at, and account
        return !!(sample.uuid && 'name' in sample && sample.chat_messages &&
                 Array.isArray(sample.chat_messages) && sample.created_at && sample.updated_at && sample.account);
    }

    getId(chat: ClaudeConversation): string {
        return chat.uuid || "";
    }

    getTitle(chat: ClaudeConversation): string {
        return chat.name || "Untitled";
    }

    getCreateTime(chat: ClaudeConversation): number {
        return chat.created_at ? Math.floor(new Date(chat.created_at).getTime() / 1000) : 0;
    }

    getUpdateTime(chat: ClaudeConversation): number {
        return chat.updated_at ? Math.floor(new Date(chat.updated_at).getTime() / 1000) : 0;
    }

    convertChat(chat: ClaudeConversation): StandardConversation {
        return ClaudeConverter.convertChat(chat);
    }

    convertMessages(messages: ClaudeMessage[], conversationId?: string): StandardMessage[] {
        return ClaudeConverter.convertMessages(messages, conversationId);
    }

    getProviderName(): string {
        return "claude";
    }

    getNewMessages(chat: ClaudeConversation, existingMessageIds: string[]): ClaudeMessage[] {
        const newMessages: ClaudeMessage[] = [];

        for (const message of chat.chat_messages) {
            if (message.uuid && !existingMessageIds.includes(message.uuid)) {
                if (this.shouldIncludeMessage(message)) {
                    newMessages.push(message);
                }
            }
        }

        return newMessages;
    }

    async processMessageAttachments(
        messages: StandardMessage[],
        conversationId: string,
        zip: JSZip
    ): Promise<StandardMessage[]> {
        const processedMessages: StandardMessage[] = [];

        for (const message of messages) {
            if (message.attachments && message.attachments.length > 0) {
                const processedAttachments = await this.attachmentExtractor.extractAttachments(
                    zip,
                    conversationId,
                    message.attachments
                );

                processedMessages.push({
                    ...message,
                    attachments: processedAttachments
                });
            } else {
                processedMessages.push(message);
            }
        }

        return processedMessages;
    }

    getReportNamingStrategy() {
        return this.reportNamingStrategy;
    }

    getProviderName(): string {
        return "claude";
    }

    private shouldIncludeMessage(message: ClaudeMessage): boolean {
        // Include all human and assistant messages
        if (message.sender === 'human' || message.sender === 'assistant') {
            // Skip empty messages
            if (!message.text && (!message.content || message.content.length === 0)) {
                return false;
            }
            return true;
        }

        return false;
    }
}
