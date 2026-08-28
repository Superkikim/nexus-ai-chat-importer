import { describe, expect, it } from "vitest";
import { createLibraryAttachment } from "./chatgpt-library-attachment";
import { ChatGPTDalleProcessor } from "./chatgpt-dalle-processor";
import { ChatGPTLibraryEntry } from "./chatgpt-library-index";
import { StandardMessage } from "../../types/standard";

/**
 * End-to-end check that a library-sourced attachment renders through
 * MessageFormatter identically in shape to a legacy DALL-E attachment, and
 * that a generated document renders as a real-name Obsidian link with no
 * library-internal identifiers ever reaching the note text.
 */

async function createFormatter() {
    (window as unknown).moment = (value: number) => ({
        format: (pattern: string) => {
            if (pattern === "L") return "01/01/2024";
            if (pattern === "LTS") return "10:00:00";
            return String(value);
        },
    });

    const { MessageFormatter } = await import(
        "../../formatters/message-formatter"
    );
    const logger = { error: () => {} } as unknown;
    const plugin = {
        settings: {
            useCustomMessageTimestampFormat: false,
            messageTimestampFormat: "locale",
        },
    } as unknown;
    return new MessageFormatter(logger, plugin);
}

function libraryImageEntry(): ChatGPTLibraryEntry {
    return {
        fileId: "file_img_1",
        libraryFileId: "libfile_SECRET_internal_id",
        fileName: "Brain vs circuit symbol.png",
        mimeType: "image/png",
        fileSize: 96138,
        artifactType: "image",
        imageGenerationId: "gen-SECRET-internal-id",
    };
}

describe("library artifact rendering", () => {
    it("renders a generated image with the same shape as a legacy DALL-E image", async () => {
        const formatter = await createFormatter();

        // Legacy DALL-E path (existing, unmodified behavior).
        const dalleAttachment = ChatGPTDalleProcessor.createDalleAttachment(
            {
                asset_pointer: "file-service://legacy",
                width: 1024,
                height: 1024,
                metadata: { dalle: { gen_id: "legacy-gen" } },
            },
            "Draw a brain versus a circuit",
            true
        );
        // Simulate what the extractor does after a successful write.
        dalleAttachment.extractedContent = dalleAttachment
            .extractedContent!.replace("{{FILENAME}}", "dalle_legacy.png")
            .replace("{{FILETYPE}}", "image/png")
            .replace("{{FILESIZE}}", "94 KB")
            .replace("{{URL}}", "attachments/chatgpt/images/dalle_legacy.png");

        // New library path.
        const libraryAttachment = createLibraryAttachment(
            libraryImageEntry(),
            "generated_image",
            "Draw a brain versus a circuit"
        );
        libraryAttachment.extractedContent = libraryAttachment
            .extractedContent!.replace(
                "{{FILENAME}}",
                "Brain_vs_circuit_symbol.png"
            )
            .replace("{{FILETYPE}}", "image/png")
            .replace("{{FILESIZE}}", "94 KB")
            .replace(
                "{{URL}}",
                "attachments/chatgpt/images/Brain_vs_circuit_symbol.png"
            );

        const dalleMessage: StandardMessage = {
            id: "m-dalle",
            role: "assistant",
            content: "",
            timestamp: 1_700_000_000,
            attachments: [dalleAttachment],
        };
        const libraryMessage: StandardMessage = {
            id: "m-library",
            role: "assistant",
            content: "",
            timestamp: 1_700_000_000,
            attachments: [libraryAttachment],
        };

        const dalleRendered = formatter.formatMessage(dalleMessage);
        const libraryRendered = formatter.formatMessage(libraryMessage);

        // Same structural shape: one prompt callout, one attachment callout,
        // an embedded image link — for both pipelines.
        for (const rendered of [dalleRendered, libraryRendered]) {
            expect(rendered).toContain("[!nexus_prompt] **Image prompt**");
            expect(rendered).toContain("Draw a brain versus a circuit");
            expect(rendered).toContain("[!nexus_attachment]");
            expect(rendered).toMatch(/!\[\[attachments\/chatgpt\/images\//);
        }

        // No library-internal identifiers ever reach rendered text.
        expect(libraryRendered).not.toContain("libfile_SECRET_internal_id");
        expect(libraryRendered).not.toContain("gen-SECRET-internal-id");
    });

    it("renders a generated document with its real name and an Obsidian link, not an embed", async () => {
        const formatter = await createFormatter();

        const documentAttachment = createLibraryAttachment(
            {
                fileId: "file_doc_1",
                libraryFileId: "libfile_SECRET_doc_id",
                fileName: "lettre_opposition_isabelle_bally.docx",
                mimeType:
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                fileSize: 37768,
                artifactType: "report",
            },
            "generated_document"
        );
        // Simulate a successful extraction (as the shared extractor would do).
        documentAttachment.url =
            "attachments/chatgpt/documents/lettre_opposition_isabelle_bally.docx";
        documentAttachment.status = {
            processed: true,
            found: true,
            localPath: documentAttachment.url,
        };

        const message: StandardMessage = {
            id: "m-doc",
            role: "assistant",
            content: "Here is your document.",
            timestamp: 1_700_000_000,
            attachments: [documentAttachment],
        };

        const rendered = formatter.formatMessage(message);

        expect(rendered).toContain("lettre_opposition_isabelle_bally.docx");
        // Document: a link, never an embed.
        expect(rendered).toContain(
            "[[attachments/chatgpt/documents/lettre_opposition_isabelle_bally.docx]]"
        );
        expect(rendered).not.toContain(
            "![[attachments/chatgpt/documents/lettre_opposition_isabelle_bally.docx]]"
        );
        expect(rendered).not.toContain("libfile_SECRET_doc_id");
    });

    it("keeps the original-conversation fallback link when a library file could not be extracted", async () => {
        const formatter = await createFormatter();

        const attachment = createLibraryAttachment(
            libraryImageEntry(),
            "generated_image",
            "Draw a brain versus a circuit"
        );
        // Simulate the extractor's "missing_from_export" branch.
        delete attachment.extractedContent;
        attachment.url = "https://chatgpt.com/c/thread-1";
        attachment.status = {
            processed: true,
            found: false,
            reason: "missing_from_export",
        };

        const message: StandardMessage = {
            id: "m-missing",
            role: "assistant",
            content: "",
            timestamp: 1_700_000_000,
            attachments: [attachment],
        };

        const rendered = formatter.formatMessage(message);
        expect(rendered).toContain(
            "[Open original conversation](https://chatgpt.com/c/thread-1)"
        );
    });
});
