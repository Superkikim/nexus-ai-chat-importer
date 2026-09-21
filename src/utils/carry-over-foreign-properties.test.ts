import { describe, expect, it } from "vitest";
import { carryOverForeignProperties } from "./custom-id-property";

const rebuilt = [
    "---",
    "nexus: nexus-ai-chat-importer",
    'plugin_version: "1.8.0"',
    "provider: chatgpt",
    "aliases: New",
    "conversation_id: abc",
    "uid: abc",
    "create_time: 2024-01-15T14:30:22.000Z",
    "update_time: 2024-01-16T14:30:22.000Z",
    "---",
    "# Title: New",
    "",
].join("\n");

function old(...lines: string[]): string {
    return [
        "---",
        "nexus: nexus-ai-chat-importer",
        "provider: chatgpt",
        "aliases: Old",
        "conversation_id: abc",
        "uid: hand-edited",
        "mode: chat",
        "models:",
        '  - "gpt-4"',
        ...lines,
        "---",
        "# Title: Old body",
        "",
    ].join("\n");
}

describe("carryOverForeignProperties", () => {
    it("keeps a user property after the plugin's own", () => {
        const out = carryOverForeignProperties(
            old("status: done"),
            rebuilt,
            "uid"
        );
        expect(out).toBe(
            rebuilt.replace("---\n# Title", "status: done\n---\n# Title")
        );
    });

    it("regenerates plugin keys, custom ID included, and never duplicates them", () => {
        const out = carryOverForeignProperties(
            old("Nexus: x", "UID: y", "status: done"),
            rebuilt,
            "uid"
        );
        expect(out).not.toContain("Old");
        expect(out).not.toContain("hand-edited");
        expect(out).not.toContain("mode:");
        expect(out.match(/nexus:/gi)).toHaveLength(1);
        expect(out).toContain("uid: abc");
        expect(out).toContain("status: done");
    });

    it("keeps Obsidian properties such as tags", () => {
        const out = carryOverForeignProperties(
            old("tags:", "  - a", "  - b", "cssclasses: wide"),
            rebuilt,
            null
        );
        expect(out).toContain("tags:\n  - a\n  - b\ncssclasses: wide\n---");
    });

    it("keeps quoted, multi-line and commented values as written", () => {
        const out = carryOverForeignProperties(
            old(
                "code: '007'  # keep",
                'note: "a: b"',
                "summary: |",
                "  line one",
                "",
                "  line two",
                '"odd key": 1'
            ),
            rebuilt,
            null
        );
        expect(out).toContain(
            'code: \'007\'  # keep\nnote: "a: b"\nsummary: |\n  line one\n\n  line two\n"odd key": 1\n---'
        );
    });

    it("keeps a custom ID property that has since been renamed", () => {
        const out = carryOverForeignProperties(old(), rebuilt, "id2");
        expect(out).toContain("uid: hand-edited");
    });

    it("writes LF when the old note used CRLF", () => {
        const out = carryOverForeignProperties(
            old("status: done").replace(/\n/g, "\r\n"),
            rebuilt,
            "uid"
        );
        expect(out).toContain("status: done\n---");
        expect(out).not.toContain("\r");
    });

    it("returns the rebuilt note when there is nothing to carry or no frontmatter", () => {
        expect(carryOverForeignProperties(old(), rebuilt, "uid")).toBe(rebuilt);
        expect(carryOverForeignProperties("# body", rebuilt, "uid")).toBe(
            rebuilt
        );
    });
});
