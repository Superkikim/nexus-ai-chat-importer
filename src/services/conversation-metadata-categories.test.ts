import { describe, expect, it } from "vitest";
import {
    analyzeCategories,
    ConversationMetadata,
    countExclusions,
} from "./conversation-metadata-extractor";

function item(
    id: string,
    category?: string,
    exclusionReason?: string
): ConversationMetadata {
    return {
        id,
        title: id,
        createTime: 0,
        updateTime: 0,
        messageCount: 1,
        provider: "grok",
        category,
        exclusionReason,
    };
}

describe("analysis exclusions", () => {
    it("counts exclusions by category and reason", () => {
        expect(
            countExclusions([
                item("a", "Imagine", "empty prompt"),
                item("b", "Imagine", "empty prompt"),
                item("c", undefined, "no messages"),
            ])
        ).toEqual([
            { category: "Imagine", reason: "empty prompt", count: 2 },
            { category: "Conversations", reason: "no messages", count: 1 },
        ]);
    });
});

describe("analysis categories", () => {
    it("balances found, excluded, duplicates and kept per category", () => {
        const found = [
            item("c1"),
            item("c1"),
            item("c2"),
            item("p1", "Imagine"),
            item("p2", "Imagine", "empty prompt"),
        ];
        const kept = [item("c1"), item("c2"), item("p1", "Imagine")];

        expect(analyzeCategories(found, kept, [item("c2")])).toEqual({
            Conversations: {
                found: 3,
                excluded: 0,
                duplicates: 1,
                kept: 2,
                droppedUnchanged: 1,
            },
            Imagine: {
                found: 2,
                excluded: 1,
                duplicates: 0,
                kept: 1,
                droppedUnchanged: 0,
            },
        });
    });
});
