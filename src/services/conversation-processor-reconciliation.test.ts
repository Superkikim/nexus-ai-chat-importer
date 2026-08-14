import { describe, expect, it, vi } from "vitest";
import { TFile } from "obsidian";
import { ConversationProcessor } from "./conversation-processor";
import { ImportReport } from "../models/import-report";
import { StandardConversation, StandardMessage } from "../types/standard";
import { ZipArchiveReader } from "../utils/zip-loader";

/**
 * Covers the pipeline contract around the provider reconciliation pass:
 * it runs on the WHOLE conversation between conversion and extraction, and a
 * library artifact it adds counts as new content even when the raw export
 * carried no new message.
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

const ZIP = {} as ZipArchiveReader;

function noteWith(messageIds: string[]): string {
    return [
        "---",
        "update_time: 2026-01-01T00:00:00.000Z",
        "---",
        ...messageIds.map((id) => `<!-- UID: ${id} -->`),
    ].join("\n");
}

/** Minimal surface the tests drive on the processor instance. */
type ProcessorUnderTest = Record<string, unknown> & {
    updateExistingNote: (...args: unknown[]) => Promise<void>;
};

function createProcessor(noteContent: string) {
    const logger = createLogger();
    const writeToFile = vi.fn(async (_path: string, _content: string) => {});
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

    // Hand-wired instance: the collaborators below are the only ones these
    // paths touch, so the test stays free of a full Obsidian environment.
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
    processor.fileService = { writeToFile };
    processor.noteFormatter = {
        generateMarkdownContent: vi.fn(() => "regenerated content"),
    };
    processor.messageFormatter = {
        formatMessages: vi.fn((messages: StandardMessage[]) =>
            messages.map((m) => `<!-- UID: ${m.id} -->`).join("\n")
        ),
    };

    return { processor, writeToFile, logger };
}

function conversationOf(messages: StandardMessage[]): StandardConversation {
    return {
        id: "thread-1",
        title: "Test conversation",
        provider: "chatgpt",
        createTime: 1000,
        updateTime: 2000,
        messages,
        metadata: {},
    };
}

const EXISTING_MESSAGES: StandardMessage[] = [
    { id: "m1", role: "user", content: "Draw me a brain", timestamp: 1000 },
    { id: "m2", role: "assistant", content: "Here it is", timestamp: 1001 },
];

/** Stands in for ChatGPT adapter: adds one library-only synthetic message. */
function adapterAddingSyntheticMessage() {
    const seen: StandardMessage[][] = [];
    return {
        seen,
        adapter: {
            getTitle: () => "Test conversation",
            getCreateTime: () => 1000,
            getUpdateTime: () => 2000,
            getId: () => "thread-1",
            getNewMessages: vi.fn(() => []),
            reconcileConversationMessages: vi.fn(
                async (messages: StandardMessage[]) => {
                    seen.push(messages);
                    if (
                        messages.some(
                            (m) => m.id === "nexus-library-artifact-omitted"
                        )
                    ) {
                        return messages;
                    }
                    return [
                        ...messages,
                        {
                            id: "nexus-library-artifact-omitted",
                            role: "assistant" as const,
                            content: "",
                            timestamp: 1002,
                            attachments: [
                                {
                                    fileName: "brain.png",
                                    fileType: "image/png",
                                    fileId: "file_img_1",
                                },
                            ],
                        },
                    ];
                }
            ),
            processMessageAttachments: vi.fn(
                async (messages: StandardMessage[]) => messages
            ),
        },
    };
}

