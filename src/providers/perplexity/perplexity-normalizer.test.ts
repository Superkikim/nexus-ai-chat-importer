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
                    timestamp: "2024-01-01T10:00:10.000Z",
                },
            ],
        };

        const normalized = normalizePerplexityConversationFile(raw);

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
                    context_uuid: "context-abc",
                    thread_url_slug: "entries-thread-abc",
                    thread_title: "Entries Thread",
                    query_str: "Question?",
                    display_model: "sonar",
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

        const normalized = normalizePerplexityConversationFile(raw);

        expect(normalized).not.toBeNull();
        expect(normalized?.metadata.thread_id).toBe("context-abc");
        expect(normalized?.metadata.thread_title).toBe("Entries Thread");
        expect(normalized?.metadata.thread_url).toBe("entries-thread-abc");
        expect(normalized?.metadata.thread_created_at).toBe(
            "2024-02-01T00:00:00.000Z"
        );
        expect(normalized?.metadata.thread_updated_at).toBe(
            "2024-02-01T01:00:00.000Z"
        );
        expect(normalized?.conversations).toHaveLength(1);
        expect(normalized?.conversations[0].uuid).toBe("entry-1");
        expect(normalized?.conversations[0].query).toBe("Question?");
        expect(normalized?.conversations[0].answer).toBe("Answer text");
        expect(normalized?.conversations[0].model).toBe("sonar");
        expect(normalized?.conversations[0].related_queries).toEqual([
            "A",
            "B",
        ]);
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

        const normalized = normalizePerplexityConversationFile(raw);

        expect(normalized).not.toBeNull();
        expect(normalized?.conversations[0].answer).toBe("chunked answer");
    });

    it("falls back to thread_url_slug when context_uuid is absent", () => {
        const raw = {
            entries: [
                {
                    uuid: "entry-3",
                    thread_url_slug: "entries-thread-fallback",
                    query_str: "Question?",
                    entry_created_datetime: "2024-02-01T00:10:00.000Z",
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

        const normalized = normalizePerplexityConversationFile(raw);
        expect(normalized?.metadata.thread_id).toBe("entries-thread-fallback");
    });
    describe("Perplexity's own data export", () => {
        const officialConversation = {
            context_uuid: "11111111-aaaa-4bbb-8ccc-000000000001",
            context_title: "Official Thread",
            created_at: "2025-03-01T08:00:00.000Z",
            updated_at: "2025-03-01T08:30:00.000Z",
            collection_uuid: null,
            entries: [
                {
                    entry_uuid: "22222222-aaaa-4bbb-8ccc-000000000002",
                    query: "Second question",
                    answer: "Second answer",
                    created_at: "2025-03-01T08:20:00.000Z",
                    label: null,
                    query_status: null,
                    engine_mode: "pro",
                },
                {
                    entry_uuid: "22222222-aaaa-4bbb-8ccc-000000000001",
                    query: "First question",
                    answer: "First answer",
                    created_at: "2025-03-01T08:00:00.000Z",
                    label: "reject",
                    query_status: "COMPLETED",
                    engine_mode: null,
                },
            ],
        };

        it("reads the conversation and orders its entries by time", () => {
            const normalized =
                normalizePerplexityConversationFile(officialConversation);

            expect(normalized?.metadata.thread_id).toBe(
                "11111111-aaaa-4bbb-8ccc-000000000001"
            );
            expect(normalized?.metadata.thread_title).toBe("Official Thread");
            expect(normalized?.metadata.thread_created_at).toBe(
                "2025-03-01T08:00:00.000Z"
            );
            expect(normalized?.conversations.map((turn) => turn.uuid)).toEqual([
                "22222222-aaaa-4bbb-8ccc-000000000001",
                "22222222-aaaa-4bbb-8ccc-000000000002",
            ]);
            expect(normalized?.conversations[0]).toMatchObject({
                query: "First question",
                answer: "First answer",
                timestamp: "2025-03-01T08:00:00.000Z",
            });
        });

        it("keeps a rejected answer and never reports a model", () => {
            const normalized =
                normalizePerplexityConversationFile(officialConversation);

            expect(normalized?.conversations).toHaveLength(2);
            expect(normalized?.conversations.every((turn) => !turn.model)).toBe(
                true
            );
        });

        it("links the thread through its first entry", () => {
            const normalized =
                normalizePerplexityConversationFile(officialConversation);

            expect(normalized?.metadata.thread_url).toBe(
                "22222222-aaaa-4bbb-8ccc-000000000001"
            );
        });

        it("dates the update no earlier than the last entry", () => {
            const staleUpdate = {
                ...officialConversation,
                updated_at: "2025-03-01T08:10:00.000Z",
            };

            expect(
                normalizePerplexityConversationFile(staleUpdate)?.metadata
                    .thread_updated_at
            ).toBe("2025-03-01T08:20:00.000Z");
            expect(
                normalizePerplexityConversationFile(officialConversation)
                    ?.metadata.thread_updated_at
            ).toBe("2025-03-01T08:30:00.000Z");
        });

        it("previews the title, which is the first question in full", () => {
            const long = {
                ...officialConversation,
                context_title:
                    "How do I tune the\nsecond stage of a long   pipeline when it stalls under load?",
            };

            expect(
                normalizePerplexityConversationFile(long)?.metadata.thread_title
            ).toBe("How do I tune the second stage of a long pipeline...");
            expect(
                normalizePerplexityConversationFile(officialConversation)
                    ?.metadata.thread_title
            ).toBe("Official Thread");
        });

        it("names a conversation with a blank title Untitled", () => {
            expect(
                normalizePerplexityConversationFile({
                    ...officialConversation,
                    context_title: "  ",
                })?.metadata.thread_title
            ).toBe("Untitled");
        });

        it("leaves the Thread Exporter's real titles whole", () => {
            const title =
                "A real title from the extension that is well over fifty characters long";
            const normalized = normalizePerplexityConversationFile({
                metadata: { thread_id: "t", thread_title: title },
                conversations: [{ uuid: "u", query: "Q", answer: "A" }],
            });

            expect(normalized?.metadata.thread_title).toBe(title);
        });

        it("rejects a conversation without a usable entry", () => {
            expect(
                normalizePerplexityConversationFile({
                    ...officialConversation,
                    entries: [{ entry_uuid: "no-content" }],
                })
            ).toBeNull();
        });
    });
});
