import { describe, expect, it } from "vitest";
import { normalizePerplexityConversationFile } from "./perplexity-normalizer";

describe("PerplexityNormalizer", () => {
    it("normalizes legacy metadata+conversations format", () => {
        const raw = {
            metadata: {
                thread_id: "legacy-thread",
                thread_title: "Legacy Thread",
                thread_url: "legacy-thread-slug",
                thread_created_at: "2024-01-01T10:00:00.000Z",
                thread_updated_at: "2024-01-01T10:05:00.000Z",
            },
            conversations: [
                {
                    uuid: "turn-1",
                    query: "Q",
                    answer: "A",
                    model: "sonar",
                    mode: "CONCISE",
                    timestamp: "2024-01-01T10:00:10.000Z",
                },
            ],
        };

        const normalized = normalizePerplexityConversationFile(raw as any);

        expect(normalized).not.toBeNull();
        expect(normalized?.metadata.thread_id).toBe("legacy-thread");
        expect(normalized?.metadata.thread_title).toBe("Legacy Thread");
        expect(normalized?.conversations).toHaveLength(1);
        expect(normalized?.conversations[0].uuid).toBe("turn-1");
    });

    it("normalizes entries[] format from Thread Exporter", () => {
        const raw = {
            status: "success",
            thread_metadata: {
                title: "Entries Thread",
                created_at: "2024-02-01T00:00:00.000Z",
                updated_at: "2024-02-01T01:00:00.000Z",
            },
            entries: [
                {
                    uuid: "entry-1",
                    thread_url_slug: "entries-thread-abc",
                    thread_title: "Entries Thread",
                    query_str: "Question?",
                    display_model: "sonar",
                    mode: "CONCISE",
                    entry_created_datetime: "2024-02-01T00:10:00.000Z",
                    related_queries: ["A", "B"],
                    blocks: [
                        {
                            markdown_block: {
                                answer: "Answer text",
                            },
                        },
                    ],
                },
            ],
        };

        const normalized = normalizePerplexityConversationFile(raw as any);

        expect(normalized).not.toBeNull();
        expect(normalized?.metadata.thread_id).toBe("entries-thread-abc");
        expect(normalized?.metadata.thread_title).toBe("Entries Thread");
        expect(normalized?.metadata.thread_url).toBe("entries-thread-abc");
        expect(normalized?.metadata.thread_created_at).toBe("2024-02-01T00:00:00.000Z");
        expect(normalized?.metadata.thread_updated_at).toBe("2024-02-01T01:00:00.000Z");
        expect(normalized?.conversations).toHaveLength(1);
        expect(normalized?.conversations[0].uuid).toBe("entry-1");
        expect(normalized?.conversations[0].query).toBe("Question?");
        expect(normalized?.conversations[0].answer).toBe("Answer text");
        expect(normalized?.conversations[0].model).toBe("sonar");
        expect(normalized?.conversations[0].mode).toBe("CONCISE");
        expect(normalized?.conversations[0].related_queries).toEqual(["A", "B"]);
    });

    it("uses chunks fallback when answer is missing", () => {
        const raw = {
            entries: [
                {
                    uuid: "entry-2",
                    thread_url_slug: "entries-thread-xyz",
                    query_str: "Question?",
                    entry_created_datetime: "2024-02-01T00:10:00.000Z",
                    blocks: [
                        {
                            markdown_block: {
                                chunks: ["chunk", "ed", " answer"],
                            },
                        },
                    ],
                },
            ],
        };

        const normalized = normalizePerplexityConversationFile(raw as any);

        expect(normalized).not.toBeNull();
        expect(normalized?.conversations[0].answer).toBe("chunked answer");
    });
});
