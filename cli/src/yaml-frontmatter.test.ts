/**
 * Tests for YAML frontmatter parsing in the CLI shim.
 * Verifies that the `yaml` package (replacing js-yaml) correctly parses
 * the YAML frontmatter format used by Obsidian notes.
 */
import { parse } from "yaml";
import { describe, it, expect } from "vitest";

describe("YAML frontmatter parsing (yaml package replacement for js-yaml)", () => {
    it("parses a simple string field", () => {
        const input = `title: My Conversation\nprovider: chatgpt`;
        const result = parse(input) as Record<string, unknown>;
        expect(result.title).toBe("My Conversation");
        expect(result.provider).toBe("chatgpt");
    });

    it("parses numeric and boolean fields", () => {
        const input = `count: 42\narchived: false`;
        const result = parse(input) as Record<string, unknown>;
        expect(result.count).toBe(42);
        expect(result.archived).toBe(false);
    });

    it("parses an ISO 8601 date string as a string (not a Date object)", () => {
        const input = `created: "2024-01-15T14:30:22.000Z"`;
        const result = parse(input) as Record<string, unknown>;
        expect(typeof result.created).toBe("string");
        expect(result.created).toBe("2024-01-15T14:30:22.000Z");
    });

    it("parses array fields", () => {
        const input = `tags:\n  - ai\n  - chatgpt\n  - import`;
        const result = parse(input) as Record<string, unknown>;
        expect(Array.isArray(result.tags)).toBe(true);
        expect(result.tags).toEqual(["ai", "chatgpt", "import"]);
    });

    it("parses nested objects", () => {
        const input = `metadata:\n  provider: chatgpt\n  version: 1`;
        const result = parse(input) as Record<string, unknown>;
        expect(result.metadata).toEqual({ provider: "chatgpt", version: 1 });
    });

    it("returns null for empty input", () => {
        const result = parse("");
        expect(result).toBeNull();
    });

    it("handles the frontmatter extraction regex pattern used in the shim", () => {
        const markdownFile = `---\ntitle: Test Note\nprovider: claude\n---\n\n# Content here`;
        const match = markdownFile.match(/^---\n([\s\S]*?)\n---/);
        expect(match).not.toBeNull();
        const frontmatter = parse(match![1]) as Record<string, unknown>;
        expect(frontmatter.title).toBe("Test Note");
        expect(frontmatter.provider).toBe("claude");
    });

    it("returns null when there is no frontmatter block", () => {
        const markdownFile = `# Just a heading\n\nNo frontmatter here.`;
        const match = markdownFile.match(/^---\n([\s\S]*?)\n---/);
        expect(match).toBeNull();
    });
});
