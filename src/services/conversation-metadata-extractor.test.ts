import { describe, it, expect } from "vitest";
import { ConversationMetadataExtractor } from "./conversation-metadata-extractor";
import { DefaultProviderRegistry } from "../providers/provider-adapter";
import { Chat } from "../providers/chatgpt/chatgpt-types";
import { ClaudeConversation } from "../providers/claude/claude-types";
import { LeChatConversation } from "../providers/lechat/lechat-types";
import { ChatGPTAdapter } from "../providers/chatgpt/chatgpt-adapter";
import { ClaudeAdapter } from "../providers/claude/claude-adapter";
import { LeChatAdapter } from "../providers/lechat/lechat-adapter";

/**
 * Tests that ConversationMetadataExtractor stays aligned with
 * provider adapters for IDs, timestamps and provider names.
 */

function createTestPlugin() {
    const logger = {
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: () => {},
    };
    return { logger } as any;
}

describe("ConversationMetadataExtractor & ProviderAdapters alignment", () => {
    it("uses the same identifiers and timestamps as ChatGPTAdapter", () => {
        const plugin = createTestPlugin();
        const registry = new DefaultProviderRegistry();
        const extractor = new ConversationMetadataExtractor(registry as any, plugin as any);
        const adapter = new ChatGPTAdapter(plugin as any);

        const chat: Chat = {
            id: "chat-1",
            title: "Test ChatGPT",
            create_time: 1_700_000_000,
            update_time: 1_700_000_500,
            mapping: {
                m1: {
                    id: "m1",
                    message: {
                        author: { role: "user" },
                        content: {
                            parts: [
                                {
                                    content_type: "text",
                                    text: "Hello",
                                },
                            ],
                        },
                    },
                },
            },
        } as any;

        const metadata = (extractor as any).extractChatGPTMetadata([chat]) as any[];
        expect(metadata).toHaveLength(1);

        const m = metadata[0];
        expect(m.id).toBe(adapter.getId(chat));
        expect(m.createTime).toBe(adapter.getCreateTime(chat));
        expect(m.updateTime).toBe(adapter.getUpdateTime(chat));
        expect(m.provider).toBe(adapter.getProviderName());
        expect(m.messageCount).toBeGreaterThan(0);
    });

    it("uses the same identifiers and timestamps as ClaudeAdapter", () => {
        const plugin = createTestPlugin();
        const registry = new DefaultProviderRegistry();
        const extractor = new ConversationMetadataExtractor(registry as any, plugin as any);
        const adapter = new ClaudeAdapter(plugin as any);

        const conv: ClaudeConversation = {
            uuid: "claude-1",
            name: "Test Claude",
            created_at: "2024-01-01T00:00:00.000Z",
            updated_at: "2024-01-01T01:00:00.000Z",
            chat_messages: [
                {
                    uuid: "msg-1",
                    sender: "human",
                    text: "Hi Claude",
                    created_at: "2024-01-01T00:00:00.000Z",
                    updated_at: "2024-01-01T00:00:00.000Z",
                    content: [],
                },
            ],
        } as any;

        const metadata = (extractor as any).extractClaudeMetadata([conv]) as any[];
        expect(metadata).toHaveLength(1);

        const m = metadata[0];
        expect(m.id).toBe(adapter.getId(conv));
        expect(m.createTime).toBe(adapter.getCreateTime(conv));
        expect(m.updateTime).toBe(adapter.getUpdateTime(conv));
        expect(m.provider).toBe(adapter.getProviderName());
        expect(m.messageCount).toBeGreaterThan(0);
    });

    it("uses the same identifiers and timestamps as LeChatAdapter", () => {
        const plugin = createTestPlugin();
        const registry = new DefaultProviderRegistry();
        const extractor = new ConversationMetadataExtractor(registry as any, plugin as any);
        const adapter = new LeChatAdapter(plugin as any);

        const conversation: LeChatConversation = [
            {
                id: "msg-1",
                chatId: "lechat-1",
                role: "user",
                content: "Hello Le Chat",
                createdAt: "2024-02-01T10:00:00.000Z",
                contentChunks: [],
            },
            {
                id: "msg-2",
                chatId: "lechat-1",
                role: "assistant",
                content: "Hi there",
                createdAt: "2024-02-01T10:05:00.000Z",
                contentChunks: [],
            },
        ] as any;

        const metadata = (extractor as any).extractLeChatMetadata([conversation]) as any[];
        expect(metadata).toHaveLength(1);

        const m = metadata[0];
        expect(m.id).toBe(adapter.getId(conversation));
        expect(m.createTime).toBe(adapter.getCreateTime(conversation));
        expect(m.updateTime).toBe(adapter.getUpdateTime(conversation));
        expect(m.provider).toBe(adapter.getProviderName());
        expect(m.messageCount).toBe(conversation.length);
    });
});

