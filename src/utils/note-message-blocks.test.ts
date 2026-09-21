import { describe, expect, it } from "vitest";
import { readNoteMessageBlocks } from "./note-message-blocks";

const NOTE = [
    "---",
    "conversation_id: thread-1",
    "---",
    "# Title: A thread",
    "",
    ">[!nexus_user] **User** - 01.01.2025 10:00:00",
    "> First question",
    "<!-- UID: turn-1-user -->",
    ">[!nexus_agent] **Assistant** - 01.01.2025 10:00:01",
    "> First answer [1]",
    ">",
    "> ### References",
    "> 1. [A source](https://example.com)",
    "<!-- UID: turn-1 -->",
    "",
    "---",
    ">[!nexus_user] **User** - 01.01.2025 10:05:00",
    "> Second question",
    "<!-- UID: turn-2-user -->",
    "",
    "## Related Queries",
    "- A follow-up",
].join("\n");

describe("readNoteMessageBlocks", () => {
    it("reads every message, in order, with its role and uid", () => {
        const blocks = readNoteMessageBlocks(NOTE);

        expect(blocks.map((block) => [block.role, block.uid])).toEqual([
            ["user", "turn-1-user"],
            ["assistant", "turn-1"],
            ["user", "turn-2-user"],
        ]);
    });

    it("gives back the text without the callout scaffolding", () => {
        const [question, answer] = readNoteMessageBlocks(NOTE);

        expect(question.text).toBe("First question");
        expect(answer.text).toBe(
            "First answer [1]\n\n### References\n1. [A source](https://example.com)"
        );
    });

    it("bounds each block from its callout to its UID comment", () => {
        const blocks = readNoteMessageBlocks(NOTE);

        for (const block of blocks) {
            const slice = NOTE.slice(block.start, block.end);
            expect(slice.startsWith(">[!nexus_")).toBe(true);
        }
        expect(NOTE.slice(blocks[0].end, blocks[1].start)).toBe("\n");
    });

    it("takes the rule an answer is followed by, so a rewrite replaces it", () => {
        const [, answer, question] = readNoteMessageBlocks(NOTE);

        expect(NOTE.slice(answer.start, answer.end)).toContain(
            "<!-- UID: turn-1 -->\n\n---"
        );
        expect(answer.text).not.toContain("---");
        expect(NOTE.slice(answer.end, question.start)).toBe("\n");
    });

    it("reads nothing from a note without messages", () => {
        expect(readNoteMessageBlocks("---\nid: x\n---\n# Title\n")).toEqual([]);
    });

    it("ignores a UID comment that closes no callout", () => {
        expect(readNoteMessageBlocks("<!-- UID: orphan -->")).toEqual([]);
    });
});
