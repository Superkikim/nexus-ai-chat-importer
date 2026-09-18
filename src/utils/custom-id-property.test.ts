import { describe, expect, it } from "vitest";
import {
    NoteEditError,
    checkCustomIdPropertyName,
    customIdPropertyLine,
    removeCustomIdProperty,
    renameCustomIdProperty,
    resolveCustomIdProperty,
    setCustomIdProperty,
} from "./custom-id-property";

const ID = "6789abcd-0000-1111-2222-333344445555";

function note(...frontmatter: string[]): string {
    return [
        "---",
        "nexus: nexus-ai-chat-importer",
        'plugin_version: "1.7.1"',
        "provider: chatgpt",
        "aliases: [a, b]",
        `conversation_id: ${ID}`,
        "create_time: 2024-01-15T14:30:22.000Z",
        ...frontmatter,
        "---",
        "",
        "# Title: x",
        "",
    ].join("\n");
}

describe("checkCustomIdPropertyName", () => {
    it.each(["uid", "_id", "my-id", "Id_2", "  uid  "])("accepts %j", (n) => {
        expect(checkCustomIdPropertyName(n)).toEqual({
            valid: true,
            name: n.trim(),
        });
    });

    it.each(["", "2id", "-id", "my id", "id:", "é", "a.b", '"uid"'])(
        "rejects the format of %j",
        (n) => {
            expect(checkCustomIdPropertyName(n)).toEqual({
                valid: false,
                reason: "format",
            });
        }
    );

    it.each([
        "tags",
        "Tags",
        "ALIASES",
        "cssclasses",
        "tag",
        "Alias",
        "cssClass",
        "publish",
        "Permalink",
        "description",
        "IMAGE",
        "cover",
        "nexus",
        "Plugin_Version",
        "provider",
        "conversation_id",
        "CONVERSATION_ID",
        "create_time",
        "update_time",
        "Mode",
        "models",
    ])("rejects the reserved name %j", (n) => {
        expect(checkCustomIdPropertyName(n)).toEqual({
            valid: false,
            reason: "reserved",
        });
    });

    it("resolves an empty or invalid setting to off", () => {
        expect(resolveCustomIdProperty("")).toBeNull();
        expect(resolveCustomIdProperty(undefined)).toBeNull();
        expect(resolveCustomIdProperty("tags")).toBeNull();
        expect(resolveCustomIdProperty(" uid ")).toBe("uid");
    });

    it("builds the formatter line", () => {
        expect(customIdPropertyLine("uid", ID)).toBe(`uid: ${ID}\n`);
        expect(customIdPropertyLine(null, ID)).toBe("");
    });
});

describe("setCustomIdProperty", () => {
    it("adds the property right after conversation_id", () => {
        const result = setCustomIdProperty(note(), "uid", false);
        expect(result.outcome).toBe("added");
        expect(result.content).toBe(
            note().replace(
                `conversation_id: ${ID}\n`,
                `conversation_id: ${ID}\nuid: ${ID}\n`
            )
        );
    });

    it("leaves every other line byte for byte", () => {
        const content = note(
            "# a YAML comment",
            "single: 'single quoted'",
            "num: 007",
            "multi: |",
            "  line one",
            "  line two"
        );
        const result = setCustomIdProperty(content, "uid", false);
        const removedAgain = result.content.replace(`uid: ${ID}\n`, "");
        expect(removedAgain).toBe(content);
    });

    it("skips a property that already holds the ID, whatever the toggle", () => {
        const content = note(`uid: ${ID}`);
        expect(setCustomIdProperty(content, "uid", false)).toEqual({
            content,
            outcome: "skipped",
        });
        expect(setCustomIdProperty(content, "uid", true)).toEqual({
            content,
            outcome: "skipped",
        });
    });

    it("treats a quoted copy of the ID as the same value", () => {
        const content = note(`uid: "${ID}"`);
        expect(setCustomIdProperty(content, "uid", true).outcome).toBe(
            "skipped"
        );
    });

    it("leaves a different value alone with overwrite off", () => {
        const content = note("uid: 20240115143022");
        expect(setCustomIdProperty(content, "uid", false)).toEqual({
            content,
            outcome: "skipped",
        });
    });

    it("replaces a different value with overwrite on", () => {
        const content = note("uid: 20240115143022");
        const result = setCustomIdProperty(content, "uid", true);
        expect(result.outcome).toBe("overwritten");
        expect(result.content).toBe(note(`uid: ${ID}`));
    });

    it("replaces a quoted value", () => {
        const result = setCustomIdProperty(note('uid: "abc"'), "uid", true);
        expect(result.content).toBe(note(`uid: ${ID}`));
    });

    it("replaces a list value and all its lines", () => {
        const content = note("uid:", "  - a", "  - b", "other: x");
        const result = setCustomIdProperty(content, "uid", true);
        expect(result.outcome).toBe("overwritten");
        expect(result.content).toBe(note(`uid: ${ID}`, "other: x"));
    });

    it("replaces a column-0 sequence under its key", () => {
        const content = note("uid:", "- a", "- b", "other: x");
        const result = setCustomIdProperty(content, "uid", true);
        expect(result.content).toBe(note(`uid: ${ID}`, "other: x"));
    });

    it("replaces a multi-line value", () => {
        const content = note("uid: >", "  folded", "  text", "other: x");
        const result = setCustomIdProperty(content, "uid", true);
        expect(result.content).toBe(note(`uid: ${ID}`, "other: x"));
    });

    it("leaves a list value alone with overwrite off", () => {
        const content = note("uid:", "  - a");
        expect(setCustomIdProperty(content, "uid", false).outcome).toBe(
            "skipped"
        );
    });

    it("keeps CRLF line endings, including on the inserted line", () => {
        const crlf = note().replace(/\n/g, "\r\n");
        const result = setCustomIdProperty(crlf, "uid", false);
        expect(result.content).toBe(
            crlf.replace(
                `conversation_id: ${ID}\r\n`,
                `conversation_id: ${ID}\r\nuid: ${ID}\r\n`
            )
        );
        expect(result.content.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/);
    });

    it("keeps CRLF when overwriting", () => {
        const crlf = note("uid: old").replace(/\n/g, "\r\n");
        const result = setCustomIdProperty(crlf, "uid", true);
        expect(result.content).toBe(note(`uid: ${ID}`).replace(/\n/g, "\r\n"));
    });

    it("copies the conversation_id value text as written", () => {
        const content = note().replace(
            `conversation_id: ${ID}`,
            `conversation_id: "${ID}"`
        );
        const result = setCustomIdProperty(content, "uid", false);
        expect(result.content).toContain(`uid: "${ID}"\n`);
    });

    it("does not mistake a longer key for the property", () => {
        const content = note("uid_old: x", "uidx: y");
        const result = setCustomIdProperty(content, "uid", false);
        expect(result.outcome).toBe("added");
    });

    it("recognises a quoted key", () => {
        const content = note('"uid": other');
        expect(setCustomIdProperty(content, "uid", false).outcome).toBe(
            "skipped"
        );
    });

    it("fails on a note with no frontmatter", () => {
        expect(() =>
            setCustomIdProperty("# Just text\n", "uid", false)
        ).toThrow(NoteEditError);
    });

    it("fails on unterminated frontmatter", () => {
        expect(() =>
            setCustomIdProperty(`---\nconversation_id: ${ID}\n`, "uid", false)
        ).toThrow(NoteEditError);
    });

    it("fails when conversation_id is missing", () => {
        expect(() =>
            setCustomIdProperty("---\nnexus: x\n---\n", "uid", false)
        ).toThrow(/conversation_id/);
    });

    it("does not touch the body", () => {
        const content = `${note()}uid: in the body\n`;
        const result = setCustomIdProperty(content, "uid", false);
        expect(result.outcome).toBe("added");
        expect(result.content.endsWith("uid: in the body\n")).toBe(true);
    });
});

