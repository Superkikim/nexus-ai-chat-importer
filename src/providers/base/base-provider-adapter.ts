/**
 * Nexus AI Chat Importer - Obsidian Plugin
 * Copyright (C) 2024 Akim Sissaoui
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */


// src/providers/base/base-provider-adapter.ts
import JSZip from "jszip";
import { ProviderAdapter } from "../provider-adapter";
import { StandardConversation, StandardMessage, StandardAttachment, ReportNamingStrategy } from "../../types/standard";

/**
 * Interface for attachment extractors
 * All provider-specific attachment extractors must implement this interface
 */
export interface AttachmentExtractor {
    /**
     * Extract attachments from ZIP file
     * 
     * @param zip - JSZip instance containing the archive
     * @param conversationId - ID of the conversation
     * @param attachments - Array of attachments to extract
     * @param messageId - Optional message ID for better logging
     * @returns Array of processed attachments with local paths
     */
    extractAttachments(
        zip: JSZip,
        conversationId: string,
        attachments: any[],
        messageId?: string
    ): Promise<StandardAttachment[]>;
}

/**
 * Abstract base class for provider adapters
 * Provides common functionality shared across all providers
 * 
 * This eliminates code duplication and ensures consistent behavior
 * across all provider implementations (ChatGPT, Claude, Mistral, etc.)
 */
export abstract class BaseProviderAdapter<TChat = any> implements ProviderAdapter<TChat> {
    
    /**
     * Process message attachments - COMMON IMPLEMENTATION
     * 
     * This method is shared by all providers and handles:
     * - Iterating through messages
     * - Extracting attachments using provider-specific extractor
     * - Preserving message structure
     * 
     * Subclasses only need to provide their attachment extractor via getAttachmentExtractor()
     * 
     * @param messages - Array of messages to process
     * @param conversationId - ID of the conversation
     * @param zip - JSZip instance containing attachments
     * @returns Array of messages with processed attachments
     */
    async processMessageAttachments(
        messages: StandardMessage[],
        conversationId: string,
        zip: JSZip
    ): Promise<StandardMessage[]> {
        const processedMessages: StandardMessage[] = [];

        for (const message of messages) {
            if (message.attachments && message.attachments.length > 0) {
                // Use provider-specific attachment extractor
                const processedAttachments = await this.getAttachmentExtractor().extractAttachments(
                    zip,
                    conversationId,
                    message.attachments,
                    message.id // Pass message ID for better logging (optional parameter)
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

    /**
     * Subclasses must provide their attachment extractor
     * This allows each provider to use their own extraction logic
     * while sharing the common iteration/processing logic above
     */
    protected abstract getAttachmentExtractor(): AttachmentExtractor;

    // Abstract methods from ProviderAdapter interface
    // All subclasses must implement these methods

    /**
     * Identify provider from raw conversation sample
     */
    abstract detect(rawConversations: any[]): boolean;

    /**
     * Get conversation ID
     */
    abstract getId(chat: TChat): string;

    /**
     * Get conversation title
     */
    abstract getTitle(chat: TChat): string;

    /**
     * Get conversation creation time (unix seconds)
     */
    abstract getCreateTime(chat: TChat): number;

    /**
     * Get conversation update time (unix seconds)
     */
    abstract getUpdateTime(chat: TChat): number;

    /**
     * Convert provider-specific chat to StandardConversation
     */
    abstract convertChat(chat: TChat): StandardConversation | Promise<StandardConversation>;

    /**
     * Get provider name (e.g., 'chatgpt', 'claude', 'mistral')
     */
    abstract getProviderName(): string;

    /**
     * Get new messages given existing message IDs
     */
    abstract getNewMessages(chat: TChat, existingMessageIds: string[]): any[];

    /**
     * Get report naming strategy for this provider
     */
    abstract getReportNamingStrategy(): ReportNamingStrategy;

    /**
     * Default ZIP entry filter — include everything.
     * Provider subclasses may override to skip large unwanted entries
     * (e.g. ChatGPT voice-recording DAT files) before they are loaded into RAM.
     */
    shouldIncludeZipEntry(_entryName: string, _uncompressedSize: number): boolean {
        return true;
    }
}

