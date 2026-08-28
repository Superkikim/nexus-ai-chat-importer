import fs from "fs";
import path from "path";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { ConversationMetadataExtractor } from "../../services/conversation-metadata-extractor";
import { DefaultProviderRegistry } from "../provider-adapter";
import { ClaudeAdapter } from "./claude-adapter";
import { ClaudeConverter } from "./claude-converter";
import { isExportableClaudeMessage } from "./claude-message-filter";
import { ClaudeConversation, ClaudeMessage } from "./claude-types";

const archivePath = path.resolve(
    "local_resources/claude/data-bfdaffc3-9060-4687-90a1-31edfd5d57c2-1785757653-d96eb9c7-batch-0000.zip"
);
const sandboxConversationsPath = path.resolve(
    "local_resources/claude/claude_sandbox/conversations.json"
);

const ghostConversationIds = [
    "7a34106c-5130-4624-bb5d-6df555802f61",
    "3692d43e-0117-4435-be46-7efea8d08570",
    "8789921d-add2-4702-981c-545e30eabeca",
    "04df6430-5213-495c-8b0b-4da0f1b5629e",
    "5cdf6817-ebd0-4518-bfa4-1687188f9983",
    "722458e5-8d5f-42e2-8d7f-919049bdcc46",
    "f9f15f08-0cbd-4227-b58c-22ec1ebde879",
    "5c270ced-641e-4702-80ea-98e257d712bb",
    "b626f1bf-9153-437f-ac81-7bcb58097e11",
];

function createTestPlugin() {
    const logger = {
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: () => {},
        child: () => logger,
    };
    return { logger } as unknown;
}

function message(overrides: Partial<ClaudeMessage>): ClaudeMessage {
    return {
        uuid: "msg-1",
        sender: "human",
        text: "",
        created_at: "2024-01-01T00:00:00.000Z",
        content: [],
        attachments: [],
        files: [],
        ...overrides,
    };
}

function conversation(
    chatMessages: ClaudeMessage[],
    overrides: Partial<ClaudeConversation> = {}
): ClaudeConversation {
    return {
        uuid: "conv-1",
        name: "Claude exportability",
        created_at: "2024-01-01T00:00:00.000Z",
        updated_at: "2024-01-01T01:00:00.000Z",
        chat_messages: chatMessages,
        ...overrides,
    } as ClaudeConversation;
}