describe("ConversationProcessor reconciliation", () => {
    it("updates the note when the only new content is a reconciled library artifact", async () => {
        const { processor, writeToFile } = createProcessor(
            noteWith(["m1", "m2"])
        );
        const { adapter } = adapterAddingSyntheticMessage();
        const importReport = new ImportReport();
        importReport.startFileSection("chatgpt_export.zip");

        await processor.updateExistingNote(
            adapter,
            conversationOf([...EXISTING_MESSAGES]),
            "note.md",
            2,
            importReport,
            ZIP,
            false,
            true
        );

        // The raw export had no new message (getNewMessages returns []), yet
        // the note is updated because reconciliation surfaced the artifact.
        expect(writeToFile).toHaveBeenCalledTimes(1);
        expect(writeToFile.mock.calls[0][1]).toContain(
            "<!-- UID: nexus-library-artifact-omitted -->"
        );
    });

    it("passes the whole conversation to reconciliation, never a filtered subset", async () => {
        const { processor } = createProcessor(noteWith(["m1", "m2"]));
        const { adapter, seen } = adapterAddingSyntheticMessage();
        const importReport = new ImportReport();
        importReport.startFileSection("chatgpt_export.zip");

        await processor.updateExistingNote(
            adapter,
            conversationOf([...EXISTING_MESSAGES]),
            "note.md",
            2,
            importReport,
            ZIP,
            false,
            true
        );

        expect(seen).toHaveLength(1);
        expect(seen[0].map((m) => m.id)).toEqual(["m1", "m2"]);
    });

    it("does not re-add an artifact the note already contains", async () => {
        // The synthetic message is already recorded in the note.
        const { processor, writeToFile } = createProcessor(
            noteWith(["m1", "m2", "nexus-library-artifact-omitted"])
        );
        const { adapter } = adapterAddingSyntheticMessage();
        const importReport = new ImportReport();
        importReport.startFileSection("chatgpt_export.zip");

        await processor.updateExistingNote(
            adapter,
            conversationOf([...EXISTING_MESSAGES]),
            "note.md",
            2,
            importReport,
            ZIP,
            false,
            true
        );

        expect(writeToFile).not.toHaveBeenCalled();
    });

    it("reconciles before extraction on the Reprocess path", async () => {
        const { processor, writeToFile } = createProcessor(
            noteWith(["m1", "m2"])
        );
        const { adapter } = adapterAddingSyntheticMessage();
        const importReport = new ImportReport();
        importReport.startFileSection("chatgpt_export.zip");

        await processor.updateExistingNote(
            adapter,
            conversationOf([...EXISTING_MESSAGES]),
            "note.md",
            2,
            importReport,
            ZIP,
            true, // forceUpdate = Reprocess
            true
        );

        expect(adapter.reconcileConversationMessages).toHaveBeenCalledTimes(1);
        // Extraction saw the reconciled list, synthetic message included.
        const extracted = adapter.processMessageAttachments.mock.calls[0][0];
        expect(extracted.map((m) => m.id)).toContain(
            "nexus-library-artifact-omitted"
        );
        expect(writeToFile).toHaveBeenCalledTimes(1);
    });

    it("continues the import when reconciliation throws", async () => {
        const { processor, writeToFile, logger } = createProcessor(
            noteWith(["m1"])
        );
        const adapter = {
            getTitle: () => "Test conversation",
            getCreateTime: () => 1000,
            getUpdateTime: () => 2000,
            getId: () => "thread-1",
            getNewMessages: vi.fn(() => []),
            reconcileConversationMessages: vi.fn(async () => {
                throw new Error("library index exploded");
            }),
            processMessageAttachments: vi.fn(
                async (messages: StandardMessage[]) => messages
            ),
        };
        const importReport = new ImportReport();
        importReport.startFileSection("chatgpt_export.zip");

        await processor.updateExistingNote(
            adapter,
            conversationOf([...EXISTING_MESSAGES]),
            "note.md",
            2,
            importReport,
            ZIP,
            false,
            true
        );

        // m2 is still missing from the note, so the update proceeds without
        // the reconciliation result rather than failing the conversation.
        expect(logger.warn).toHaveBeenCalled();
        expect(writeToFile).toHaveBeenCalledTimes(1);
        expect(writeToFile.mock.calls[0][1]).toContain("<!-- UID: m2 -->");
    });
});
