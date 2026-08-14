import { describe, expect, it } from "vitest";
import { ConversationProcessor } from "./conversation-processor";
import { StandardMessage } from "../types/standard";

/**
 * Covers Phase 5 of the ChatGPT library-artifact work: a reconciled library
 * attachment (generated image or generated document) must be counted in the
 * standard "Extracted to vault" bucket like any other attachment, and never
 * double-counted, since it flows through the same AttachmentStatus the
 * shared extractor already produces for every attachment type.
 */

type ProcessorUnderTest = {
    calculateAttachmentStats: (messages: StandardMessage[]) => unknown;
};

function processor(): ProcessorUnderTest {
    return Object.create(ConversationProcessor.prototype) as ProcessorUnderTest;
}

describe("ConversationProcessor.calculateAttachmentStats with library artifacts", () => {
    it("counts an extracted generated image under the found (Extracted to vault) bucket", () => {
        const messages: StandardMessage[] = [
            {
                id: "m1",
                role: "assistant",
                content: "",
                timestamp: 1000,
                attachments: [
                    {
                        fileName: "Brain_vs_circuit_symbol.png",
                        fileType: "image/png",
                        fileId: "file_img_1",
                        attachmentType: "generated_image",
                        status: {
                            processed: true,
                            found: true,
                            localPath:
                                "attachments/chatgpt/images/Brain_vs_circuit_symbol.png",
                        },
                    },
                ],
            },
        ];

        const stats = processor().calculateAttachmentStats(messages) as {
            total: number;
            found: number;
            missing: number;
        };

        expect(stats.total).toBe(1);
        expect(stats.found).toBe(1);
        expect(stats.missing).toBe(0);
    });

    it("counts an extracted generated document under the same found bucket", () => {
        const messages: StandardMessage[] = [
            {
                id: "m1",
                role: "assistant",
                content: "Here is your document.",
                timestamp: 1000,
                attachments: [
                    {
                        fileName: "lettre_opposition_isabelle_bally.docx",
                        fileType:
                            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                        fileId: "file_doc_1",
                        status: {
                            processed: true,
                            found: true,
                            localPath:
                                "attachments/chatgpt/documents/lettre_opposition_isabelle_bally.docx",
                        },
                    },
                ],
            },
        ];

        const stats = processor().calculateAttachmentStats(messages) as {
            total: number;
            found: number;
        };

        expect(stats.total).toBe(1);
        expect(stats.found).toBe(1);
    });

    it("never double-counts a single library artifact even when it is the only attachment on a synthetic message", () => {
        const messages: StandardMessage[] = [
            {
                id: "m1",
                role: "user",
                content: "Draw a brain",
                timestamp: 1000,
            },
            {
                id: "nexus-library-artifact-omitted",
                role: "assistant",
                content: "",
                timestamp: 1001,
                attachments: [
                    {
                        fileName: "Brain_vs_circuit_symbol.png",
                        fileType: "image/png",
                        fileId: "file_img_1",
                        attachmentType: "generated_image",
                        status: {
                            processed: true,
                            found: true,
                            localPath:
                                "attachments/chatgpt/images/Brain_vs_circuit_symbol.png",
                        },
                    },
                ],
            },
        ];

        const stats = processor().calculateAttachmentStats(messages) as {
            total: number;
            found: number;
        };

        expect(stats.total).toBe(1);
        expect(stats.found).toBe(1);
    });

    it("counts a still-missing generated image under missing, not found", () => {
        const messages: StandardMessage[] = [
            {
                id: "m1",
                role: "assistant",
                content: "",
                timestamp: 1000,
                attachments: [
                    {
                        fileName: "generated_image_not_in_export.png",
                        fileType: "image/png",
                        attachmentType: "generated_image",
                        status: {
                            processed: true,
                            found: false,
                            reason: "not_in_export",
                        },
                    },
                ],
            },
        ];

        const stats = processor().calculateAttachmentStats(messages) as {
            total: number;
            found: number;
            notProvided: number;
        };

        expect(stats.total).toBe(1);
        expect(stats.found).toBe(0);
        expect(stats.notProvided).toBe(1);
    });

    it("counts a mix of a legacy upload, a generated image, and a generated document without cross-contamination", () => {
        const messages: StandardMessage[] = [
            {
                id: "m1",
                role: "user",
                content: "Here is my file",
                timestamp: 1000,
                attachments: [
                    {
                        fileName: "upload.pdf",
                        fileType: "application/pdf",
                        fileId: "file_upload",
                        status: {
                            processed: true,
                            found: true,
                            localPath:
                                "attachments/chatgpt/documents/upload.pdf",
                        },
                    },
                ],
            },
            {
                id: "m2",
                role: "assistant",
                content: "",
                timestamp: 1001,
                attachments: [
                    {
                        fileName: "Brain_vs_circuit_symbol.png",
                        fileType: "image/png",
                        fileId: "file_img_1",
                        attachmentType: "generated_image",
                        status: {
                            processed: true,
                            found: true,
                            localPath:
                                "attachments/chatgpt/images/Brain_vs_circuit_symbol.png",
                        },
                    },
                    {
                        fileName: "report.docx",
                        fileType:
                            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                        fileId: "file_doc_1",
                        status: {
                            processed: true,
                            found: true,
                            localPath:
                                "attachments/chatgpt/documents/report.docx",
                        },
                    },
                ],
            },
        ];

        const stats = processor().calculateAttachmentStats(messages) as {
            total: number;
            found: number;
        };

        expect(stats.total).toBe(3);
        expect(stats.found).toBe(3);
    });
});
