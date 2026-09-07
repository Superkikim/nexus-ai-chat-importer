import { describe, expect, it, vi } from "vitest";
import { TFile } from "obsidian";
import { ConversationProcessor } from "./conversation-processor";
import { ChatGPTAdapter } from "../providers/chatgpt/chatgpt-adapter";
import { Chat } from "../providers/chatgpt/chatgpt-types";
import { ImportReport } from "../models/import-report";
import { StandardConversation, StandardMessage } from "../types/standard";
import { ZipArchiveReader, ZipEntryHandle } from "../utils/zip-loader";
import type NexusAiChatImporterPlugin from "../main";

/**
 * Phase 6 (regression / real-pipeline validation) coverage for two matrix
 * items not exercised elsewhere:
 *
 *  - "Reprocess" / "Second Reprocess": running Reprocess twice against the
 *    same raw export must replace the placeholder once and produce an
 *    identical, non-duplicated result the second time. This wires the REAL
 *    ChatGPTAdapter (real ChatGPTConverter, real annotateMissingGeneratedImages
 *    placeholder creation, real reconciler) through ConversationProcessor,
 *    rather than a stub adapter.
 *  - "Selective import" isolation: when the processor handles two different
 *    conversations in the same run, one conversation's reconciled library
 *    artifact must never leak into the other's note.
 */

function createLogger() {
    const logger: Record<string, unknown> = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    };
    logger.child = vi.fn(() => logger);
    return logger;
}

function createZipMock(
    jsonFiles: Record<string, string>,
    datEntries: string[] = []
) {
    const names = new Set([...Object.keys(jsonFiles), ...datEntries]);
    const makeHandle = (name: string): ZipEntryHandle => ({
        name,
        readBytes: async () => new TextEncoder().encode(jsonFiles[name] ?? ""),
        readText: async () => jsonFiles[name] ?? "",
        readTextChunks: async function* () {
            yield jsonFiles[name] ?? "";
        },
    });

    const zip: ZipArchiveReader = {
        listEntries: async () => [...names].map((path) => ({ path, size: 1 })),
        has: (name: string) => names.has(name),
        get: (name: string) => (names.has(name) ? makeHandle(name) : null),
    };
    return zip;
}

function noteWith(messageIds: string[]): string {
    return [
        "---",
        "update_time: 2026-01-01T00:00:00.000Z",
        "---",
        ...messageIds.map((id) => `<!-- UID: ${id} -->`),
    ].join("\n");
}

type ProcessorUnderTest = Record<string, unknown> & {
    updateExistingNote: (...args: unknown[]) => Promise<void>;
};

function createProcessor(noteContent: string) {
    const logger = createLogger();
    const generateMarkdownContent = vi.fn(
        (_conversation: StandardConversation) => "regenerated content"
    );
    const file = new TFile();

    const plugin: Record<string, unknown> = {
        logger,
        manifest: { id: "nexus-ai-chat-importer", version: "1.7.0" },
        settings: { conversationFolder: "Nexus/Conversations" },
        app: {
            vault: {
                getAbstractFileByPath: vi.fn(() => file),
                read: vi.fn(async () => noteContent),
                adapter: { exists: vi.fn(async () => true) },
            },
        },
    };

    const processor = Object.create(
        ConversationProcessor.prototype
    ) as ProcessorUnderTest;
    processor.plugin = plugin;
    processor.currentProvider = "chatgpt";
    processor.counters = {
        totalExistingConversations: 0,
        totalNewConversationsToImport: 0,
        totalExistingConversationsToUpdate: 0,
        totalNewConversationsSuccessfullyImported: 0,
        totalConversationsActuallyUpdated: 0,
        totalConversationsProcessed: 0,
        totalNonEmptyMessagesToImport: 0,
        totalNonEmptyMessagesToAdd: 0,
        totalNonEmptyMessagesAdded: 0,
    };
    processor.fileService = { writeToFile: vi.fn(async () => {}) };
    processor.noteFormatter = { generateMarkdownContent };
    processor.messageFormatter = {
        formatMessages: vi.fn((messages: StandardMessage[]) =>
            messages.map((m) => `<!-- UID: ${m.id} -->`).join("\n")
        ),
    };

    return { processor, generateMarkdownContent, logger };
}

