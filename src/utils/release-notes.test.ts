import { describe, expect, it } from "vitest";
import { extractReleaseNotesSection } from "./release-notes";

const NOTES = `# Release Notes for Nexus AI Chat Importer

## Version 1.7.0 — ChatGPT images, selective import rebuilt

![Version](https://img.shields.io/badge/version-1.7.0-blue) ![Feature](https://img.shields.io/badge/type-feature-green)

### ✨ New

- A thing.

### 🐛 Fixed

- Another thing.

## Version 1.6.9 — Claude Split Export Detection

![Version](https://img.shields.io/badge/version-1.6.9-blue)

### 🐛 Fixed

- Old thing.
`;

describe("extractReleaseNotesSection", () => {
    it("returns the section body without heading or badge line", () => {
        const out = extractReleaseNotesSection(NOTES, "1.7.0");
        expect(out).not.toBeNull();
        expect(out).toMatch(/^### ✨ New/);
        expect(out).toContain("- A thing.");
        expect(out).toContain("- Another thing.");
        expect(out).not.toContain("shields.io");
        expect(out).not.toContain("## Version 1.7.0");
    });

    it("stops at the next version heading", () => {
        const out = extractReleaseNotesSection(NOTES, "1.7.0");
        expect(out).not.toContain("Old thing.");
        expect(out).not.toContain("1.6.9");
    });

    it("resolves an earlier version too", () => {
        const out = extractReleaseNotesSection(NOTES, "1.6.9");
        expect(out).toContain("- Old thing.");
        expect(out).not.toContain("- A thing.");
    });

    it("returns null for a version that is not in the notes", () => {
        expect(extractReleaseNotesSection(NOTES, "9.9.9")).toBeNull();
    });

    it("does not treat a dot as a wildcard", () => {
        // "1x7x0" must not match "1.7.0"
        expect(extractReleaseNotesSection(NOTES, "1x7x0")).toBeNull();
    });
});
