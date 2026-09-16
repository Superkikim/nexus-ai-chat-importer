import { describe, expect, it } from "vitest";
import {
    hasWikilinkStructuralChars,
    substituteWikilinkStructuralChars,
} from "./wikilink-safe-name";

describe("substituteWikilinkStructuralChars", () => {
    it("substitutes # with the fullwidth number sign", () => {
        expect(substituteWikilinkStructuralChars("C#")).toBe("C＃");
        expect(substituteWikilinkStructuralChars("Issue #42")).toBe(
            "Issue ＃42"
        );
    });

    it("substitutes ^ with a hyphen", () => {
        expect(substituteWikilinkStructuralChars("Rewrite ^v2")).toBe(
            "Rewrite -v2"
        );
    });

    it("substitutes [ and ] with parentheses", () => {
        expect(substituteWikilinkStructuralChars("Draft [WIP] Notes")).toBe(
            "Draft (WIP) Notes"
        );
    });

    it("substitutes all four characters in one pass", () => {
        expect(substituteWikilinkStructuralChars("C# [draft] ^v2")).toBe(
            "C＃ (draft) -v2"
        );
    });

    it("leaves an unaffected name unchanged", () => {
        expect(substituteWikilinkStructuralChars("STR to JSON Parser")).toBe(
            "STR to JSON Parser"
        );
    });

    it("is idempotent — running it twice matches running it once", () => {
        const once = substituteWikilinkStructuralChars("C# [draft] ^v2");
        expect(substituteWikilinkStructuralChars(once)).toBe(once);
    });

    it("preserves non-Latin titles untouched", () => {
        expect(substituteWikilinkStructuralChars("Привет мир")).toBe(
            "Привет мир"
        );
    });
});

describe("hasWikilinkStructuralChars", () => {
    it("detects each of the four characters", () => {
        expect(hasWikilinkStructuralChars("C#")).toBe(true);
        expect(hasWikilinkStructuralChars("Rewrite ^v2")).toBe(true);
        expect(hasWikilinkStructuralChars("Draft [WIP]")).toBe(true);
        expect(hasWikilinkStructuralChars("Draft ] only")).toBe(true);
    });

    it("returns false for an unaffected name", () => {
        expect(hasWikilinkStructuralChars("STR to JSON Parser")).toBe(false);
    });

    it("returns false once a name has already been substituted", () => {
        const fixed = substituteWikilinkStructuralChars("C# [draft]");
        expect(hasWikilinkStructuralChars(fixed)).toBe(false);
    });

    it("does not false-positive on the substitute characters themselves", () => {
        expect(hasWikilinkStructuralChars("C＃ (draft) -v2")).toBe(false);
    });

    // Regression guard: a stray regex with the "g" flag carries lastIndex
    // state across calls unless reset, which can make alternating calls
    // silently skip a match.
    it("gives a consistent answer across repeated calls on the same input", () => {
        expect(hasWikilinkStructuralChars("C#")).toBe(true);
        expect(hasWikilinkStructuralChars("C#")).toBe(true);
        expect(hasWikilinkStructuralChars("C#")).toBe(true);
    });
});
