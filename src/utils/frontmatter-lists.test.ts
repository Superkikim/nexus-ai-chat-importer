import { describe, expect, it } from "vitest";
import {
    frontmatterListPattern,
    normalizeFrontmatterList,
    yamlListBlock,
} from "./frontmatter-lists";

describe("frontmatter lists", () => {
    it("accepts one value, several values, or nothing", () => {
        expect(normalizeFrontmatterList("CONCISE")).toEqual(["CONCISE"]);
        expect(normalizeFrontmatterList(["a", "b"])).toEqual(["a", "b"]);
        expect(normalizeFrontmatterList(undefined)).toEqual([]);
    });

    it("trims, drops empties, and keeps each value once", () => {
        expect(
            normalizeFrontmatterList([" a ", "", "a", 7, null, "b"])
        ).toEqual(["a", "b"]);
    });

    it("writes a YAML list, or nothing at all", () => {
        expect(yamlListBlock("mode", ["A", 'say "hi"'])).toBe(
            'mode:\n  - "A"\n  - "say \\"hi\\""\n'
        );
        expect(yamlListBlock("mode", [])).toBe("");
    });

    it("matches the field written as a list or as a single line", () => {
        const asList = 'mode:\n  - "A"\n  - "B"\nother: 1\n';
        const asLine = 'mode: "A"\nother: 1\n';

        expect(asList.replace(frontmatterListPattern("mode"), "")).toBe(
            "other: 1\n"
        );
        expect(asLine.replace(frontmatterListPattern("mode"), "")).toBe(
            "other: 1\n"
        );
    });

    it("leaves a field whose name only starts the same", () => {
        const content = 'models:\n  - "sonar"\n';

        expect(content.replace(frontmatterListPattern("mode"), "")).toBe(
            content
        );
    });
});
