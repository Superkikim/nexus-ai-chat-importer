import { describe, expect, it } from "vitest";
import { PerplexityAdapter } from "./perplexity-adapter";

describe("PerplexityAdapter", () => {
    const adapter = new PerplexityAdapter();

    const sampleChat = {
        metadata: {
            thread_id: "thread-1",
            thread_title: "Sample Thread",
            thread_created_at: "2024-01-01T00:00:00.000Z",
            thread_updated_at: "2024-01-01T01:00:00.000Z",
        },
        conversations: [
            {
                uuid: "turn-1",
                query: "Hello",
                answer: "Hi",
                timestamp: "2024-01-01T00:00:10.000Z",
            },
        ],
    };

    it("detects Perplexity thread format", () => {
        expect(adapter.detect([sampleChat])).toBe(true);
        expect(adapter.detect([{}])).toBe(false);
    });

    it("detects and reads Perplexity entries[] export format", () => {
        const entriesChat = {
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
                    mode: "CONCISE",
                    entry_created_datetime: "2024-02-01T00:10:00.000Z",
                    blocks: [
                        {
                            markdown_block: {
                                answer: "Answer.",
                            },
                        },
                    ],
                },
            ],
        };

        expect(adapter.detect([entriesChat])).toBe(true);
        expect(adapter.getId(entriesChat as any)).toBe("context-abc");
        expect(adapter.getTitle(entriesChat as any)).toBe("Entries Thread");
        expect(adapter.getCreateTime(entriesChat as any)).toBe(1706745600);
        expect(adapter.getUpdateTime(entriesChat as any)).toBe(1706749200);
    });

    it("uses turn uuid for incremental append detection", () => {
        const newTurns = adapter.getNewMessages(sampleChat, ["turn-1"]);
        expect(newTurns).toHaveLength(0);
    });

    it("uses entry uuid for incremental append detection on entries[] format", () => {
        const entriesChat = {
            status: "success",
            entries: [
                {
                    uuid: "entry-1",
                    context_uuid: "context-abc",
                    thread_url_slug: "entries-thread-abc",
                    query_str: "Question?",
                    entry_created_datetime: "2024-02-01T00:10:00.000Z",
                    blocks: [
                        {
                            markdown_block: {
                                answer: "Answer.",
                            },
                        },
                    ],
                },
            ],
        };

        const newTurns = adapter.getNewMessages(entriesChat, ["entry-1"]);
        expect(newTurns).toHaveLength(0);
    });

    it("converts entries[] format to standard conversation", () => {
        const entriesChat = {
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

        const converted = adapter.convertChat(entriesChat);
        expect(converted.id).toBe("context-abc");
        expect(converted.provider).toBe("perplexity");
        expect(converted.messages).toHaveLength(2);
        expect(converted.messages[1].model).toBe("sonar");
        expect(converted.metadata?.mode).toEqual(["CONCISE"]);
        expect(converted.metadata?.models).toEqual(["sonar"]);
    });
    it("detects and converts a conversation from Perplexity's own export", () => {
        const officialChat = {
            context_uuid: "33333333-aaaa-4bbb-8ccc-000000000001",
            context_title: "Official Thread",
            created_at: "2025-03-01T08:00:00.000Z",
            updated_at: "2025-03-01T08:30:00.000Z",
            mode: "CONCISE",
            collection_uuid: null,
            entries: [
                {
                    entry_uuid: "44444444-aaaa-4bbb-8ccc-000000000001",
                    query: "Question?",
                    answer: "Answer.",
                    created_at: "2025-03-01T08:00:00.000Z",
                    label: null,
                    query_status: "COMPLETED",
                    engine_mode: "auto",
                },
            ],
        };

        expect(adapter.detect([officialChat])).toBe(true);
        expect(adapter.getId(officialChat)).toBe(
            "33333333-aaaa-4bbb-8ccc-000000000001"
        );
        expect(
            adapter.getNewMessages(officialChat, [
                "44444444-aaaa-4bbb-8ccc-000000000001",
            ])
        ).toHaveLength(0);

        const converted = adapter.convertChat(officialChat);
        expect(converted.messages.map((message) => message.id)).toEqual([
            "44444444-aaaa-4bbb-8ccc-000000000001-user",
            "44444444-aaaa-4bbb-8ccc-000000000001",
        ]);
        expect(converted.chatUrl).toBe(
            "https://www.perplexity.ai/search/44444444-aaaa-4bbb-8ccc-000000000001"
        );
        expect(converted.metadata?.mode).toEqual(["CONCISE"]);
        expect(converted.metadata?.models).toEqual([]);
    });

    it("counts turns for the report in every export shape", () => {
        const column = adapter
            .getReportNamingStrategy()
            .getProviderSpecificColumn();
        const officialChat = {
            context_uuid: "33333333-aaaa-4bbb-8ccc-000000000002",
            entries: [
                {
                    entry_uuid: "44444444-aaaa-4bbb-8ccc-000000000002",
                    query: "Q",
                    answer: "A",
                    created_at: "2025-03-01T08:00:00.000Z",
                },
            ],
        };

        expect(column.getValue(adapter, sampleChat)).toBe(1);
        expect(column.getValue(adapter, officialChat)).toBe(1);
    });
});
