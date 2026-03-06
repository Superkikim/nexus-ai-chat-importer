import { describe, it, expect } from "vitest";
import { StreamingJsonArrayParser } from "./streaming-json-array-parser";

/**
 * Tests for the lightweight streaming JSON array parser used for
 * gigantic conversations.json files.
 */

describe("StreamingJsonArrayParser", () => {
    async function* chunksFrom(parts: string[]): AsyncGenerator<string> {
        for (const part of parts) {
            yield part;
        }
    }

    it("streams ChatGPT-style top-level arrays", () => {
        const conversations = [
            { id: "c1", title: "First", nested: { value: 1 } },
            { id: "c2", title: "Second", messages: [{ text: "hello" }] },
        ];

        const json = JSON.stringify(conversations);

        const ids: string[] = [];
        for (const conv of StreamingJsonArrayParser.streamConversations(json)) {
            ids.push(conv.id);
        }

        expect(ids).toEqual(["c1", "c2"]);
    });

    it("streams Claude-style root object with conversations array", () => {
        const payload = {
            version: 2,
            conversations: [
                { uuid: "ca", name: "Alpha" },
                { uuid: "cb", name: "Beta", chat_messages: [{ text: "hi" }] },
            ],
            meta: { exported_at: "2024-01-01T00:00:00Z" },
        };

        const json = JSON.stringify(payload);
        const uuids: string[] = [];

        for (const conv of StreamingJsonArrayParser.streamConversations(json)) {
            uuids.push(conv.uuid);
        }

        expect(uuids).toEqual(["ca", "cb"]);
    });

    it("handles nested arrays and escaped quotes inside strings", () => {
        const conversations = [
            {
                id: "cx",
                title: "Complex",
                content: "He said: \"Hello [world]\" and left.",
                meta: {
                    examples: [
                        { text: "{ not a brace } inside string" },
                        { text: "array [ still in string ]" },
                    ],
                },
            },
        ];

        const json = JSON.stringify({ conversations });

        const result = Array.from(
            StreamingJsonArrayParser.streamConversations(json)
        );

        expect(result).toHaveLength(1);
        expect(result[0].id).toBe("cx");
        expect(result[0].meta.examples).toHaveLength(2);
    });

    it("skips elements that fail to parse but continues streaming", () => {
        const good1 = { id: "g1" };
        const bad = "{ this is not valid json }";
        const good2 = { id: "g2" };

        const arrayJson = `[${JSON.stringify(good1)},${bad},${JSON.stringify(good2)}]`;

        const ids: string[] = [];
        for (const conv of StreamingJsonArrayParser.streamConversations(arrayJson)) {
            if (conv && typeof conv.id === "string") {
                ids.push(conv.id);
            }
        }

        // The invalid middle element should be ignored
        expect(ids).toEqual(["g1", "g2"]);
    });

    it("streams chunked ChatGPT arrays with BOM prefix", async () => {
        const conversations = [
            { id: "c1", title: "First" },
            { id: "c2", title: "Second" },
        ];
        const json = `\uFEFF${JSON.stringify(conversations)}`;
        const parts = [json.slice(0, 2), json.slice(2, 9), json.slice(9)];

        const ids: string[] = [];
        for await (const conv of StreamingJsonArrayParser.streamConversationsFromChunks(chunksFrom(parts))) {
            ids.push(conv.id);
        }

        expect(ids).toEqual(["c1", "c2"]);
    });

    it("streams chunked Claude root object and ignores string false positives", async () => {
        const payload = {
            note: "example: \"conversations\":[not-real]",
            conversations: [
                { uuid: "ca", name: "Alpha" },
                { uuid: "cb", name: "Beta", chat_messages: [{ text: "hi" }] },
            ],
            meta: { exported_at: "2024-01-01T00:00:00Z" },
        };
        const json = JSON.stringify(payload);
        const keyStart = json.indexOf("\"conversations\"");
        const parts = [
            json.slice(0, keyStart + 5),
            json.slice(keyStart + 5, keyStart + 17),
            json.slice(keyStart + 17),
        ];

        const uuids: string[] = [];
        for await (const conv of StreamingJsonArrayParser.streamConversationsFromChunks(chunksFrom(parts))) {
            uuids.push(conv.uuid);
        }

        expect(uuids).toEqual(["ca", "cb"]);
    });
});
