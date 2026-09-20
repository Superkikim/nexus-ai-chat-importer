import { describe, expect, it } from "vitest";
import { planPerplexityNoteMerge } from "./perplexity-note-merge";
import { NoteMessageBlock } from "../../utils/note-message-blocks";
import { StandardMessage } from "../../types/standard";

let offset = 0;

function block(
    role: NoteMessageBlock["role"],
    text: string,
    uid = `uid-${offset}`
): NoteMessageBlock {
    const start = offset;
    offset += text.length + 10;
    return { uid, role, text, start, end: offset };
}

function message(
    role: StandardMessage["role"],
    content: string,
    id = `msg-${content.slice(0, 6)}`
): StandardMessage {
    return { id, role, content, timestamp: 1000 };
}

const WITH_SOURCES = [
    "An answer [1]",
    "",
    "### References",
    "1. [A source](https://example.com)",
].join("\n");

describe("planPerplexityNoteMerge", () => {
    it("adds a turn the note does not have", () => {
        offset = 0;
        const existing = [
            block("user", "First question"),
            block("assistant", "First answer"),
        ];
        const incoming = [
            message("user", "First question"),
            message("assistant", "First answer"),
            message("user", "Second question"),
            message("assistant", "Second answer"),
        ];

        const plan = planPerplexityNoteMerge(existing, incoming);

        expect(plan.append.map((m) => m.content)).toEqual([
            "Second question",
            "Second answer",
        ]);
        expect(plan.rewrites).toEqual([]);
    });

    it("matches a question the exports word identically but number differently", () => {
        offset = 0;
        const existing = [
            block("user", "First question", "official-1-user"),
            block("assistant", "First answer", "official-1"),
        ];
        const incoming = [
            message("user", "First question", "extension-1-user"),
            message("assistant", "First answer", "extension-1"),
        ];

        const plan = planPerplexityNoteMerge(existing, incoming);

        expect(plan.append).toEqual([]);
        expect(plan.rewrites).toEqual([]);
    });

    it("rewrites a turn whose sources the note lacks", () => {
        offset = 0;
        const question = block("user", "First question");
        const answer = block("assistant", "An answer");
        const incoming = [
            message("user", "First question"),
            message("assistant", WITH_SOURCES),
        ];

        const plan = planPerplexityNoteMerge([question, answer], incoming);

        expect(plan.append).toEqual([]);
        expect(plan.rewrites).toHaveLength(1);
        expect(plan.rewrites[0].start).toBe(question.start);
        expect(plan.rewrites[0].end).toBe(answer.end);
        expect(plan.rewrites[0].messages).toEqual(incoming);
    });

    it("leaves a turn that already has its sources", () => {
        offset = 0;
        const existing = [
            block("user", "First question"),
            block("assistant", WITH_SOURCES),
        ];
        const incoming = [
            message("user", "First question"),
            message("assistant", WITH_SOURCES),
        ];

        expect(planPerplexityNoteMerge(existing, incoming)).toEqual({
            append: [],
            rewrites: [],
        });
    });

    it("never strips sources the note already holds", () => {
        offset = 0;
        const existing = [
            block("user", "First question"),
            block("assistant", WITH_SOURCES),
        ];
        const incoming = [
            message("user", "First question"),
            message("assistant", "An answer"),
        ];

        expect(planPerplexityNoteMerge(existing, incoming)).toEqual({
            append: [],
            rewrites: [],
        });
    });

    it("tells two identical questions apart by their order", () => {
        offset = 0;
        const existing = [
            block("user", "Continue"),
            block("assistant", WITH_SOURCES),
            block("user", "Continue"),
            block("assistant", "Second answer"),
        ];
        const incoming = [
            message("user", "Continue", "a-user"),
            message("assistant", "First answer", "a"),
            message("user", "Continue", "b-user"),
            message("assistant", WITH_SOURCES, "b"),
        ];

        const plan = planPerplexityNoteMerge(existing, incoming);

        expect(plan.append).toEqual([]);
        expect(plan.rewrites).toHaveLength(1);
        expect(plan.rewrites[0].messages[1].id).toBe("b");
    });

    it("matches questions that differ only past the first 60 characters", () => {
        offset = 0;
        const long =
            "A question long enough to pass the sixty character key, ending";
        const existing = [block("user", long + " here")];
        const incoming = [message("user", long + " elsewhere")];

        expect(planPerplexityNoteMerge(existing, incoming).append).toEqual([]);
    });

    it("adds everything to a note with no messages", () => {
        offset = 0;
        const incoming = [
            message("user", "First question"),
            message("assistant", "First answer"),
        ];

        expect(planPerplexityNoteMerge([], incoming).append).toEqual(incoming);
    });
});
