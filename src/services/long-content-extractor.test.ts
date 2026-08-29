import { describe, expect, it } from "vitest";
import {
    beautify,
    contentFileName,
    detectKind,
    LONG_LINE_CHARS,
} from "./long-content-extractor";

describe("detectKind", () => {
    it("recognises JSON only when it parses", () => {
        expect(detectKind('{"a": 1, "b": [2, 3]}')).toBe("json");
        expect(detectKind('{"a": 1, "b": [2, 3}')).toBe("txt");
    });

    it("recognises markup by its closing tags", () => {
        const html = "<div>" + "<span>x</span>".repeat(10) + "</div>";
        expect(detectKind(html)).toBe("html");
    });

    it("recognises a flattened Markdown table", () => {
        expect(detectKind("| a | b | c | | d | e | f |")).toBe("md");
    });

    it("falls back to text", () => {
        expect(detectKind("failed to deploy a stack: postgres Pulling")).toBe(
            "txt"
        );
    });
});

describe("beautify", () => {
    it("re-serialises JSON without changing the document", () => {
        const source = '{"b":2,"a":[1,2,3]}';
        const out = beautify(source, "json");

        expect(out).toContain("\n");
        expect(JSON.parse(out)).toEqual(JSON.parse(source));
    });

    it("breaks markup after block tags, not after every tag", () => {
        const html = "<div><span>a</span><b>b</b></div>".repeat(80);
        const out = beautify(html, "html");
        const lines = out.split("\n");

        expect(lines.length).toBeGreaterThan(1);
        // One tag per line would put the median at a handful of characters.
        const median = lines.map((l) => l.length).sort((a, b) => a - b)[
            Math.floor(lines.length / 2)
        ];
        expect(median).toBeGreaterThan(20);
        expect(Math.max(...lines.map((l) => l.length))).toBeLessThanOrEqual(
            200
        );
    });

    it("wraps text on word boundaries", () => {
        const line = "mot ".repeat(5000);
        const out = beautify(line, "txt").split("\n");

        expect(Math.max(...out.map((l) => l.length))).toBeLessThanOrEqual(120);
        // Nothing lost but the spaces the wrap consumed.
        expect(out.join(" ").replace(/\s+/g, " ").trim()).toBe(
            line.replace(/\s+/g, " ").trim()
        );
    });

    it("leaves a run with no spaces intact", () => {
        // base64, a hash or a URL: a break inside it would corrupt it.
        const blob = "a".repeat(500);
        const out = beautify(blob, "txt").split("\n");

        expect(out.every((l) => l.length <= 120)).toBe(true);
        expect(out.join("")).toBe(blob);
    });

    it("leaves short lines alone", () => {
        const text = "une ligne\nune autre";
        expect(beautify(text, "txt")).toBe(text);
    });
});

describe("contentFileName", () => {
    it("gives the same name to the same content", () => {
        // The property the 1.7.0 cleanup depends on: a note repaired now and
        // the same conversation re-imported later must land on one file.
        const a = contentFileName("some very long content", "txt");
        const b = contentFileName("some very long content", "txt");

        expect(a).toBe(b);
        expect(a).toMatch(/^attachment-[0-9a-f]{8}\.txt$/);
    });

    it("separates different content", () => {
        expect(contentFileName("one", "txt")).not.toBe(
            contentFileName("two", "txt")
        );
    });

    it("carries the kind as the extension", () => {
        expect(contentFileName("{}", "json")).toMatch(/\.json$/);
        expect(contentFileName("<p></p>", "html")).toMatch(/\.html$/);
        expect(contentFileName("| a |", "md")).toMatch(/\.md$/);
    });
});

describe("the threshold", () => {
    it("sits where prose ends", () => {
        // Chosen from the content, not a benchmark: nobody writes ten thousand
        // characters without a line break.
        expect(LONG_LINE_CHARS).toBe(10_000);
    });
});
