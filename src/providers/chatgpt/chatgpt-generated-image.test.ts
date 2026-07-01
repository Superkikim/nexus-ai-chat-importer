import { describe, expect, it } from "vitest";
import {
    annotateMissingGeneratedImages,
    createMissingGeneratedImageAttachment,
    hasStructuredGeneratedImage,
    isAssistantImageClaim,
    isImageGenerationRequest,
} from "./chatgpt-generated-image";
import { Chat } from "./chatgpt-types";
import { StandardMessage } from "../../types/standard";

const emptyChat = { id: "c1", mapping: {} } as unknown as Chat;

function userMsg(id: string, content: string, ts = 1): StandardMessage {
    return { id, role: "user", content, timestamp: ts, attachments: [] };
}
function assistantMsg(
    id: string,
    content: string,
    ts = 2,
    attachments: StandardMessage["attachments"] = []
): StandardMessage {
    return { id, role: "assistant", content, timestamp: ts, attachments };
}

describe("generation cue detection", () => {
    it("detects user image-generation requests (FR/EN)", () => {
        expect(
            isImageGenerationRequest(
                "Génère une image humoristique pour LinkedIn"
            )
        ).toBe(true);
        expect(isImageGenerationRequest("Crée une image sur ce modèle")).toBe(
            true
        );
        expect(isImageGenerationRequest("generate an image of a cat")).toBe(
            true
        );
        expect(isImageGenerationRequest("What is the capital of France?")).toBe(
            false
        );
    });

    it("detects assistant image claims", () => {
        expect(
            isAssistantImageClaim("L'image générée est au format PNG.")
        ).toBe(true);
        expect(isAssistantImageClaim("Voici ton image :")).toBe(true);
        expect(isAssistantImageClaim("Here's the image you asked for")).toBe(
            true
        );
        expect(isAssistantImageClaim("The capital is Paris.")).toBe(false);
    });
});

describe("annotateMissingGeneratedImages", () => {
    it("appends a placeholder to an assistant claim with no image (Sisyphus case)", () => {
        const messages = [
            userMsg(
                "u1",
                "Crée une représentation photoréaliste de sisyphe",
                1
            ),
            userMsg("u2", "C'est quel format ?", 2),
            assistantMsg("a1", "L'image générée est au format PNG.", 3),
        ];

        const out = annotateMissingGeneratedImages(messages, emptyChat);
        expect(out).toHaveLength(3);
        const placeholder = out[2].attachments?.[0];
        expect(placeholder?.attachmentType).toBe("generated_image");
        expect(placeholder?.status?.found).toBe(false);
        // Prompt is the generation-verb user message, not "C'est quel format ?"
        expect(placeholder?.generationPrompt).toContain("sisyphe");
    });

    it("synthesizes an assistant placeholder when no assistant turn survives (LinkedIn case)", () => {
        const messages = [
            userMsg(
                "u1",
                "Génère une image humoristique pour ce post LinkedIn",
                1
            ),
        ];

        const out = annotateMissingGeneratedImages(messages, emptyChat);
        expect(out).toHaveLength(2);
        expect(out[1].role).toBe("assistant");
        const placeholder = out[1].attachments?.[0];
        expect(placeholder?.attachmentType).toBe("generated_image");
        expect(placeholder?.generationPrompt).toContain("humoristique");
    });

    it("does not add a placeholder when an assistant image is present", () => {
        const messages = [
            userMsg("u1", "Génère une image de chat", 1),
            assistantMsg("a1", "Voici l'image", 2, [
                {
                    fileName: "cat.png",
                    fileType: "image/png",
                    status: { processed: true, found: true },
                },
            ]),
        ];
        const out = annotateMissingGeneratedImages(messages, emptyChat);
        expect(out).toHaveLength(2);
        expect(out[1].attachments).toHaveLength(1); // unchanged
    });

    it("does not fire on conversations with no generation intent", () => {
        const messages = [
            userMsg("u1", "What is 2 + 2?", 1),
            assistantMsg("a1", "It is 4.", 2),
        ];
        const out = annotateMissingGeneratedImages(messages, emptyChat);
        expect(out).toEqual(messages);
    });

    it("is a no-op when the conversation has structured generated-image data (legacy/no-regression)", () => {
        const legacyChat = {
            id: "c2",
            mapping: {
                node1: {
                    id: "node1",
                    message: {
                        id: "m1",
                        author: { role: "tool" },
                        content: {
                            content_type: "multimodal_text",
                            parts: [
                                {
                                    content_type: "image_asset_pointer",
                                    asset_pointer: "file-service://abc",
                                    metadata: { dalle: { gen_id: "g1" } },
                                },
                            ],
                        },
                    },
                },
            },
        } as unknown as Chat;

        // Even with an assistant claim and no StandardMessage image, the heuristic
        // must stay off because structured data exists.
        const messages = [
            userMsg("u1", "Génère une image", 1),
            assistantMsg("a1", "Voici l'image générée", 2),
        ];

        expect(hasStructuredGeneratedImage(legacyChat)).toBe(true);
        const out = annotateMissingGeneratedImages(messages, legacyChat);
        expect(out).toEqual(messages);
    });
});

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
});
