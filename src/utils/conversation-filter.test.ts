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

// src/utils/conversation-filter.test.ts

import { describe, it, expect } from "vitest";
import { DefaultProviderRegistry, ProviderAdapter } from "../providers/provider-adapter";
import { filterConversationsByIds } from "./conversation-filter";

interface TestChat {
    id?: string;
    uuid?: string;
    name?: string;
    messages?: any[];
}

class TestAdapter implements ProviderAdapter<TestChat> {
    constructor(private providerName: string) {}

    detect(_rawConversations: any[]): boolean {
        return true;
    }

    getId(chat: TestChat): string {
        return chat.id || chat.uuid || "";
    }

    getTitle(_chat: TestChat): string {
        return "";
    }

    getCreateTime(_chat: TestChat): number {
        return 0;
    }

    getUpdateTime(_chat: TestChat): number {
        return 0;
    }

    convertChat(_chat: TestChat): any {
        return {};
    }

    getProviderName(): string {
        return this.providerName;
    }

    getNewMessages(_chat: TestChat, _existingMessageIds: string[]): any[] {
        return [];
    }

    getReportNamingStrategy(): any {
        return {
            getProviderName: () => this.providerName,
            extractReportPrefix: (name: string) => name,
            getProviderSpecificColumn: () => ({ header: "" })
        };
    }
}

describe("filterConversationsByIds", () => {
    it("returns empty array when no conversations or no selected IDs", () => {
        const registry = new DefaultProviderRegistry();
        const result1 = filterConversationsByIds([], ["a"], registry, "chatgpt");
        const result2 = filterConversationsByIds([{ id: "a" }], [], registry, "chatgpt");
        expect(result1).toEqual([]);
        expect(result2).toEqual([]);
    });

    it("uses adapter.getId when provider is known", () => {
        const registry = new DefaultProviderRegistry();
        const adapter = new TestAdapter("chatgpt");
        registry.register("chatgpt", adapter);

        const conversations: TestChat[] = [
            { id: "c1", messages: [] },
            { id: "c2", messages: [] },
            { id: "c3", messages: [] }
        ];

        const result = filterConversationsByIds(conversations, ["c2"], registry, "chatgpt");

        expect(result).toHaveLength(1);
        expect(result[0].id).toBe("c2");
    });

    it("falls back to legacy heuristics when no adapter is registered", () => {
        const registry = new DefaultProviderRegistry();

        const conversations = [
            { id: "a", mapping: {} },
            { id: "b", mapping: {} }
        ];

        const result = filterConversationsByIds(conversations, ["b"], registry);

        expect(result).toHaveLength(1);
        expect(result[0].id).toBe("b");
    });

    it("handles Le Chat-style arrays of messages", () => {
        const registry = new DefaultProviderRegistry();
        const adapter = new TestAdapter("lechat");
        registry.register("lechat", adapter);

        const conversations = [
            [ { chatId: "chat-1", createdAt: "2024-01-01T00:00:00Z" } ],
            [ { chatId: "chat-2", createdAt: "2024-01-02T00:00:00Z" } ]
        ];

        const result = filterConversationsByIds(conversations, ["chat-2"], registry, "lechat");

        expect(result).toHaveLength(1);
        expect((result[0] as any)[0].chatId).toBe("chat-2");
    });

    it("handles Claude-style UUID conversations via fallback heuristics", () => {
        const registry = new DefaultProviderRegistry();

        const conversations = [
            { uuid: "u1", name: "Conv 1" },
            { uuid: "u2", name: "Conv 2" }
        ];

        const result = filterConversationsByIds(conversations, ["u2"], registry, "claude");

        expect(result).toHaveLength(1);
        expect(result[0].uuid).toBe("u2");
    });
});

