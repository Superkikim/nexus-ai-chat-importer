import { describe, expect, it } from "vitest";
import { ChatGPTConverter } from "./chatgpt-converter";
import { Chat, ChatMessage } from "./chatgpt-types";

function createChat(messages: Record<string, ChatMessage>): Chat {
    const mapping: Chat["mapping"] = {};
    for (const [id, message] of Object.entries(messages)) {
        mapping[id] = { id, message };
    }
    return {
        id: "conv-1",
        title: "Test",
        create_time: 1700000000,
        update_time: 1700000100,
        mapping,
    };
}

function userMessage(overrides: Partial<ChatMessage>): ChatMessage {
    return {
        id: "msg-1",
        author: { role: "user" },
        content: { parts: ["Hello"] },
        create_time: 1700000000,
        ...overrides,
    };
}

describe("ChatGPTConverter — metadata.attachments", () => {
    it("converts metadata.attachments entries with fileId and original name", () => {
        const chat = createChat({
            "msg-1": userMessage({
                metadata: {
                    attachments: [
                        {
                            id: "file_000000009b8c71f4ace00c77fc58413d",
                            name: "isa0001.ocr.pdf",
                            size: 2312956,
                            mime_type: "application/pdf",
                        },
                    ],
                },
            }),
        });

        const conversation = ChatGPTConverter.convertChat(chat);
        const attachments = conversation.messages[0].attachments!;
        expect(attachments).toHaveLength(1);
        expect(attachments[0].fileId).toBe(
            "file_000000009b8c71f4ace00c77fc58413d"
        );
        expect(attachments[0].fileName).toBe("isa0001.ocr.pdf");
        expect(attachments[0].fileType).toBe("application/pdf");
        expect(attachments[0].fileSize).toBe(2312956);
    });

    it("merges metadata.attachments with image_asset_pointer parts by fileId, restoring the original name", () => {
        const chat = createChat({
            "msg-1": userMessage({
                content: {
                    parts: [
                        "Look at this",
                        {
                            content_type: "image_asset_pointer",
                            asset_pointer:
                                "sediment://file_00000000aad871f49969859f2bccd6cb",
                            size_bytes: 4912448,
                            width: 2048,
                            height: 1612,
                            metadata: { dalle: null },
                        },
                    ],
                },
                metadata: {
                    attachments: [
                        {
                            id: "file_00000000aad871f49969859f2bccd6cb",
                            name: "IMG_8916.jpeg",
                            size: 4912448,
                            mime_type: "image/jpeg",
                        },
                    ],
                },
            }),
        });

        const conversation = ChatGPTConverter.convertChat(chat);
        const attachments = conversation.messages[0].attachments!;
        expect(attachments).toHaveLength(1);
        expect(attachments[0].fileId).toBe(
            "file_00000000aad871f49969859f2bccd6cb"
        );
        expect(attachments[0].fileName).toBe("IMG_8916.jpeg");
        expect(attachments[0].fileType).toBe("image/jpeg");
    });

    it("still converts legacy top-level attachments without duplicating", () => {
        const chat = createChat({
            "msg-1": userMessage({
                attachments: [
                    {
                        file_name: "notes.txt",
                        file_size: 120,
                        file_type: "text/plain",
                    },
                    {
                        file_name: "notes.txt",
                        file_size: 120,
                        file_type: "text/plain",
                    },
                ],
            }),
        });

        const conversation = ChatGPTConverter.convertChat(chat);
        const attachments = conversation.messages[0].attachments!;
        expect(attachments).toHaveLength(1);
        expect(attachments[0].fileName).toBe("notes.txt");
        expect(attachments[0].fileId).toBeUndefined();
    });

    it("keeps image_asset_pointer attachments when metadata.attachments is absent", () => {
        const chat = createChat({
            "msg-1": userMessage({
                content: {
                    parts: [
                        "Image only",
                        {
                            content_type: "image_asset_pointer",
                            asset_pointer:
                                "file-service://file-83uoDujiEuCv4tU8vsN3y1",
                            size_bytes: 2432508,
                            width: 1152,
                            height: 2048,
                        },
                    ],
                },
            }),
        });

        const conversation = ChatGPTConverter.convertChat(chat);
        const attachments = conversation.messages[0].attachments!;
        expect(attachments).toHaveLength(1);
        expect(attachments[0].fileId).toBe("file-83uoDujiEuCv4tU8vsN3y1");
        expect(attachments[0].fileName).toBe(
            "image_file-83uoDujiEuCv4tU8vsN3y1_1152x2048.png"
        );
    });
});
