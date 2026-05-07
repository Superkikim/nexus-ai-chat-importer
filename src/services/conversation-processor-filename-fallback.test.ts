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

        const processor = Object.create(ConversationProcessor.prototype) as any;
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
            messages: [],
            metadata: {},
        };

        const initialPath = "Nexus/Conversations/perplexity/2024/02/" + "x".repeat(240) + ".md";
        const finalPath = await processor.createNewNote({}, conversation, initialPath, importReport, undefined, true);

        expect(writeToFile).toHaveBeenCalledTimes(2);
        expect(writeToFile.mock.calls[0][0]).toBe(initialPath);
        expect(writeToFile.mock.calls[1][0]).toContain("conversation-70882304-4d64-4395-a98a-3501c8c282ca.md");
        expect(finalPath).toContain("conversation-70882304-4d64-4395-a98a-3501c8c282ca.md");
        expect(logger.warn).toHaveBeenCalled();
    });
});