describe("Claude message exportability", () => {
    it("includes a message with text", () => {
        expect(isExportableClaudeMessage(message({ text: "Hello" }))).toBe(
            true
        );
    });

    it("includes a message with a content block", () => {
        expect(
            isExportableClaudeMessage(
                message({
                    content: [
                        {
                            type: "text",
                            text: "Hello from a block",
                        } as unknown,
                    ],
                })
            )
        ).toBe(true);
    });

    it("excludes an empty text content block", () => {
        expect(
            isExportableClaudeMessage(
                message({
                    content: [
                        {
                            type: "text",
                            text: "",
                        } as unknown,
                    ],
                })
            )
        ).toBe(false);
    });

    it("includes an artifact content block with exportable content", () => {
        expect(
            isExportableClaudeMessage(
                message({
                    content: [
                        {
                            type: "tool_use",
                            name: "artifacts",
                            input: {
                                command: "create",
                                version_uuid: "artifact-version",
                                content: "Artifact body",
                            },
                        } as unknown,
                    ],
                })
            )
        ).toBe(true);
    });

    it("includes a message without text but with a named file", () => {
        expect(
            isExportableClaudeMessage(
                message({ files: [{ file_name: "diagram.png" }] })
            )
        ).toBe(true);
    });

    it("includes a message without text but with inline extracted content", () => {
        expect(
            isExportableClaudeMessage(
                message({
                    attachments: [
                        {
                            file_name: "",
                            file_size: 10,
                            file_type: "txt",
                            extracted_content: "Inline export text",
                        },
                    ],
                })
            )
        ).toBe(true);
    });

    it("excludes an entirely empty message", () => {
        expect(isExportableClaudeMessage(message({}))).toBe(false);
    });

    it("excludes a message with only file_uuid and file_name null", () => {
        expect(
            isExportableClaudeMessage(
                message({
                    files: [
                        {
                            file_uuid: "file-1",
                            file_name: null,
                        } as unknown,
                    ],
                })
            )
        ).toBe(false);
    });

    it("uses the same exportable count in analysis, adapter updates and conversion", async () => {
        const messages = [
            message({ uuid: "text", text: "Hello" }),
            message({
                uuid: "block",
                content: [{ type: "text", text: "Block text" } as unknown],
            }),
            message({ uuid: "file", files: [{ file_name: "image.png" }] }),
            message({
                uuid: "inline",
                attachments: [
                    {
                        file_name: "",
                        file_size: 12,
                        file_type: "txt",
                        extracted_content: "Embedded file content",
                    },
                ],
            }),
            message({ uuid: "empty" }),
            message({
                uuid: "unresolved-file",
                files: [{ file_uuid: "file-uuid", file_name: null } as unknown],
            }),
        ];
        const chat = conversation(messages);
        const plugin = createTestPlugin();
        const extractor = new ConversationMetadataExtractor(
            new DefaultProviderRegistry(),
            plugin
        );
        const adapter = new ClaudeAdapter(plugin);

        const metadata = (extractor as unknown).extractClaudeMetadata([
            chat,
        ]) as unknown[];
        const converted = await ClaudeConverter.convertMessages(messages);
        const newMessages = adapter.getNewMessages(chat, []);

        expect(metadata).toHaveLength(1);
        expect(metadata[0].messageCount).toBe(4);
        expect(converted).toHaveLength(4);
        expect(newMessages).toHaveLength(4);
    });

    it("drops a conversation containing 188 empty messages during analysis", () => {
        const emptyMessages = Array.from({ length: 188 }, (_, index) =>
            message({ uuid: `empty-${index}` })
        );
        const extractor = new ConversationMetadataExtractor(
            new DefaultProviderRegistry(),
            createTestPlugin()
        );

        const metadata = (extractor as unknown).extractClaudeMetadata([
            conversation(emptyMessages, {
                uuid: "b626f1bf-9153-437f-ac81-7bcb58097e11",
            }),
        ]) as unknown[];

        expect(metadata).toHaveLength(0);
    });

    it.skipIf(!fs.existsSync(sandboxConversationsPath))(
        "drops local Untitled conversations whose content blocks are empty",
        () => {
            const conversations: ClaudeConversation[] = JSON.parse(
                fs.readFileSync(sandboxConversationsPath, "utf8")
            );
            const extractor = new ConversationMetadataExtractor(
                new DefaultProviderRegistry(),
                createTestPlugin()
            );
            const corpseIds = new Set([
                "7329a60a-f1c8-47f3-848c-d6153c62472f",
                "9c47df0f-8dd9-4484-9a4c-d5c7d8b16da0",
            ]);

            const sourceCorpses = conversations.filter((chat) =>
                corpseIds.has(chat.uuid)
            );
            const metadata = (extractor as unknown).extractClaudeMetadata(
                sourceCorpses
            ) as unknown[];

            expect(sourceCorpses).toHaveLength(corpseIds.size);
            expect(metadata).toHaveLength(0);
        }
    );

    it.skipIf(!fs.existsSync(archivePath))(
        "keeps 119 of 128 conversations from the local Claude archive",
        async () => {
            const zip = await JSZip.loadAsync(fs.readFileSync(archivePath));
            const entry =
                zip.file("conversations.json") ??
                Object.values(zip.files).find((file) =>
                    file.name.endsWith("conversations.json")
                );
            expect(entry).toBeDefined();

            const payload = JSON.parse(await entry!.async("string"));
            const conversations: ClaudeConversation[] = Array.isArray(payload)
                ? payload
                : payload.conversations;
            const extractor = new ConversationMetadataExtractor(
                new DefaultProviderRegistry(),
                createTestPlugin()
            );

            const metadata = (extractor as unknown).extractClaudeMetadata(
                conversations
            ) as unknown[];
            const retainedIds = new Set(metadata.map((item) => item.id));

            expect(conversations).toHaveLength(128);
            expect(metadata).toHaveLength(119);
            for (const id of ghostConversationIds) {
                expect(retainedIds.has(id)).toBe(false);
            }
        }
    );
});
