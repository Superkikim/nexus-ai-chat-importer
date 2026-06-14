import { describe, expect, it } from "vitest";
import { transformCanvasDirectives } from "./chatgpt-canvas-directives";

describe("transformCanvasDirectives", () => {
    it("returns text unchanged when there is no directive", () => {
        const text = "Just a normal paragraph with no canvas content.";
        expect(transformCanvasDirectives(text)).toBe(text);
    });

    it("converts a social_post directive into a collapsible callout", () => {
        const input = [
            "Voici une version :",
            "",
            ':::writing{variant="social_post" id="58142"}',
            "Line one",
            "Line two",
            ":::",
            "",
            "Fin.",
        ].join("\n");

        const out = transformCanvasDirectives(input);
        expect(out).toContain(">[!nexus_canvas]- **Social post**");
        expect(out).toContain("> Line one");
        expect(out).toContain("> Line two");
        // Raw directive syntax must not survive.
        expect(out).not.toContain(":::writing");
        expect(out).not.toMatch(/^:::$/m);
        // Surrounding text preserved.
        expect(out).toContain("Voici une version :");
        expect(out).toContain("Fin.");
    });

    it("maps each known variant to its label", () => {
        const variants: Array<[string, string]> = [
            ["document", "Document"],
            ["standard", "Draft"],
            ["social_post", "Social post"],
        ];
        for (const [variant, label] of variants) {
            const input = `:::writing{variant="${variant}" id="1"}\nbody\n:::`;
            expect(transformCanvasDirectives(input)).toContain(
                `>[!nexus_canvas]- **${label}**`
            );
        }
    });

    it("includes the subject for email variants", () => {
        const input = ':::writing{variant="email" id="9" subject="Succession Bally"}\nBonjour\n:::';
        expect(transformCanvasDirectives(input)).toContain(
            ">[!nexus_canvas]- **Email — Succession Bally**"
        );
    });

    it("falls back to a generic Canvas label for unknown variants", () => {
        const input = ':::writing{variant="mystery" id="1"}\nbody\n:::';
        expect(transformCanvasDirectives(input)).toContain(
            ">[!nexus_canvas]- **Canvas**"
        );
    });

    it("handles multiple directives in one string", () => {
        const input = [
            ':::writing{variant="document" id="1"}',
            "doc body",
            ":::",
            "between",
            ':::writing{variant="social_post" id="2"}',
            "post body",
            ":::",
        ].join("\n");

        const out = transformCanvasDirectives(input);
        expect(out).toContain(">[!nexus_canvas]- **Document**");
        expect(out).toContain("> doc body");
        expect(out).toContain("between");
        expect(out).toContain(">[!nexus_canvas]- **Social post**");
        expect(out).toContain("> post body");
        expect(out).not.toContain(":::");
    });

    it("preserves blank lines inside the body with a quote prefix", () => {
        const input = ':::writing{variant="document" id="1"}\npara one\n\npara two\n:::';
        const out = transformCanvasDirectives(input);
        const lines = out.split("\n");
        // The blank body line becomes a lone ">" so the nested callout stays open.
        expect(lines).toContain(">");
        expect(out).toContain("> para one");
        expect(out).toContain("> para two");
    });

    it("tolerates an unterminated directive (keeps body, drops opener)", () => {
        const input = ':::writing{variant="document" id="1"}\nstill writing\nmore text';
        const out = transformCanvasDirectives(input);
        expect(out).toContain(">[!nexus_canvas]- **Document**");
        expect(out).toContain("> still writing");
        expect(out).toContain("> more text");
        expect(out).not.toContain(":::writing");
    });
});
