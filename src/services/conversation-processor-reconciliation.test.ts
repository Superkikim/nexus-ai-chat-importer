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

function createProcessor(
    noteContent: string,
    settings: Record<string, unknown> = {}
) {
    const logger = createLogger();
    const writeToFile = vi.fn(async (_path: string, _content: string) => {});
    const file = new TFile();

    const plugin: Record<string, unknown> = {
        logger,
        manifest: { id: "nexus-ai-chat-importer", version: "1.7.0" },
        settings: { conversationFolder: "Nexus/Conversations", ...settings },
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

function conversationOf(
    messages: StandardMessage[],
    updateTime = 2000
): StandardConversation {
    return {
        id: "thread-1",
        title: "Test conversation",
        provider: "chatgpt",
        createTime: 1000,
        updateTime,
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

    it("refreshes the stamp of a note that has nothing to add", async () => {
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

        // The archive is newer than the note — that is why this path ran — so
        // the note takes the new stamp. What it must not do is append the
        // artifact it already carries.
        expect(writeToFile).toHaveBeenCalledTimes(1);
        const written = writeToFile.mock.calls[0][1];
        expect(written).not.toContain("update_time: 2026-01-01T00:00:00.000Z");
        expect(written.match(/nexus-library-artifact-omitted/g)).toHaveLength(
            1
        );
        expect(importReport.getUpdatedCount()).toBe(1);
    });

    /**
     * Providers move update_time for things that produce no message. ChatGPT
     * did it to a real conversation between two exports: same five nodes, same
     * ids, same text, stamp ten days later. The note kept the old stamp, so
     * every later import offered it as "Updated" again and did nothing about
     * it — a promise that could never resolve.
     */
    it("closes the loop when only the stamp moved", async () => {
        const { processor, writeToFile } = createProcessor(
            noteWith(["m1", "m2"])
        );
        const adapter = {
            getTitle: () => "Problème de succession Bally",
            getCreateTime: () => 1_780_517_756,
            getUpdateTime: () => 1_781_427_506,
            convertChat: vi.fn(),
            getProviderName: () => "chatgpt",
            processMessageAttachments: vi.fn(),
        };
        const importReport = new ImportReport();
        importReport.startFileSection("chatgpt_export.zip");

        await processor.updateExistingNote(
            adapter,
            // The archive carries exactly what the note already holds.
            conversationOf([...EXISTING_MESSAGES], 1_781_427_506),
            "note.md",
            2,
            importReport,
            ZIP,
            false,
            true
        );

        const written = writeToFile.mock.calls[0][1];
        expect(written).toContain("update_time: 2026-06-14T08:58:26.000Z");
        // Reported as updated with nothing added, which is what happened.
        expect(importReport.getUpdatedCount()).toBe(1);
        expect(
            (processor.counters as { totalNonEmptyMessagesAdded: number })
                .totalNonEmptyMessagesAdded
        ).toBe(0);
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

    describe("custom ID property on update", () => {
        const stampOnly = {
            getTitle: () => "Test conversation",
            getCreateTime: () => 1000,
            getUpdateTime: () => 2000,
            convertChat: vi.fn(),
            getProviderName: () => "chatgpt",
            processMessageAttachments: vi.fn(),
        };

        async function update(note: string, settings: Record<string, unknown>) {
            const { processor, writeToFile, logger } = createProcessor(
                note,
                settings
            );
            const importReport = new ImportReport();
            importReport.startFileSection("chatgpt_export.zip");
            await processor.updateExistingNote(
                stampOnly,
                conversationOf([...EXISTING_MESSAGES]),
                "note.md",
                2,
                importReport,
                ZIP,
                false,
                true
            );
            return { written: writeToFile.mock.calls[0][1], logger };
        }

        const withId = (...extra: string[]) =>
            [
                "---",
                "conversation_id: thread-1",
                ...extra,
                "update_time: 2026-01-01T00:00:00.000Z",
                "---",
                "<!-- UID: m1 -->",
                "<!-- UID: m2 -->",
            ].join("\n");

        it("adds the property to a note that lacks it", async () => {
            const { written } = await update(withId(), {
                customIdProperty: "uid",
            });
            expect(written).toContain(
                "conversation_id: thread-1\nuid: thread-1\n"
            );
        });

        it("follows the overwrite toggle for an existing value", async () => {
            const kept = await update(withId("uid: mine"), {
                customIdProperty: "uid",
                customIdPropertyOverwrite: false,
            });
            expect(kept.written).toContain("uid: mine\n");

            const replaced = await update(withId("uid: mine"), {
                customIdProperty: "uid",
                customIdPropertyOverwrite: true,
            });
            expect(replaced.written).toContain("uid: thread-1\n");
            expect(replaced.written).not.toContain("uid: mine");
        });

        it("still updates a note the property cannot be written to", async () => {
            const { written, logger } = await update(noteWith(["m1", "m2"]), {
                customIdProperty: "uid",
            });
            expect(written).not.toContain("uid:");
            expect(logger.warn).toHaveBeenCalled();
        });

        it("writes nothing when the feature is off", async () => {
            const { written } = await update(withId(), {});
            expect(written).not.toContain("uid:");
        });
    });
    describe("mode and models on update", () => {
        const stampOnly = {
            getTitle: () => "Test conversation",
            getCreateTime: () => 1000,
            getUpdateTime: () => 2000,
            convertChat: vi.fn(),
            getProviderName: () => "perplexity",
            processMessageAttachments: vi.fn(),
        };

        const note = [
            "---",
            "update_time: 2026-01-01T00:00:00.000Z",
            "mode:",
            '  - "CONCISE"',
            "models:",
            '  - "sonar"',
            "---",
            "<!-- UID: m1 -->",
            "<!-- UID: m2 -->",
        ].join("\n");

        async function update(metadata: Record<string, unknown>) {
            const { processor, writeToFile } = createProcessor(note);
            const importReport = new ImportReport();
            importReport.startFileSection("perplexity_export.zip");
            await processor.updateExistingNote(
                stampOnly,
                { ...conversationOf([...EXISTING_MESSAGES]), metadata },
                "note.md",
                2,
                importReport,
                ZIP,
                false,
                true
            );
            return writeToFile.mock.calls[0][1];
        }

        it("keeps them when the export names neither", async () => {
            const written = await update({});

            expect(written).toContain('mode:\n  - "CONCISE"');
            expect(written).toContain('models:\n  - "sonar"');
        });

        it("replaces only what the export names", async () => {
            const written = await update({
                mode: ["COPILOT", "CONCISE"],
                models: [],
            });

            expect(written).toContain('mode:\n  - "COPILOT"\n  - "CONCISE"');
            expect(written).toContain('models:\n  - "sonar"');
        });

        it("replaces a single mode line written before mode became a list", async () => {
            const { processor, writeToFile } = createProcessor(
                [
                    "---",
                    "update_time: 2026-01-01T00:00:00.000Z",
                    'mode: "CONCISE"',
                    "---",
                    "<!-- UID: m1 -->",
                    "<!-- UID: m2 -->",
                ].join("\n")
            );
            const importReport = new ImportReport();
            importReport.startFileSection("perplexity_export.zip");
            await processor.updateExistingNote(
                stampOnly,
                {
                    ...conversationOf([...EXISTING_MESSAGES]),
                    metadata: { mode: ["COPILOT"] },
                },
                "note.md",
                2,
                importReport,
                ZIP,
                false,
                true
            );
            const written = writeToFile.mock.calls[0][1];

            expect(written).toContain('mode:\n  - "COPILOT"');
            expect(written).not.toContain('mode: "CONCISE"');
        });
    });
    describe("new messages in a note with Related Queries", () => {
        const note = [
            "---",
            "update_time: 2026-01-01T00:00:00.000Z",
            "---",
            "<!-- UID: m1 -->",
            "<!-- UID: m2 -->",
            "",
            "## Related Queries",
            "- Old follow-up",
        ].join("\n");

        const adapter = {
            getTitle: () => "Test conversation",
            getCreateTime: () => 1000,
            getUpdateTime: () => 2000,
            convertChat: vi.fn(),
            getProviderName: () => "perplexity",
            processMessageAttachments: vi.fn(
                async (messages: StandardMessage[]) => messages
            ),
        };

        async function update(relatedQueries: string[]) {
            const { processor, writeToFile } = createProcessor(note);
            processor.longContentExtractorInstance = {
                extract: vi.fn(async (messages: StandardMessage[]) => messages),
            };
            const importReport = new ImportReport();
            importReport.startFileSection("perplexity_export.zip");
            await processor.updateExistingNote(
                adapter,
                {
                    ...conversationOf([
                        ...EXISTING_MESSAGES,
                        {
                            id: "m3",
                            role: "user",
                            content: "One more",
                            timestamp: 1002,
                        },
                    ]),
                    metadata: { related_queries: relatedQueries },
                },
                "note.md",
                3,
                importReport,
                ZIP,
                false,
                true
            );
            return writeToFile.mock.calls[0][1];
        }

        it("keeps them when the export refreshes the section", async () => {
            const written = await update(["New follow-up"]);

            expect(written).toContain("<!-- UID: m3 -->");
            expect(written.indexOf("<!-- UID: m3 -->")).toBeLessThan(
                written.indexOf("## Related Queries")
            );
            expect(written).toContain("- New follow-up");
            expect(written.match(/## Related Queries/g)).toHaveLength(1);
        });

        it("places them before the section when the export has none", async () => {
            const written = await update([]);

            expect(written.indexOf("<!-- UID: m3 -->")).toBeLessThan(
                written.indexOf("## Related Queries")
            );
            expect(written).toContain("- Old follow-up");
        });
    });
    describe("a provider that reconciles a note by content", () => {
        const perplexityAdapter = {
            getTitle: () => "Test conversation",
            getCreateTime: () => 1000,
            getUpdateTime: () => 2000,
            getProviderName: () => "perplexity",
            convertChat: vi.fn(),
            reconcileNoteMessages: vi.fn(),
        };

        const note = [
            "---",
            "update_time: 2026-01-01T00:00:00.000Z",
            "---",
            ">[!nexus_agent] **Assistant** - 01.01.2026 00:00:00",
            "> A plain answer",
            "<!-- UID: official-1 -->",
        ].join("\n");

        async function update(plan: unknown) {
            perplexityAdapter.reconcileNoteMessages = vi.fn(() => plan);
            const { processor, writeToFile } = createProcessor(note);
            processor.longContentExtractorInstance = {
                extract: vi.fn(async (messages: StandardMessage[]) => messages),
            };
            const importReport = new ImportReport();
            importReport.startFileSection("perplexity_export.zip");
            await processor.updateExistingNote(
                perplexityAdapter,
                conversationOf([
                    {
                        id: "extension-1",
                        role: "assistant",
                        content: "A sourced answer",
                        timestamp: 1001,
                    },
                ]),
                "note.md",
                1,
                importReport,
                ZIP,
                false,
                true
            );
            return { writeToFile, importReport };
        }

        it("rewrites the stretch of note the plan names", async () => {
            const { writeToFile, importReport } = await update({
                append: [],
                rewrites: [
                    {
                        start: note.indexOf(">[!nexus_agent]"),
                        end: note.length,
                        messages: [
                            {
                                id: "extension-1",
                                role: "assistant",
                                content: "A sourced answer",
                                timestamp: 1001,
                            },
                        ],
                    },
                ],
            });

            const written = writeToFile.mock.calls[0][1];
            expect(written).toContain("<!-- UID: extension-1 -->");
            expect(written).not.toContain("<!-- UID: official-1 -->");
            expect(importReport.getUpdatedCount()).toBe(1);
        });

        it("keeps the note's stamp when the archive is older", async () => {
            const { writeToFile } = await update({
                append: [],
                rewrites: [
                    {
                        start: note.indexOf(">[!nexus_agent]"),
                        end: note.length,
                        messages: [
                            {
                                id: "extension-1",
                                role: "assistant",
                                content: "A sourced answer",
                                timestamp: 1001,
                            },
                        ],
                    },
                ],
            });

            expect(writeToFile.mock.calls[0][1]).toContain(
                "update_time: 2026-01-01T00:00:00.000Z"
            );
        });

        it("leaves the note alone when the plan is empty", async () => {
            const { writeToFile, importReport } = await update({
                append: [],
                rewrites: [],
            });

            expect(writeToFile).not.toHaveBeenCalled();
            expect(importReport.getUpdatedCount()).toBe(0);
        });
    });
});