describe("removeCustomIdProperty", () => {
    it("removes a plugin value in plugin-only mode", () => {
        const result = removeCustomIdProperty(
            note(`uid: ${ID}`, "other: x"),
            "uid",
            true
        );
        expect(result).toEqual({
            content: note("other: x"),
            outcome: "removed",
        });
    });

    it("keeps a foreign value in plugin-only mode", () => {
        const content = note("uid: 42");
        expect(removeCustomIdProperty(content, "uid", true)).toEqual({
            content,
            outcome: "skipped",
        });
    });

    it("removes any value, lists included, in all-notes mode", () => {
        const result = removeCustomIdProperty(
            note("uid:", "  - a", "other: x"),
            "uid",
            false
        );
        expect(result).toEqual({
            content: note("other: x"),
            outcome: "removed",
        });
    });

    it("skips a note without the property", () => {
        const content = note();
        expect(removeCustomIdProperty(content, "uid", false)).toEqual({
            content,
            outcome: "skipped",
        });
    });

    it("keeps CRLF", () => {
        const crlf = note(`uid: ${ID}`).replace(/\n/g, "\r\n");
        expect(removeCustomIdProperty(crlf, "uid", true).content).toBe(
            note().replace(/\n/g, "\r\n")
        );
    });
});

describe("renameCustomIdProperty", () => {
    it("renames a plugin value in place of the old one", () => {
        const result = renameCustomIdProperty(
            note(`uid: ${ID}`),
            "uid",
            "note_id",
            false
        );
        expect(result).toEqual({
            content: note().replace(
                `conversation_id: ${ID}\n`,
                `conversation_id: ${ID}\nnote_id: ${ID}\n`
            ),
            outcome: "renamed",
        });
    });

    it("keeps a foreign value under the old name and adds the new one", () => {
        const result = renameCustomIdProperty(
            note("uid: 42"),
            "uid",
            "note_id",
            false
        );
        expect(result.outcome).toBe("added");
        expect(result.content).toContain("uid: 42\n");
        expect(result.content).toContain(`note_id: ${ID}\n`);
    });

    it("leaves an existing new name alone with overwrite off", () => {
        const result = renameCustomIdProperty(
            note(`uid: ${ID}`, "note_id: mine"),
            "uid",
            "note_id",
            false
        );
        expect(result.content).toBe(note("note_id: mine"));
    });

    it("replaces an existing new name with overwrite on", () => {
        const result = renameCustomIdProperty(
            note(`uid: ${ID}`, "note_id: mine"),
            "uid",
            "note_id",
            true
        );
        expect(result).toEqual({
            content: note(`note_id: ${ID}`),
            outcome: "overwritten",
        });
    });

    it("adds the new name where the old one is missing", () => {
        const result = renameCustomIdProperty(note(), "uid", "note_id", false);
        expect(result.outcome).toBe("added");
        expect(result.content).toContain(`note_id: ${ID}\n`);
    });
});
