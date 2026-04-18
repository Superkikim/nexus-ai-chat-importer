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

    it("uses turn uuid for incremental append detection", () => {
        const newTurns = adapter.getNewMessages(sampleChat as any, ["turn-1"]);
        expect(newTurns).toHaveLength(0);
    });
});
