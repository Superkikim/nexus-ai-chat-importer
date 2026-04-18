import { describe, expect, it } from "vitest";
import { PerplexityConverter } from "./perplexity-converter";
import { PerplexityConversationFile } from "./perplexity-types";

describe("PerplexityConverter", () => {
    it("converts Perplexity thread JSON to standard conversation with mode/models", () => {
        const chat: PerplexityConversationFile = {
            metadata: {
                thread_id: "thread-1",
                thread_title: "Test Thread",
                thread_url: "test-thread-abc123",
                thread_created_at: "2024-01-01T10:00:00.000Z",
                thread_updated_at: "2024-01-01T10:05:00.000Z",
            },
            conversations: [
                {
                    uuid: "turn-1",
                    query: "Question",
                    answer: "Answer",
                    model: "sonar",
                    mode: "CONCISE",
                    timestamp: "2024-01-01T10:00:10.000Z",
                    related_queries: ["A", "B", "A"],
                },
            ],
        };

        const result = PerplexityConverter.convertChat(chat);

        expect(result.id).toBe("thread-1");
        expect(result.provider).toBe("perplexity");
        expect(result.messages).toHaveLength(2);
        expect(result.messages[1].id).toBe("turn-1");
        expect(result.messages[1].model).toBe("sonar");
        expect(result.metadata?.mode).toBe("CONCISE");
        expect(result.metadata?.models).toEqual(["sonar"]);
        expect(result.metadata?.related_queries).toEqual(["A", "B"]);
        expect(result.chatUrl).toBe("https://www.perplexity.ai/search/test-thread-abc123");
    });

    it("adds references block when sources are present", () => {
        const chat: PerplexityConversationFile = {
            metadata: {
                thread_id: "thread-2",
                thread_title: "Thread with Sources",
            },
            conversations: [
                {
                    uuid: "turn-2",
                    query: "Q",
                    answer: "A",
                    timestamp: "2024-01-01T10:00:10.000Z",
                    sources: [
                        {
                            title: "OpenAI",
                            url: "https://openai.com",
                            snippet: "Research preview",
                        },
                    ],
                },
            ],
        };

        const result = PerplexityConverter.convertChat(chat);
        const assistant = result.messages.find(message => message.role === "assistant");
        expect(assistant?.content).toContain("### References");
        expect(assistant?.content).toContain("[OpenAI](https://openai.com)");
    });
});
