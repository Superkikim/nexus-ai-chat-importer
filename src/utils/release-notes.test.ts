import { describe, expect, it } from "vitest";
import { extractWhatsNewSection } from "./release-notes";

const README = `# Nexus AI Chat Importer

[![Obsidian](https://img.shields.io/badge/Obsidian-1.6.6+-purple)](https://obsidian.md/)

Import your AI chat exports into your Obsidian vault as plain Markdown.

## Features

- Something.

## What's new in 1.7.0

- **A headline.**
- **Another headline** with a bit of detail.

[Full release notes →](https://example.invalid/RELEASE_NOTES.md)

## Install

From Obsidian: …
`;

describe("extractWhatsNewSection", () => {
    it("returns the section body without its heading", () => {
        const out = extractWhatsNewSection(README);
        expect(out).not.toBeNull();
        expect(out).toMatch(/^- \*\*A headline\.\*\*/);
        expect(out).toContain("Another headline");
        expect(out).not.toContain("## What's new");
    });

    it("keeps the full-release-notes link", () => {
        expect(extractWhatsNewSection(README)).toContain(
            "[Full release notes →]"
        );
    });

    it("stops at the next heading", () => {
        const out = extractWhatsNewSection(README);
        expect(out).not.toContain("From Obsidian");
        expect(out).not.toContain("## Install");
    });

    it("does not pick up an earlier section", () => {
        expect(extractWhatsNewSection(README)).not.toContain("- Something.");
    });

    it("matches a heading with no version suffix", () => {
        const out = extractWhatsNewSection(
            "# T\n\n## What's new\n\n- Item.\n\n## Next\n"
        );
        expect(out).toBe("- Item.");
    });

    it("matches a typographic apostrophe", () => {
        const out = extractWhatsNewSection(
            "# T\n\n## What’s new in 2.0.0\n\n- Item.\n\n## Next\n"
        );
        expect(out).toBe("- Item.");
    });

    it("returns null when the section is absent", () => {
        expect(
            extractWhatsNewSection("# T\n\n## Features\n\n- Only this.\n")
        ).toBeNull();
    });

    it("returns null for an empty section", () => {
        expect(
            extractWhatsNewSection("# T\n\n## What's new\n\n## Install\n")
        ).toBeNull();
    });
});
