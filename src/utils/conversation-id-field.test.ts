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
    it("tries the built-in key before the configured one", () => {
        // Order matters: a vault whose uid plugin stamps a random `uid` on
        // every note would otherwise resolve already-imported notes to that
        // random value and duplicate the whole library on the next import.
        expect(conversationIdFieldCandidates("uid")).toEqual([
            "conversation_id",
            "uid",
        ]);
    });

    it("does not repeat the key when the default is configured", () => {
        expect(conversationIdFieldCandidates("conversation_id")).toEqual([
            "conversation_id",
        ]);
    });

    it("does not read keys that are neither built-in nor configured", () => {
        expect(conversationIdFieldCandidates("note-id")).toEqual([
            "conversation_id",
            "note-id",
        ]);
        expect(conversationIdFieldCandidates(undefined)).toEqual([
            "conversation_id",
        ]);
    });
});

describe("readConversationId", () => {
    it("reads a uid-keyed note when uid is configured", () => {
        expect(readConversationId({ uid: "abc" }, "uid")).toBe("abc");
    });

    it("still reads a conversation_id note after switching to uid", () => {
        expect(readConversationId({ conversation_id: "abc" }, "uid")).toBe(
            "abc"
        );
    });

    it("keeps the chat id when a vault uid plugin also stamped the note", () => {
        // The regression this ordering exists for. An already-imported note
        // carries the real chat id under conversation_id; the vault's uid
        // plugin has added an unrelated random uid. Resolving to that uid
        // would lose every real id in the catalog and duplicate the library.
        expect(
            readConversationId(
                { conversation_id: "chat-abc", uid: "01a08344-vault-uid" },
                "uid"
            )
        ).toBe("chat-abc");
    });

    it("ignores a foreign uid when uid is not configured", () => {
        expect(readConversationId({ uid: "abc" }, undefined)).toBeNull();
    });

    it("accepts a numeric value", () => {
        // Obsidian's YAML cache parses an unquoted all-digit value as a
        // number; timestamp-shaped uids are common.
        expect(readConversationId({ uid: 20240115143022 }, "uid")).toBe(
            "20240115143022"
        );
        expect(readConversationId({ uid: Number.NaN }, "uid")).toBeNull();
    });

    it("ignores blank values and missing frontmatter", () => {
        expect(readConversationId({ uid: "   " }, "uid")).toBeNull();
        expect(readConversationId({}, "uid")).toBeNull();
        expect(readConversationId(null, "uid")).toBeNull();
    });

    it("trims surrounding whitespace", () => {
        expect(readConversationId({ uid: "  abc  " }, "uid")).toBe("abc");
    });
});

describe("reserved frontmatter keys", () => {
    it("refuses keys the note formatter already writes", () => {
        // Reusing one emits the key twice; Obsidian rejects duplicate mapping
        // keys, the note loses its frontmatter, and every import re-creates it.
        for (const reserved of [
            "nexus",
            "plugin_version",
            "provider",
            "aliases",
            "create_time",
            "update_time",
            "mode",
            "models",
        ]) {
            expect(isValidConversationIdField(reserved)).toBe(false);
            expect(resolveConversationIdField(reserved)).toBe(
                DEFAULT_CONVERSATION_ID_FIELD
            );
        }
    });

    it("still allows the default itself", () => {
        expect(isValidConversationIdField("conversation_id")).toBe(true);
        expect(resolveConversationIdField("conversation_id")).toBe(
            "conversation_id"
        );
    });
});
