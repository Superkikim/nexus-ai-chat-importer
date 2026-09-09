import { describe, it, expect } from "vitest";
import {
    DEFAULT_CONVERSATION_ID_FIELD,
    conversationIdFieldCandidates,
    isValidConversationIdField,
    readConversationId,
    resolveConversationIdField,
} from "./conversation-id-field";

describe("resolveConversationIdField", () => {
    it("defaults when unset", () => {
        expect(resolveConversationIdField(undefined)).toBe(
            DEFAULT_CONVERSATION_ID_FIELD
        );
        expect(resolveConversationIdField("")).toBe(
            DEFAULT_CONVERSATION_ID_FIELD
        );
        expect(resolveConversationIdField("   ")).toBe(
            DEFAULT_CONVERSATION_ID_FIELD
        );
    });

    it("uses a configured key", () => {
        expect(resolveConversationIdField("uid")).toBe("uid");
        expect(resolveConversationIdField("  uid  ")).toBe("uid");
    });

    it("falls back rather than emit unparseable YAML", () => {
        for (const bad of ["a b", "2uid", "uid:", "-uid", "ui d", "üid"]) {
            expect(resolveConversationIdField(bad)).toBe(
                DEFAULT_CONVERSATION_ID_FIELD
            );
        }
    });
});

describe("isValidConversationIdField", () => {
    it("accepts plain keys", () => {
        for (const ok of ["uid", "conversation_id", "_id", "note-id", "id2"]) {
            expect(isValidConversationIdField(ok)).toBe(true);
        }
    });

    it("rejects keys that break frontmatter", () => {
        for (const bad of ["a b", "2uid", "uid:", "", "-uid"]) {
            expect(isValidConversationIdField(bad)).toBe(false);
        }
    });
});

describe("conversationIdFieldCandidates", () => {
    it("puts the configured key first, then fallbacks", () => {
        expect(conversationIdFieldCandidates("uid")).toEqual([
            "uid",
            "conversation_id",
        ]);
    });

    it("does not repeat the configured key", () => {
        expect(conversationIdFieldCandidates("conversation_id")).toEqual([
            "conversation_id",
            "uid",
        ]);
    });

    it("always includes both built-ins", () => {
        expect(conversationIdFieldCandidates("note-id")).toEqual([
            "note-id",
            "conversation_id",
            "uid",
        ]);
    });
});

describe("readConversationId", () => {
    it("reads a uid-keyed note when uid is configured", () => {
        expect(readConversationId({ uid: "abc" }, "uid")).toBe("abc");
    });

    it("still reads a uid-keyed note under default settings", () => {
        // The case that matters: a vault renamed conversation_id -> uid by
        // hand must not look brand new to the importer.
        expect(readConversationId({ uid: "abc" }, undefined)).toBe("abc");
    });

    it("still reads a conversation_id note after switching to uid", () => {
        expect(readConversationId({ conversation_id: "abc" }, "uid")).toBe(
            "abc"
        );
    });

    it("prefers the configured key when a note carries both", () => {
        expect(
            readConversationId(
                { uid: "from-uid", conversation_id: "from-cid" },
                "uid"
            )
        ).toBe("from-uid");
        expect(
            readConversationId(
                { uid: "from-uid", conversation_id: "from-cid" },
                undefined
            )
        ).toBe("from-cid");
    });

    it("ignores blank and non-string values", () => {
        expect(readConversationId({ uid: "   " }, "uid")).toBeNull();
        expect(readConversationId({ uid: 42 }, "uid")).toBeNull();
        expect(readConversationId({}, "uid")).toBeNull();
        expect(readConversationId(null, "uid")).toBeNull();
    });

    it("trims surrounding whitespace", () => {
        expect(readConversationId({ uid: "  abc  " }, "uid")).toBe("abc");
    });
});
