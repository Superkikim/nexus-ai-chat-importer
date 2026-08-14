import { describe, expect, it } from "vitest";
import { createLibraryAttachment } from "./chatgpt-library-attachment";
import { ChatGPTLibraryEntry } from "./chatgpt-library-index";

function imageEntry(
    overrides: Partial<ChatGPTLibraryEntry> = {}
): ChatGPTLibraryEntry {
    return {
        fileId: "file_img_1",
        libraryFileId: "libfile_img_1",
        fileName: "Brain vs circuit symbol.png",
        mimeType: "image/png",
        fileSize: 96138,
        artifactType: "image",
        imageGenerationId: "gen-1",
        ...overrides,
    };
}

function documentEntry(
    overrides: Partial<ChatGPTLibraryEntry> = {}
): ChatGPTLibraryEntry {
    return {
        fileId: "file_doc_1",
        libraryFileId: "libfile_doc_1",
        fileName: "lettre_opposition_isabelle_bally.docx",
        mimeType:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        fileSize: 37768,
        artifactType: "report",
        ...overrides,
    };
}

describe("createLibraryAttachment", () => {
    it("builds a generated-image attachment with the DALL-E-compatible callout when a prompt is given", () => {
        const attachment = createLibraryAttachment(
            imageEntry(),
            "generated_image",
            "Draw a brain versus a circuit"
        );

        expect(attachment.attachmentType).toBe("generated_image");
        expect(attachment.generationPrompt).toBe(
            "Draw a brain versus a circuit"
        );
        expect(attachment.extractedContent).toContain(
            "[!nexus_prompt] **Image prompt**"
        );
        expect(attachment.extractedContent).toContain("{{FILENAME}}");
        expect(attachment.extractedContent).toContain("{{FILETYPE}}");
        expect(attachment.extractedContent).toContain("{{FILESIZE}}");
        expect(attachment.extractedContent).toContain("![[{{URL}}]]");
        // Prompt appears exactly once.
        expect(
            attachment.extractedContent!.split("Draw a brain versus a circuit")
                .length - 1
        ).toBe(1);
    });

    it("builds a generated-image attachment with no extractedContent when no prompt is available", () => {
        const attachment = createLibraryAttachment(
            imageEntry(),
            "generated_image"
        );

        expect(attachment.attachmentType).toBe("generated_image");
        expect(attachment.generationPrompt).toBeUndefined();
        expect(attachment.extractedContent).toBeUndefined();
        // Falls through to the shared generic-attachment formatter, which
        // still embeds the image because fileType is image/*.
        expect(attachment.fileType).toBe("image/png");
    });

    it("builds a generated-document attachment with no extractedContent (name/link via shared formatter)", () => {
        const attachment = createLibraryAttachment(
            documentEntry(),
            "generated_document"
        );

        expect(attachment.attachmentType).toBeUndefined();
        expect(attachment.extractedContent).toBeUndefined();
        expect(attachment.fileName).toBe(
            "lettre_opposition_isabelle_bally.docx"
        );
    });

    it("never leaks library-internal identifiers into rendered text", () => {
        const attachment = createLibraryAttachment(
            imageEntry({ libraryFileId: "libfile_SECRET_INTERNAL" }),
            "generated_image",
            "a prompt"
        );

        const rendered = JSON.stringify({
            fileName: attachment.fileName,
            fileType: attachment.fileType,
            extractedContent: attachment.extractedContent,
            generationPrompt: attachment.generationPrompt,
        });
        expect(rendered).not.toContain("libfile_SECRET_INTERNAL");
        // The identifier is retained, but only in the non-rendered metadata
        // bucket used for deduplication.
        expect(
            (attachment.providerMetadata?.library as Record<string, unknown>)
                .libraryFileId
        ).toBe("libfile_SECRET_INTERNAL");
    });

    it("sanitizes invalid filesystem characters", () => {
        const attachment = createLibraryAttachment(
            imageEntry({ fileName: "weird:name/with*bad?chars<>.png" }),
            "generated_image"
        );

        expect(attachment.fileName).not.toMatch(/[<>:"/\\|?*]/);
    });

    it("strips a path-like prefix down to the base name", () => {
        const attachment = createLibraryAttachment(
            documentEntry({ fileName: "some/nested/path/report.docx" }),
            "generated_document"
        );

        expect(attachment.fileName).toBe("report.docx");
    });

    it("preserves long file names rather than truncating (matches existing attachment behavior)", () => {
        const longBase = "a".repeat(200);
        const attachment = createLibraryAttachment(
            documentEntry({ fileName: `${longBase}.docx` }),
            "generated_document"
        );

        expect(attachment.fileName).toBe(`${longBase}.docx`);
    });

    it("falls back to application/octet-stream when the export provides no MIME type", () => {
        const attachment = createLibraryAttachment(
            documentEntry({ mimeType: undefined }),
            "generated_document"
        );

        expect(attachment.fileType).toBe("application/octet-stream");
    });

    it("omits fileSize when the export does not report one", () => {
        const attachment = createLibraryAttachment(
            documentEntry({ fileSize: undefined }),
            "generated_document"
        );

        expect(attachment.fileSize).toBeUndefined();
    });

    it("carries fileId through for extraction and deduplication", () => {
        const attachment = createLibraryAttachment(
            imageEntry(),
            "generated_image"
        );

        expect(attachment.fileId).toBe("file_img_1");
    });
});
