import { describe, expect, it } from "vitest";
import { createMissingGeneratedImageAttachment } from "./generated-image-placeholder";

describe("createMissingGeneratedImageAttachment", () => {
    it("includes the prompt callout when a prompt is provided", () => {
        const att = createMissingGeneratedImageAttachment("a red bicycle");
        expect(att.extractedContent).toContain("**Image prompt**");
        expect(att.extractedContent).toContain("a red bicycle");
        expect(att.extractedContent).toContain(
            "**Generated image — not in export**"
        );
    });

    it("omits the prompt callout when no prompt is provided", () => {
        const att = createMissingGeneratedImageAttachment();
        expect(att.extractedContent).not.toContain("**Image prompt**");
        expect(att.extractedContent).toContain(
            "**Generated image — not in export**"
        );
    });

    it("links the original when a source URL is given", () => {
        const att = createMissingGeneratedImageAttachment("a cat", {
            sourceUrl: "https://example.com/post/1",
        });
        expect(att.extractedContent).toContain(
            ">> this export did not include the image [Open original](https://example.com/post/1)"
        );
    });

    it("adds no link without a source URL", () => {
        const att = createMissingGeneratedImageAttachment("a cat");
        expect(att.extractedContent).toMatch(
            />> this export did not include the image$/
        );
    });

    it("records the caller's note on the status", () => {
        const att = createMissingGeneratedImageAttachment("a cat", {
            note: "provider-specific reason",
        });
        expect(att.status).toEqual({
            processed: true,
            found: false,
            reason: "not_in_export",
            note: "provider-specific reason",
        });
    });
});
