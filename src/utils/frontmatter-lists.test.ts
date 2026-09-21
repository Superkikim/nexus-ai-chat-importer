import { describe, expect, it } from "vitest";
import { frontmatterListPattern, yamlListBlock } from "./frontmatter-lists";

describe("frontmatter lists", () => {
    it("writes a YAML list, or nothing at all", () => {
        expect(yamlListBlock("models", ["A", 'say "hi"'])).toBe(
            'models:\n  - "A"\n  - "say \\"hi\\""\n'
        );
        expect(yamlListBlock("models", [])).toBe("");
    });

    it("matches the whole list, and nothing after it", () => {
        const content = 'models:\n  - "A"\n  - "B"\nother: 1\n';

        expect(content.replace(frontmatterListPattern("models"), "")).toBe(
            "other: 1\n"
        );
    });

    it("leaves a field whose name only starts the same", () => {
        const content = 'models_used:\n  - "A"\n';

        expect(content.replace(frontmatterListPattern("models"), "")).toBe(
            content
        );
    });
});
