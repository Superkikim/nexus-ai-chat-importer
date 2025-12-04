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

// src/utils/conversation-filter.ts

import { ProviderRegistry, ProviderAdapter } from "../providers/provider-adapter";
import { logger } from "../logger";

/**
 * Filter raw provider-specific conversations by selected IDs in a
 * provider-agnostic way.
 *
 * This function prefers provider adapters (via getId) so that ID
 * semantics stay consistent between metadata extraction, import,
 * and future providers. When no adapter is available or getId
 * throws, it falls back to the legacy structural heuristics.
 */
export function filterConversationsByIds(
    rawConversations: any[],
    selectedIds: string[],
    providerRegistry: ProviderRegistry,
    forcedProvider?: string
): any[] {
    if (!rawConversations || rawConversations.length === 0) return [];
    if (!selectedIds || selectedIds.length === 0) return [];

    const selectedIdsSet = new Set(selectedIds);

    const detectedProvider: string | "unknown" =
        forcedProvider || providerRegistry.detectProvider(rawConversations);

    const adapter: ProviderAdapter | undefined =
        detectedProvider !== "unknown" ? providerRegistry.getAdapter(detectedProvider) : undefined;

    const getConversationId = (conversation: any): string => {
        // 1) Preferred path: use adapter.getId so providers own their
        //    ID semantics and stay aligned with ConversationProcessor.
        if (adapter && typeof adapter.getId === "function") {
            try {
                const id = adapter.getId(conversation);
                if (id && typeof id === "string") {
                    return id;
                }
            } catch (error) {
                logger.error(
                    `Error getting conversation ID using adapter for provider ${detectedProvider}`,
                    error
                );
            }
        }

        // 2) Fallback: legacy structural heuristics kept for safety and
        //    backward compatibility, especially if no adapter is found
        //    or detection returns "unknown".
        try {
            if (
                forcedProvider === "lechat" ||
                (Array.isArray(conversation) && conversation[0]?.chatId)
            ) {
                // Le Chat format: array of messages, ID is in first message's chatId
                return conversation[0]?.chatId || "";
            }

            if (
                forcedProvider === "claude" ||
                (conversation && conversation.uuid && conversation.name)
            ) {
                // Claude format: UUID field
                return conversation.uuid || "";
            }

            // Default: ChatGPT-style conversation with id field
            return (conversation && conversation.id) || "";
        } catch {
            return "";
        }
    };

    return rawConversations.filter(conversation => {
        const conversationId = getConversationId(conversation);
        if (!conversationId) return false;
        return selectedIdsSet.has(conversationId);
    });
}

