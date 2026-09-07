import { describe, expect, it } from "vitest";
import { ChatGPTReportNamingStrategy } from "../providers/chatgpt/chatgpt-report-naming";
import { ClaudeReportNamingStrategy } from "../providers/claude/claude-report-naming";
import { PerplexityReportNamingStrategy } from "../providers/perplexity/perplexity-report-naming";
import { MistralVibeReportNamingStrategy } from "../providers/vibe/vibe-report-naming";

/**
 * The report column for attachment-based providers must reflect what landed in
 * the note, not what the raw export declared. Counting from the raw chat missed
 * every generated image reconciled from `library_files.json`, and would double
 * count a file described both by `metadata.attachments` and by an
 * `image_asset_pointer` part.
 */
describe("provider-specific report column", () => {
    it("marks ChatGPT and Mistral Vibe as counting imported attachments", () => {
        expect(
            new ChatGPTReportNamingStrategy().getProviderSpecificColumn()
                .countsImportedAttachments
        ).toBe(true);
        expect(
            new MistralVibeReportNamingStrategy().getProviderSpecificColumn()
                .countsImportedAttachments
        ).toBe(true);
    });

    it("leaves columns with other semantics alone", () => {
        const claude =
            new ClaudeReportNamingStrategy().getProviderSpecificColumn();
        const perplexity =
            new PerplexityReportNamingStrategy().getProviderSpecificColumn();

        expect(claude.header).toBe("Artifacts");
        expect(claude.countsImportedAttachments).toBeFalsy();
        expect(perplexity.header).toBe("Turns");
        expect(perplexity.countsImportedAttachments).toBeFalsy();
    });

    it("keeps the raw ChatGPT counter blind to reconciled files", () => {
        // Reproduces conversation 6a7acba4: seven uploads described by both
        // metadata.attachments and image_asset_pointer parts, plus generated
        // images that exist only in the library index. The raw counter sees 7
        // where the note holds 44 — which is why the column no longer uses it.
        const asset = {
            content_type: "image_asset_pointer",
            asset_pointer: "sediment://file_0001",
            metadata: { dalle: null },
        };
        const chat = {
            mapping: {
                n1: {
                    message: {
                        metadata: { attachments: [{ id: "file_0001" }] },
                        content: { parts: [asset] },
                    },
                },
            },
        };

        const column =
            new ChatGPTReportNamingStrategy().getProviderSpecificColumn();
        expect(column.getValue(undefined, chat)).toBe(1);
        expect(column.countsImportedAttachments).toBe(true);
    });
});