/** A ChatGPT-format raw chat where the user asks for an image and ChatGPT's
 * reply carries no image content, matching the "recent export" case that
 * annotateMissingGeneratedImages fills with a placeholder. */
function chatRequestingAnImage(): Chat {
    return {
        id: "thread-1",
        title: "Brain request",
        create_time: 1_700_000_000,
        update_time: 1_700_000_100,
        mapping: {
            "msg-1": {
                id: "msg-1",
                message: {
                    id: "msg-1",
                    author: { role: "user" },
                    content: {
                        parts: [
                            "Generate an image of a brain versus a circuit",
                        ],
                    },
                    create_time: 1_700_000_000,
                },
            },
            "msg-2": {
                id: "msg-2",
                message: {
                    id: "msg-2",
                    author: { role: "assistant" },
                    content: { parts: ["Here you go."] },
                    create_time: 1_700_000_010,
                },
            },
        },
    };
}

function libraryZipFor(
    conversationId: string,
    messageId: string
): ZipArchiveReader {
    const entry = {
        id: { id: "libfile_img" },
        file_id: "file_img_1",
        file_name: "Brain vs circuit symbol.png",
        mime_type: "image/png",
        file_size_bytes: 96138,
        library_artifact_type: "image",
        library_file_category: "image",
        image_gen_generation_id: "gen-1",
        origination_message_id: messageId,
        origination_thread_id: conversationId,
        created_at: "2026-07-15T12:25:30.970665+00:00",
    };
    return createZipMock({ "library_files.json": JSON.stringify([entry]) }, [
        "file_img_1.dat",
    ]);
}

function createRealChatGPTAdapter(): ChatGPTAdapter {
    const logger = createLogger();
    const plugin = { logger } as unknown as NexusAiChatImporterPlugin;
    const adapter = new ChatGPTAdapter(plugin);
    // Extraction-to-disk is ChatGPTAttachmentExtractor's own well-tested
    // concern; stub it here so this test stays focused on reconciliation
    // (real) wired through the processor, without a full vault mock.
    vi.spyOn(adapter, "processMessageAttachments").mockImplementation(
        async (messages: StandardMessage[]) => messages
    );
    return adapter;
}

describe("ConversationProcessor + real ChatGPTAdapter (Reprocess idempotency)", () => {
    it("Reprocess replaces the placeholder with the real file, with no duplicate", async () => {
        const { processor, generateMarkdownContent } = createProcessor(
            noteWith(["msg-1", "msg-2"])
        );
        const adapter = createRealChatGPTAdapter();
        const zip = libraryZipFor("thread-1", "msg-2");
        const chat = chatRequestingAnImage();
        const importReport = new ImportReport();
        importReport.startFileSection("chatgpt_export.zip");

        await processor.updateExistingNote(
            adapter,
            chat,
            "note.md",
            2,
            importReport,
            zip,
            true, // forceUpdate = Reprocess
            false // isStandardConversation = false: adapter.convertChat runs
        );

        expect(generateMarkdownContent).toHaveBeenCalledTimes(1);
        const conversation = generateMarkdownContent.mock.calls[0][0];
        const attachments = conversation.messages.flatMap(
            (m) => m.attachments ?? []
        );

        expect(attachments).toHaveLength(1);
        expect(attachments[0].fileId).toBe("file_img_1");
        expect(
            attachments.some((a) => a.status?.reason === "not_in_export")
        ).toBe(false);
    });

    it("a second Reprocess against the same export is idempotent (no duplicate attachment or message)", async () => {
        const { processor, generateMarkdownContent } = createProcessor(
            noteWith(["msg-1", "msg-2"])
        );
        const adapter = createRealChatGPTAdapter();
        const importReport = new ImportReport();
        importReport.startFileSection("chatgpt_export.zip");

        // Two independent Reprocess runs, each re-parsing the SAME raw chat
        // from scratch (a fresh placeholder is created by convertChat() every
        // time, exactly as re-running the plugin command would).
        for (let run = 0; run < 2; run++) {
            await processor.updateExistingNote(
                adapter,
                chatRequestingAnImage(),
                "note.md",
                2,
                importReport,
                libraryZipFor("thread-1", "msg-2"),
                true,
                false
            );
        }

        expect(generateMarkdownContent).toHaveBeenCalledTimes(2);
        const firstRun = generateMarkdownContent.mock.calls[0][0];
        const secondRun = generateMarkdownContent.mock.calls[1][0];

        const summarize = (c: StandardConversation) =>
            c.messages.map((m) => ({
                id: m.id,
                attachmentFileIds: (m.attachments ?? []).map((a) => a.fileId),
            }));

        expect(summarize(secondRun)).toEqual(summarize(firstRun));
        expect(
            firstRun.messages.flatMap((m) => m.attachments ?? [])
        ).toHaveLength(1);
        expect(
            secondRun.messages.flatMap((m) => m.attachments ?? [])
        ).toHaveLength(1);
    });
});

