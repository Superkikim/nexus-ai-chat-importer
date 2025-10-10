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
import JSZip from "jszip";
import { ReportNamingStrategy, StandardConversation, StandardMessage, StandardAttachment } from "../types/standard";

// Minimal provider-agnostic adapter contract
export interface ProviderAdapter<TChat = any> {
  // Identify provider from raw conversation sample
  detect(rawConversations: any[]): boolean;

  // Basic chat accessors
  getId(chat: TChat): string;
  getTitle(chat: TChat): string;
  getCreateTime(chat: TChat): number; // unix seconds
  getUpdateTime(chat: TChat): number; // unix seconds

  // Conversion
  convertChat(chat: TChat): StandardConversation | Promise<StandardConversation>;

  // Determine which provider name to set in StandardConversation
  getProviderName(): string; // e.g., 'chatgpt', 'claude'

  // New messages detection given existing message IDs extracted from note
  getNewMessages(chat: TChat, existingMessageIds: string[]): any[];

  // Attachment processing (best-effort); return messages with updated attachments
  processMessageAttachments?(
    messages: StandardMessage[],
    conversationId: string,
    zip: JSZip
  ): Promise<StandardMessage[]>;

  // Report naming strategy for this provider
  getReportNamingStrategy(): ReportNamingStrategy;
}

export interface ProviderRegistry {
  // Return adapter for a provider name
  getAdapter(provider: string): ProviderAdapter | undefined;

  // Detect which adapter matches raw data; return provider name
  detectProvider(rawConversations: any[]): string | 'unknown';
}

export class DefaultProviderRegistry implements ProviderRegistry {
  private adapters: Record<string, ProviderAdapter> = {};

  register(providerName: string, adapter: ProviderAdapter) {
    this.adapters[providerName] = adapter;
  }

  getAdapter(provider: string): ProviderAdapter | undefined {
    return this.adapters[provider];
  }

  detectProvider(rawConversations: any[]): string | 'unknown' {
    for (const [name, adapter] of Object.entries(this.adapters)) {
      try {
        if (adapter.detect(rawConversations)) return name;
      } catch (_) {
        // ignore and continue
      }
    }
    return 'unknown';
  }
}

