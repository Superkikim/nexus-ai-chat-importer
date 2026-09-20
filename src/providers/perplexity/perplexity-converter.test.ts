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
        expect(result.metadata?.mode).toEqual(["CONCISE"]);
        expect(result.metadata?.models).toEqual(["sonar"]);
        expect(result.metadata?.related_queries).toEqual(["A", "B"]);
        expect(result.chatUrl).toBe(
            "https://www.perplexity.ai/search/test-thread-abc123"
        );
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
        const assistant = result.messages.find(
            (message) => message.role === "assistant"
        );
        expect(assistant?.content).toContain("### References");
        expect(assistant?.content).toContain("[OpenAI](https://openai.com)");
    });
    describe("citation markers", () => {
        function answerFor(
            answer: string,
            sources?: PerplexityConversationFile["conversations"][0]["sources"]
        ): string | undefined {
            const result = PerplexityConverter.convertChat({
                metadata: { thread_id: "thread-3", thread_title: "Markers" },
                conversations: [
                    {
                        uuid: "turn-3",
                        query: "Is it [1] here?",
                        answer,
                        timestamp: "2024-01-01T10:00:10.000Z",
                        sources,
                    },
                ],
            });
            return result.messages.find(
                (message) => message.role === "assistant"
            )?.content;
        }

        it("removes markers that no source backs", () => {
            expect(answerFor("Cats sleep a lot [1][2]. Dogs too[3].")).toBe(
                "Cats sleep a lot. Dogs too."
            );
        });

        it("removes a marker placed before a colon", () => {
            expect(answerFor("Options include[2]:\n- one")).toBe(
                "Options include:\n- one"
            );
        });

        it("never leaves a marker that renders as an image", () => {
            expect(answerFor("Great news![1][4][3] More.")).toBe(
                "Great news! More."
            );
        });

        it("leaves code, links and definitions alone", () => {
            const answer = [
                "Use `items[1]` or see [2](https://example.com).",
                "```js",
                "const first = list[0] + list[1];",
                "```",
                "[3]: https://example.com/def",
            ].join("\n");

            expect(answerFor(answer)).toBe(answer);
        });

        it("keeps markers when the answer lists its sources", () => {
            expect(
                answerFor("Cats sleep [1].", [
                    { title: "Cats", url: "https://example.com/cats" },
                ])
            ).toContain("Cats sleep [1].");
        });

        it("never touches the question", () => {
            const result = PerplexityConverter.convertChat({
                metadata: { thread_id: "thread-4", thread_title: "Query" },
                conversations: [
                    {
                        uuid: "turn-4",
                        query: "What is x[1]?",
                        answer: "An element.",
                        timestamp: "2024-01-01T10:00:10.000Z",
                    },
                ],
            });
            expect(result.messages[0].content).toBe("What is x[1]?");
        });
    });
});
