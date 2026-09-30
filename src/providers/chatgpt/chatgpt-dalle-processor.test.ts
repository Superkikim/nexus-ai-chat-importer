// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, it, expect } from "vitest";
import { ChatGPTDalleProcessor } from "./chatgpt-dalle-processor";
import type { Chat } from "./chatgpt-types";

// Invented conversation: user asks, assistant emits a DALL-E prompt, a tool
// message carries the image.
function makeChat(withChildren: boolean): Chat {
    const node = (
        id: string,
        parent: string | null,
        children: string[],
        message: unknown
    ) => ({
        id,
        parent,
        message,
        ...(withChildren ? { children } : {}),
    });
    return {
        id: "conv-1",
        mapping: {
            u1: node("u1", null, ["p1"], {
                id: "u1",
                author: { role: "user" },
                content: { parts: ["draw a kite"] },
            }),
            p1: node("p1", "u1", ["i1"], {
                id: "p1",
                author: { role: "assistant" },
                recipient: "dalle.text2im",
                create_time: 100,
                content: {
                    content_type: "text",
                    parts: ['{"prompt": "a red kite"}'],
                },
            }),
            i1: node("i1", "p1", [], {
                id: "i1",
                author: { role: "tool" },
                content: {
                    parts: [
                        {
                            content_type: "image_asset_pointer",
                            asset_pointer: "file-service://file-abc",
                            metadata: { dalle: { gen_id: "g1" } },
                        },
                    ],
                },
            }),
        },
    } as unknown as Chat;
}

describe("extractDallePromptsFromMapping", () => {
    it("pairs a prompt with its image through children", () => {
        const r = ChatGPTDalleProcessor.extractDallePromptsFromMapping(
            makeChat(true)
        );
        expect([...r.imagePrompts.keys()]).toEqual(["i1"]);
        expect(r.orphanedPrompts.size).toBe(0);
    });

    it("pairs a prompt with its image when nodes carry only parent", () => {
        const r = ChatGPTDalleProcessor.extractDallePromptsFromMapping(
            makeChat(false)
        );
        expect(r.imagePrompts.get("i1")?.prompt).toBe("a red kite");
        expect(r.orphanedPrompts.size).toBe(0);
    });
});
