import { describe, expect, it, vi } from "vitest";
import { ConversationProcessor } from "./conversation-processor";
import { ImportReport } from "../models/import-report";
import { StandardConversation } from "../types/standard";

function createLogger() {
    const logger: any = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    };
    logger.child = vi.fn(() => logger);
    return logger;
}

describe("ConversationProcessor filename fallback", () => {
    it("retries with deterministic fallback path when first write fails with ENAMETOOLONG", async () => {
        const logger = createLogger();
        const plugin: any = {
            logger,
            manifest: { id: "nexus-ai-chat-importer", version: "1.6.3" },
            settings: {
                conversationFolder: "Nexus/Conversations",
                addDatePrefix: true,
                dateFormat: "YYYY-MM-DD",
            },
            app: {
                vault: {
                    getAbstractFileByPath: vi.fn(() => null),
                    createFolder: vi.fn(async () => {}),
                    adapter: {
                        exists: vi.fn(async () => false),
                    },
                    create: vi.fn(async () => {}),
                    modify: vi.fn(async () => {}),
                },
            },
        };

        const processor = Object.create(ConversationProcessor.prototype);
        processor.plugin = plugin;
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
        processor.noteFormatter = {
            generateMarkdownContent: vi.fn(() => "content"),
        };

        const writeToFile = vi
            .fn()
            .mockRejectedValueOnce(new Error("ENAMETOOLONG: name too long"))
            .mockResolvedValue(undefined);
        processor.fileService = { writeToFile };

        const importReport = new ImportReport();
        importReport.startFileSection("perplexity_export.zip");

        const conversation: StandardConversation = {
            id: "70882304-4d64-4395-a98a-3501c8c282ca",
            title: "A very long conversation title that should eventually trigger fallback naming in this targeted unit test",
            provider: "perplexity",
            createTime: 1_706_745_600,
            updateTime: 1_706_749_200,
            messages: [
                {
                    id: "msg-1",
                    role: "user",
                    content: "Hello",
                    timestamp: 1_706_745_600,
                },
            ],
            metadata: {},
        };

        const initialPath =
            "Nexus/Conversations/perplexity/2024/02/" + "x".repeat(240) + ".md";
        const finalPath = await processor.createNewNote(
            {},
            conversation,
            initialPath,
            importReport,
            undefined,
            true
        );

        expect(writeToFile).toHaveBeenCalledTimes(2);
        expect(writeToFile.mock.calls[0][0]).toBe(initialPath);
        expect(writeToFile.mock.calls[1][0]).toContain(
            "conversation-70882304-4d64-4395-a98a-3501c8c282ca.md"
        );
        expect(finalPath).toContain(
            "conversation-70882304-4d64-4395-a98a-3501c8c282ca.md"
        );
        expect(logger.warn).toHaveBeenCalled();
    });

    /**
     * Two conversations whose titles differ only in case share one path on a
     * case-insensitive filesystem. The vault used to answer the existence
     * check from its own index, which is keyed by exact case, so the second
     * note was never renamed and its create failed outright — one lost
     * conversation per collision.
     */
    it("retries with a unique name when the path is already taken on disk", async () => {
        const logger = createLogger();
        const plugin: any = {
            logger,
            manifest: { id: "nexus-ai-chat-importer", version: "1.7.0" },
            settings: {
                conversationFolder: "Nexus/Conversations",
                addDatePrefix: true,
                dateFormat: "YYYY-MM-DD",
            },
            app: {
                vault: {
                    getAbstractFileByPath: vi.fn(() => null),
                    createFolder: vi.fn(async () => {}),
                    adapter: {
                        // The taken path, and nothing else.
                        exists: vi.fn(
                            async (p: string) =>
                                p ===
                                "Nexus/Conversations/chatgpt/2024/04/2024-04-19 - Origine du nom TRICOT.md"
                        ),
                    },
                    create: vi.fn(async () => {}),
                    modify: vi.fn(async () => {}),
                },
            },
        };

        const processor = Object.create(ConversationProcessor.prototype);
        processor.plugin = plugin;
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
        processor.noteFormatter = {
            generateMarkdownContent: vi.fn(() => "content"),
        };

        const writeToFile = vi
            .fn()
            .mockRejectedValueOnce(new Error("File already exists."))
            .mockResolvedValue(undefined);
        processor.fileService = { writeToFile };

        const importReport = new ImportReport();
        importReport.startFileSection("chatgpt_export.zip");

        const conversation: StandardConversation = {
            id: "aa11bb22-cc33-dd44-ee55-ff6677889900",
            title: "Origine du nom TRICOT",
            provider: "chatgpt",
            createTime: 1_713_545_590,
            updateTime: 1_713_545_590,
            messages: [
                {
                    id: "msg-1",
                    role: "user",
                    content: "Hello",
                    timestamp: 1_713_545_590,
                },
            ],
            metadata: {},
        };

        const takenPath =
            "Nexus/Conversations/chatgpt/2024/04/2024-04-19 - Origine du nom TRICOT.md";
        const finalPath = await processor.createNewNote(
            {},
            conversation,
            takenPath,
            importReport,
            undefined,
            true
        );

        expect(writeToFile).toHaveBeenCalledTimes(2);
        expect(writeToFile.mock.calls[0][0]).toBe(takenPath);
        expect(finalPath).not.toBe(takenPath);
        expect(finalPath).toContain("Origine du nom TRICOT (1).md");
        // The note landed, so the report records a creation.
        expect(importReport.getCreatedCount()).toBe(1);
        expect(importReport.getConversationLedger().failed).toBe(0);
    });
});
