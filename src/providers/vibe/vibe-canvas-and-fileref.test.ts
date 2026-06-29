// SPDX-License-Identifier: GPL-3.0-or-later
//
// Tests for Vibe canvas rendering and file_reference attachment handling.

import { describe, it, expect } from "vitest";
import { MistralVibeConverter } from "./vibe-converter";
import { MistralVibeMessage } from "./vibe-types";

function makeMessage(
    overrides: Partial<MistralVibeMessage>
): MistralVibeMessage {
    return {
        id: "msg-1",
        version: 0,
        chatId: "chat-abc",
        content: "",
        contentChunks: null,
        role: "assistant",
        createdAt: "2026-01-01T00:00:00Z",
        reaction: "",
        reactionDetail: null,
        reactionComment: null,
        preference: null,
        preferenceOver: null,
        context: null,
        canvas: [],
        quotes: [],
        files: [],
        ...overrides,
    };
}

// Expose private methods via type cast for unit testing
const converter = MistralVibeConverter as unknown as {
    renderCanvasItems: (canvas: unknown[]) => string;
    extractFileReferenceAttachments: (msg: MistralVibeMessage) => unknown[];
    extractContent: (msg: MistralVibeMessage) => string;
};

describe("Vibe — canvas rendering", () => {
    it("returns empty string for empty canvas array", () => {
        expect(converter.renderCanvasItems([])).toBe("");
    });

    it("renders a text/markdown canvas item as a nexus_canvas callout", () => {
        const result = converter.renderCanvasItems([
            {
                type: "text/markdown",
                content: "# Hello\n\nWorld",
                title: "My doc",
            },
        ]);
        expect(result).toContain(">[!nexus_canvas]- **My doc**");
        expect(result).toContain("> # Hello");
        expect(result).toContain("> World");
        expect(result).not.toContain("```");
    });

    it("renders a slides canvas item wrapped in a code block", () => {
        const result = converter.renderCanvasItems([
            {
                type: "slides",
                content: "---\nmarp: true\n---\n\n# Slide 1",
                title: "My Presentation",
            },
        ]);
        expect(result).toContain(
            ">[!nexus_canvas]- **My Presentation *(presentation)***"
        );
        expect(result).toContain("> ```");
        expect(result).toContain("> ---");
        expect(result).toContain("> # Slide 1");
    });

    it("renders multiple canvas items separated by blank line", () => {
        const result = converter.renderCanvasItems([
            { type: "text/markdown", content: "A", title: "Doc A" },
            { type: "text/markdown", content: "B", title: "Doc B" },
        ]);
        expect(result).toContain("**Doc A**");
        expect(result).toContain("**Doc B**");
        expect(result.split("\n\n").length).toBeGreaterThanOrEqual(2);
    });

    it("uses 'Canvas' as fallback title when title is absent", () => {
        const result = converter.renderCanvasItems([
            { type: "text/markdown", content: "x" },
        ]);
        expect(result).toContain("**Canvas**");
    });

    it("appends canvas callouts to message content via extractContent", () => {
        const msg = makeMessage({
            contentChunks: [{ type: "text", text: "Here is the document:" }],
            canvas: [
                {
                    type: "text/markdown",
                    content: "## Summary",
                    title: "Summary",
                },
            ],
        });
        const content = converter.extractContent(msg);
        expect(content).toContain("Here is the document:");
        expect(content).toContain(">[!nexus_canvas]-");
        expect(content).toContain("## Summary");
    });
});

describe("Vibe — file_reference attachments", () => {
    it("creates a placeholder attachment for a file_reference chunk", () => {
        const msg = makeMessage({
            contentChunks: [
                {
                    type: "file_reference",
                    fileReference: "rapport.docx",
                    fileAlt: "Télécharger le rapport",
                    fileUrl: "https://example.com/rapport.docx",
                },
            ],
        });
        const atts = converter.extractFileReferenceAttachments(msg) as {
            fileName: string;
            fileType: string;
            extractedContent: string;
            status: { found: boolean };
        }[];
        expect(atts).toHaveLength(1);
        expect(atts[0].fileName).toBe("rapport.docx");
        expect(atts[0].fileType).toBe(
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        );
        expect(atts[0].status.found).toBe(false);
        expect(atts[0].extractedContent).toContain("Télécharger le rapport");
        expect(atts[0].extractedContent).toContain("nexus_attachment");
        expect(atts[0].extractedContent).toContain(
            "https://chat.mistral.ai/chat/chat-abc"
        );
    });

    it("uses fileName as display name when fileAlt is absent", () => {
        const msg = makeMessage({
            contentChunks: [
                {
                    type: "file_reference",
                    fileReference: "summary.pdf",
                },
            ],
        });
        const atts = converter.extractFileReferenceAttachments(msg) as {
            extractedContent: string;
        }[];
        expect(atts[0].extractedContent).toContain("summary.pdf");
    });

    it("returns empty array when no file_reference chunks", () => {
        const msg = makeMessage({
            contentChunks: [{ type: "text", text: "hello" }],
        });
        expect(converter.extractFileReferenceAttachments(msg)).toHaveLength(0);
    });

    it("canva chunks are skipped in processContentChunks (no text emitted)", () => {
        const msg = makeMessage({
            contentChunks: [
                { type: "text", text: "intro" },
                { type: "canva", id: "abc-123", version: 0 },
            ],
            canvas: [],
        });
        const content = converter.extractContent(msg);
        expect(content).toBe("intro");
        expect(content).not.toContain("abc-123");
    });
});
