import { describe, expect, it } from "vitest";
import { parseConversationsJson, streamParseJsonArray } from "./conversations-json-parser";

describe("streamParseJsonArray", () => {
    it("parses a simple JSON array", async () => {
        const data = new TextEncoder().encode('[{"id":1},{"id":2,"title":"test"}]');
        const parsed = await streamParseJsonArray(data);
        expect(parsed).toEqual([{ id: 1 }, { id: 2, title: "test" }]);
    });

    it("handles braces inside strings", async () => {
        const data = new TextEncoder().encode('[{"text":"{hello}"}]');
        const parsed = await streamParseJsonArray(data);
        expect(parsed[0].text).toBe("{hello}");
    });

    it(
        "supports very large single items without tripping buffer guard",
        async () => {
            const bigText = "a".repeat(70 * 1024 * 1024); // ~70MB
            const json = JSON.stringify([{ id: 1, text: bigText }]);
            const data = new TextEncoder().encode(json);

            const parsed = await streamParseJsonArray(data);
            expect(parsed[0].text.length).toBe(bigText.length);
        },
        30000
    );
});

describe("parseConversationsJson", () => {
    it("falls back when string decoding is too large", async () => {
        const fakeZipFile = {
            async async(type: string) {
                if (type === "string") {
                    throw new RangeError("Invalid string length");
                }
                if (type === "uint8array") {
                    return new TextEncoder().encode('[{"id":1},{"id":2}]');
                }
                throw new Error("Unexpected type");
            }
        } as any;

        const parsed = await parseConversationsJson(fakeZipFile);
        expect(Array.isArray(parsed)).toBe(true);
        expect(parsed.length).toBe(2);
    });
});
