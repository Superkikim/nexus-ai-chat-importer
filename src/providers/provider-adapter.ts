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

// src/providers/provider-adapter.ts
import {
    ReportNamingStrategy,
    StandardConversation,
    StandardMessage,
} from "../types/standard";
import { ZipArchiveReader } from "../utils/zip-loader";
import { NoteMessageBlock } from "../utils/note-message-blocks";

/**
 * What an existing note is missing, worked out by a provider that cannot rely
 * on message ids: messages to add at the end, and stretches of the note to
 * rewrite from a richer export.
 */
export interface NoteMergePlan {
    append: StandardMessage[];
    rewrites: { start: number; end: number; messages: StandardMessage[] }[];
}

// Minimal provider-agnostic adapter contract
export interface ProviderAdapter<TChat = unknown> {
    // Identify provider from raw conversation sample
    detect(rawConversations: unknown[]): boolean;

    // Basic chat accessors
    getId(chat: TChat): string;
    getTitle(chat: TChat): string;
    getCreateTime(chat: TChat): number; // unix seconds
    getUpdateTime(chat: TChat): number; // unix seconds

    // Conversion
    convertChat(
        chat: TChat
    ): StandardConversation | Promise<StandardConversation>;

    // Determine which provider name to set in StandardConversation
    getProviderName(): string; // e.g., 'chatgpt', 'claude'

    // New messages detection given existing message IDs extracted from note
    getNewMessages(chat: TChat, existingMessageIds: string[]): unknown[];

    // Optional: decide what an existing note is missing, when message ids
    // cannot answer that question. Perplexity's two exports of one thread
    // number their answers differently, so a note imported from one is
    // reconciled against the other by what its messages say, not by their ids.
    //
    // Returning null falls back to the id comparison every other provider uses.
    reconcileNoteMessages?(
        existing: NoteMessageBlock[],
        messages: StandardMessage[]
    ): NoteMergePlan | null;

    // Optional reconciliation pass, run on the WHOLE conversation after
    // conversion and before attachment extraction. Providers that ship content
    // outside the conversation payload (e.g. ChatGPT's library_files.json) use
    // it to attach that content to the message that produced it, and may add
    // synthetic messages when the producing message is missing from the export.
    //
    // Must be idempotent and always receive the full message list, never a
    // filtered subset — otherwise a second import would re-add what the note
    // already contains.
    reconcileConversationMessages?(
        messages: StandardMessage[],
        conversationId: string,
        zip: ZipArchiveReader
    ): Promise<StandardMessage[]>;

    // Attachment processing (best-effort); return messages with updated attachments
    processMessageAttachments?(
        messages: StandardMessage[],
        conversationId: string,
        zip: ZipArchiveReader
    ): Promise<StandardMessage[]>;

    // Report naming strategy for this provider
    getReportNamingStrategy(): ReportNamingStrategy;

    // Optional ZIP entry filter — return false to skip an entry during loading.
    // If absent, all entries are included (default behaviour).
    shouldIncludeZipEntry?(
        entryName: string,
        uncompressedSize: number
    ): boolean;

    // Optional: the kind of item this raw entry is, when an export mixes
    // several (Grok: conversations and Imagine posts). The label heads the
    // report columns. If absent, every item is DEFAULT_ITEM_CATEGORY.
    getItemCategory?(chat: TChat): string;

    // Optional: why this raw entry is not imported at all, or null to import
    // it. The reason is shown in the report next to its count.
    getExclusionReason?(chat: TChat): string | null;
}

/** Report label for items of a provider that exports a single kind. */
export const DEFAULT_ITEM_CATEGORY = "Conversations";

export interface ProviderRegistry {
    // Return adapter for a provider name
    getAdapter(provider: string): ProviderAdapter | undefined;

    // Detect which adapter matches raw data; return provider name or "unknown"
    detectProvider(rawConversations: unknown[]): string;
}

export class DefaultProviderRegistry implements ProviderRegistry {
    private adapters: Record<string, ProviderAdapter> = {};

    register(providerName: string, adapter: ProviderAdapter) {
        this.adapters[providerName] = adapter;
    }

    getAdapter(provider: string): ProviderAdapter | undefined {
        return this.adapters[provider];
    }

    detectProvider(rawConversations: unknown[]): string {
        for (const [name, adapter] of Object.entries(this.adapters)) {
            try {
                if (adapter.detect(rawConversations)) return name;
            } catch {
                // ignore and continue
            }
        }
        return "unknown";
    }
}