describe("ConversationProcessor multi-conversation isolation", () => {
    it("a synthetic artifact reconciled for one conversation never leaks into another conversation's note", async () => {
        function conversationOf(
            id: string,
            messages: StandardMessage[]
        ): StandardConversation {
            return {
                id,
                title: `Conversation ${id}`,
                provider: "chatgpt",
                createTime: 1000,
                updateTime: 2000,
                messages,
                metadata: {},
            };
        }

        function stubAdapterKeyedByConversation() {
            return {
                getTitle: () => "Test",
                getCreateTime: () => 1000,
                getUpdateTime: () => 2000,
                getId: (c: StandardConversation) => c.id,
                getNewMessages: vi.fn(() => []),
                reconcileConversationMessages: vi.fn(
                    async (
                        messages: StandardMessage[],
                        conversationId: string
                    ) => [
                        ...messages,
                        {
                            id: `nexus-library-artifact-${conversationId}`,
                            role: "assistant" as const,
                            content: "",
                            timestamp: 1002,
                            attachments: [
                                {
                                    fileName: `${conversationId}.png`,
                                    fileType: "image/png",
                                    fileId: `file_${conversationId}`,
                                },
                            ],
                        },
                    ]
                ),
                processMessageAttachments: vi.fn(
                    async (messages: StandardMessage[]) => messages
                ),
            };
        }

        const adapter = stubAdapterKeyedByConversation();
        const baseMessages: StandardMessage[] = [
            { id: "m1", role: "user", content: "Hi", timestamp: 1000 },
        ];
        const importReport = new ImportReport();
        importReport.startFileSection("chatgpt_export.zip");

        const { processor: processorA, generateMarkdownContent: genA } =
            createProcessor(noteWith(["m1"]));
        await processorA.updateExistingNote(
            adapter,
            conversationOf("thread-A", [...baseMessages]),
            "a.md",
            1,
            importReport,
            {},
            true,
            true
        );

        const { processor: processorB, generateMarkdownContent: genB } =
            createProcessor(noteWith(["m1"]));
        await processorB.updateExistingNote(
            adapter,
            conversationOf("thread-B", [...baseMessages]),
            "b.md",
            1,
            importReport,
            {},
            true,
            true
        );

        const conversationA = genA.mock.calls[0][0];
        const conversationB = genB.mock.calls[0][0];

        const idsA = conversationA.messages.map((m) => m.id);
        const idsB = conversationB.messages.map((m) => m.id);

        expect(idsA).toContain("nexus-library-artifact-thread-A");
        expect(idsA).not.toContain("nexus-library-artifact-thread-B");
        expect(idsB).toContain("nexus-library-artifact-thread-B");
        expect(idsB).not.toContain("nexus-library-artifact-thread-A");
    });
});
