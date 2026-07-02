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

import {
    ProviderRegistry,
    ProviderAdapter,
} from "../providers/provider-adapter";
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
    rawConversations: unknown[],
    selectedIds: string[],
    providerRegistry: ProviderRegistry,
    forcedProvider?: string
): unknown[] {
    if (!rawConversations || rawConversations.length === 0) return [];
    if (!selectedIds || selectedIds.length === 0) return [];

    const selectedIdsSet = new Set(selectedIds);

    const detectedProvider: string | "unknown" =
        forcedProvider || providerRegistry.detectProvider(rawConversations);

    const adapter: ProviderAdapter | undefined =
        detectedProvider !== "unknown"
            ? providerRegistry.getAdapter(detectedProvider)
            : undefined;

    const getConversationId = (conversation: unknown): string => {
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

        // 2) Fallback: legacy structural heuristics for unknown/unregistered provider formats.
        const conv =
            conversation !== null && typeof conversation === "object"
                ? (conversation as Record<string, unknown>)
                : null;
        try {
            if (
                forcedProvider === "vibe" ||
                (Array.isArray(conversation) &&
                    (conversation[0] as Record<string, unknown>)?.chatId)
            ) {
                // Le Chat format: array of messages, ID is in first message's chatId
                const firstMsg = Array.isArray(conversation)
                    ? (conversation[0] as Record<string, unknown>)
                    : null;
                return String(firstMsg?.chatId || "");
            }

            if (forcedProvider === "claude" || (conv?.uuid && conv?.name)) {
                // Claude format: UUID field
                return String(conv?.uuid || "");
            }

            const metadata =
                conv?.metadata !== null && typeof conv?.metadata === "object"
                    ? (conv.metadata as Record<string, unknown>)
                    : null;
            if (metadata?.thread_id && Array.isArray(conv?.conversations)) {
                return String(metadata.thread_id || "");
            }

            if (Array.isArray(conv?.entries)) {
                const firstEntry = (conv.entries as unknown[])[0] as
                    | Record<string, unknown>
                    | undefined;
                return String(
                    firstEntry?.thread_url_slug ||
                        firstEntry?.uuid ||
                        firstEntry?.backend_uuid ||
                        ""
                );
            }

            // Default: ChatGPT-style conversation with id field
            return String(conv?.id || "");
        } catch {
            return "";
        }
    };

    return rawConversations.filter((conversation) => {
        const conversationId = getConversationId(conversation);
        if (!conversationId) return false;
        return selectedIdsSet.has(conversationId);
    });
}
