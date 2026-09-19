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
            ids.push((conv as { id: string }).id);
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
            uuids.push((conv as { uuid: string }).uuid);
        }

        expect(uuids).toEqual(["ca", "cb"]);
    });

    it("handles nested arrays and escaped quotes inside strings", () => {
        const conversations = [
            {
                id: "cx",
                title: "Complex",
                content: 'He said: "Hello [world]" and left.',
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

        type R = { id: string; meta: { examples: unknown[] } };
        expect(result).toHaveLength(1);
        expect((result[0] as R).id).toBe("cx");
        expect((result[0] as R).meta.examples).toHaveLength(2);
    });

    it("skips elements that fail to parse but continues streaming", () => {
        const good1 = { id: "g1" };
        const bad = "{ this is not valid json }";
        const good2 = { id: "g2" };

        const arrayJson = `[${JSON.stringify(good1)},${bad},${JSON.stringify(
            good2
        )}]`;

        const ids: string[] = [];
        for (const conv of StreamingJsonArrayParser.streamConversations(
            arrayJson
        )) {
            const item = conv as Record<string, unknown>;
            if (item.id && typeof item.id === "string") {
                ids.push(item.id);
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
        for await (const conv of StreamingJsonArrayParser.streamConversationsFromChunks(
            chunksFrom(parts)
        )) {
            ids.push((conv as { id: string }).id);
        }

        expect(ids).toEqual(["c1", "c2"]);
    });

    it("streams chunked Claude root object and ignores string false positives", async () => {
        const payload = {
            note: 'example: "conversations":[not-real]',
            conversations: [
                { uuid: "ca", name: "Alpha" },
                { uuid: "cb", name: "Beta", chat_messages: [{ text: "hi" }] },
            ],
            meta: { exported_at: "2024-01-01T00:00:00Z" },
        };
        const json = JSON.stringify(payload);
        const keyStart = json.indexOf('"conversations"');
        const parts = [
            json.slice(0, keyStart + 5),
            json.slice(keyStart + 5, keyStart + 17),
            json.slice(keyStart + 17),
        ];

        const uuids: string[] = [];
        for await (const conv of StreamingJsonArrayParser.streamConversationsFromChunks(
            chunksFrom(parts)
        )) {
            uuids.push((conv as { uuid: string }).uuid);
        }

        expect(uuids).toEqual(["ca", "cb"]);
    });

    async function collect(
        parts: string[],
        arrayKey?: string
    ): Promise<unknown[]> {
        const items: unknown[] = [];
        for await (const item of StreamingJsonArrayParser.streamConversationsFromChunks(
            chunksFrom(parts),
            arrayKey
        )) {
            items.push(item);
        }
        return items;
    }

    function splitEvery(text: string, size: number): string[] {
        const parts: string[] = [];
        for (let i = 0; i < text.length; i += size) {
            parts.push(text.slice(i, i + size));
        }
        return parts;
    }

    it("streams a named array that follows a large one", async () => {
        const payload = {
            conversations: Array.from({ length: 2000 }, (_, i) => ({
                id: `c${i}`,
                text: "x".repeat(5000),
            })),
            media_posts: [{ id: "p1" }, { id: "p2" }],
        };
        const json = JSON.stringify(payload);
        expect(json.length).toBeGreaterThan(8 * 1024 * 1024);

        const posts = await collect(splitEvery(json, 64 * 1024), "media_posts");

        expect(posts).toEqual([{ id: "p1" }, { id: "p2" }]);
    });

    it("finds a named array one character at a time", async () => {
        const json = JSON.stringify({
            conversations: [{ id: "c1" }],
            media_posts: [{ id: "p1", prompt: 'say "media_posts": [1]' }],
        });

        const conversations = await collect(splitEvery(json, 1));
        const posts = await collect(splitEvery(json, 1), "media_posts");

        expect(conversations).toEqual([{ id: "c1" }]);
        expect(posts).toEqual([{ id: "p1", prompt: 'say "media_posts": [1]' }]);
    });

    it("ignores a nested property with the same name", async () => {
        const json = JSON.stringify({
            conversations: [{ media_posts: [{ id: "nested" }] }],
            media_posts: [{ id: "top" }],
        });

        expect(await collect([json], "media_posts")).toEqual([{ id: "top" }]);
    });

    it("ignores a string value equal to the key", async () => {
        const json = JSON.stringify({
            label: "media_posts",
            media_posts: [{ id: "top" }],
        });

        expect(await collect([json], "media_posts")).toEqual([{ id: "top" }]);
    });

    it("rejects a named array that is absent", async () => {
        const json = JSON.stringify({ conversations: [{ id: "c1" }] });

        await expect(collect([json], "media_posts")).rejects.toThrow(
            "Could not find media_posts array"
        );
    });

    it("matches a bare top-level array only for the default key", async () => {
        const json = JSON.stringify([{ id: "c1" }]);

        expect(await collect([json])).toEqual([{ id: "c1" }]);
        await expect(collect([json], "media_posts")).rejects.toThrow(
            "Could not find media_posts array"
        );
    });

    it("yields nothing for an empty named array", async () => {
        const json = JSON.stringify({ conversations: [], media_posts: [] });

        expect(await collect([json], "media_posts")).toEqual([]);
    });

    it("closes its source when it stops before the end", async () => {
        let closed = false;
        async function* source(): AsyncGenerator<string> {
            try {
                yield '{"conversations": [{"id": "c1"}], ';
                yield '"media_posts": [{"id": "p1"}]}';
            } finally {
                closed = true;
            }
        }

        const items: unknown[] = [];
        for await (const item of StreamingJsonArrayParser.streamConversationsFromChunks(
            source()
        )) {
            items.push(item);
        }

        expect(items).toEqual([{ id: "c1" }]);
        expect(closed).toBe(true);
    });

    it("closes its source when the array is absent", async () => {
        let closed = false;
        async function* source(): AsyncGenerator<string> {
            try {
                yield '{"a": 1}';
                yield " ";
            } finally {
                closed = true;
            }
        }

        await expect(collectFrom(source(), "media_posts")).rejects.toThrow(
            "Could not find media_posts array"
        );
        expect(closed).toBe(true);
    });

    async function collectFrom(
        chunks: AsyncIterable<string>,
        arrayKey: string
    ): Promise<unknown[]> {
        const items: unknown[] = [];
        for await (const item of StreamingJsonArrayParser.streamConversationsFromChunks(
            chunks,
            arrayKey
        )) {
            items.push(item);
        }
        return items;
    }
});
