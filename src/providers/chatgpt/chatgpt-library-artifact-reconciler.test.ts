import { describe, expect, it } from "vitest";
import { reconcileChatGPTLibraryArtifacts } from "./chatgpt-library-artifact-reconciler";
import {
    ChatGPTLibraryEntry,
    ChatGPTLibraryIndex,
} from "./chatgpt-library-index";
import { createMissingGeneratedImageAttachment } from "./chatgpt-generated-image";
import { StandardAttachment, StandardMessage } from "../../types/standard";

const CONVERSATION = "thread-1";
const OTHER_CONVERSATION = "thread-2";

function buildIndex(entries: ChatGPTLibraryEntry[]): ChatGPTLibraryIndex {
    const byOriginationMessageId = new Map<string, ChatGPTLibraryEntry[]>();
    const byOriginationThreadId = new Map<string, ChatGPTLibraryEntry[]>();
    const byFileId = new Map<string, ChatGPTLibraryEntry>();

    for (const entry of entries) {
        byFileId.set(entry.fileId, entry);
        if (entry.originationMessageId) {
            const list =
                byOriginationMessageId.get(entry.originationMessageId) ?? [];
            list.push(entry);
            byOriginationMessageId.set(entry.originationMessageId, list);
        }
        if (entry.originationThreadId) {
            const list =
                byOriginationThreadId.get(entry.originationThreadId) ?? [];
            list.push(entry);
            byOriginationThreadId.set(entry.originationThreadId, list);
        }
    }

    return { byOriginationMessageId, byOriginationThreadId, byFileId };
}

function imageEntry(
    overrides: Partial<ChatGPTLibraryEntry> = {}
): ChatGPTLibraryEntry {
    return {
        fileId: "file_img_1",
        libraryFileId: "libfile_img_1",
        fileName: "Brain vs circuit symbol.png",
        mimeType: "image/png",
        fileSize: 96138,
        artifactType: "image",
        category: "image",
        imageGenerationId: "gen-1",
        originationThreadId: CONVERSATION,
        // 2026-08-01T10:00:00Z in milliseconds
        createdAt: Date.parse("2026-08-01T10:00:00.000Z"),
        ...overrides,
    };
}

function documentEntry(
    overrides: Partial<ChatGPTLibraryEntry> = {}
): ChatGPTLibraryEntry {
    return {
        fileId: "file_doc_1",
        libraryFileId: "libfile_doc_1",
        fileName: "Sample generated report.docx",
        mimeType:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        fileSize: 37768,
        artifactType: "report",
        category: "other",
        originationThreadId: CONVERSATION,
        createdAt: Date.parse("2026-08-01T10:00:00.000Z"),
        ...overrides,
    };
}

function message(
    id: string,
    role: "user" | "assistant",
    timestamp: number,
    content = "",
    attachments?: StandardAttachment[]
): StandardMessage {
    return {
        id,
        role,
        content,
        timestamp,
        ...(attachments && { attachments }),
    };
}

/** Every fileId has a payload unless explicitly excluded. */
const allPresent = () => true;
const nonePresent = () => false;

function attachmentsOf(messages: StandardMessage[]): StandardAttachment[] {
    return messages.flatMap((m) => m.attachments ?? []);
}

describe("reconcileChatGPTLibraryArtifacts", () => {
    it("attaches an artifact to the existing assistant message that produced it", () => {
        const messages = [
            message("m1", "user", 1000, "Generate an image of a brain"),
            message("m2", "assistant", 1001, "Here it is"),
        ];
        const index = buildIndex([imageEntry({ originationMessageId: "m2" })]);

        const { messages: result, stats } = reconcileChatGPTLibraryArtifacts(
            messages,
            CONVERSATION,
            index,
            allPresent
        );

        expect(result).toHaveLength(2);
        expect(stats.attachedToExportedMessage).toBe(1);
        const attached = result[1].attachments!;
        expect(attached).toHaveLength(1);
        expect(attached[0].fileName).toBe("Brain_vs_circuit_symbol.png");
        expect(attached[0].attachmentType).toBe("generated_image");
        expect(attached[0].fileId).toBe("file_img_1");
    });

    it("attaches an artifact to an existing user message when that message produced it", () => {
        const messages = [message("m1", "user", 1000, "Here is my draft")];
        const index = buildIndex([
            documentEntry({ originationMessageId: "m1" }),
        ]);

        const { messages: result, stats } = reconcileChatGPTLibraryArtifacts(
            messages,
            CONVERSATION,
            index,
            allPresent
        );

        expect(stats.attachedToExportedMessage).toBe(1);
        expect(result[0].attachments).toHaveLength(1);
        // File names are sanitized for the vault, as for every attachment.
        expect(result[0].attachments![0].fileName).toBe(
            "Sample_generated_report.docx"
        );
        // Documents get no generated-image template — the shared formatter
        // renders name/type/size and a link.
        expect(result[0].attachments![0].attachmentType).toBeUndefined();
        expect(result[0].attachments![0].extractedContent).toBeUndefined();
    });

    it("creates a synthetic assistant message when the originating message was omitted", () => {
        const messages = [message("m1", "user", 1000, "Some question")];
        const createdAt = Date.parse("2026-08-01T10:00:00.000Z");
        const index = buildIndex([
            imageEntry({ originationMessageId: "missing-msg", createdAt }),
        ]);

        const { messages: result, stats } = reconcileChatGPTLibraryArtifacts(
            messages,
            CONVERSATION,
            index,
            allPresent
        );

        expect(stats.attachedToSyntheticMessage).toBe(1);
        expect(result).toHaveLength(2);

        const synthetic = result[1];
        expect(synthetic.id).toBe("nexus-library-artifact-missing-msg");
        expect(synthetic.role).toBe("assistant");
        // No invented prose.
        expect(synthetic.content).toBe("");
        // Positioned at the artifact's real creation time, in unix seconds.
        expect(synthetic.timestamp).toBe(Math.floor(createdAt / 1000));
        expect(synthetic.attachments).toHaveLength(1);
    });

    it("groups several artifacts lost with the same message onto one synthetic message", () => {
        const messages = [message("m1", "user", 1000, "Do the thing")];
        const index = buildIndex([
            imageEntry({
                fileId: "file_a",
                libraryFileId: "lib_a",
                imageGenerationId: "gen-a",
                originationMessageId: "missing-msg",
            }),
            imageEntry({
                fileId: "file_b",
                libraryFileId: "lib_b",
                imageGenerationId: "gen-b",
                originationMessageId: "missing-msg",
            }),
        ]);

        const { messages: result } = reconcileChatGPTLibraryArtifacts(
            messages,
            CONVERSATION,
            index,
            allPresent
        );

        expect(result).toHaveLength(2);
        expect(result[1].attachments).toHaveLength(2);
    });

    it("attaches several artifacts produced by one exported message", () => {
        const messages = [
            message("m1", "user", 1000, "Make two images"),
            message("m2", "assistant", 1001, "Done"),
        ];
        const index = buildIndex([
            imageEntry({
                fileId: "file_a",
                libraryFileId: "lib_a",
                imageGenerationId: "gen-a",
                originationMessageId: "m2",
            }),
            imageEntry({
                fileId: "file_b",
                libraryFileId: "lib_b",
                imageGenerationId: "gen-b",
                originationMessageId: "m2",
            }),
        ]);

        const { messages: result, stats } = reconcileChatGPTLibraryArtifacts(
            messages,
            CONVERSATION,
            index,
            allPresent
        );

        expect(stats.attachedToExportedMessage).toBe(2);
        expect(result).toHaveLength(2);
        expect(result[1].attachments).toHaveLength(2);
    });

    it("keeps multiple generations in one conversation in chronological order", () => {
        const first = Date.parse("2026-08-01T10:00:00.000Z");
        const second = Date.parse("2026-08-01T11:00:00.000Z");
        const messages = [message("m1", "user", 1000, "Start")];
        const index = buildIndex([
            imageEntry({
                fileId: "file_late",
                libraryFileId: "lib_late",
                imageGenerationId: "gen-late",
                originationMessageId: "missing-late",
                createdAt: second,
            }),
            imageEntry({
                fileId: "file_early",
                libraryFileId: "lib_early",
                imageGenerationId: "gen-early",
                originationMessageId: "missing-early",
                createdAt: first,
            }),
        ]);

        const { messages: result } = reconcileChatGPTLibraryArtifacts(
            messages,
            CONVERSATION,
            index,
            allPresent
        );

        expect(result.map((m) => m.id)).toEqual([
            "m1",
            "nexus-library-artifact-missing-early",
            "nexus-library-artifact-missing-late",
        ]);
    });

    it("orders synthetic messages stably when timestamps are equal", () => {
        const sameTime = Date.parse("2026-08-01T10:00:00.000Z");
        const messages = [message("m1", "user", 1000, "Start")];
        const entries = [
            imageEntry({
                fileId: "file_b",
                libraryFileId: "lib_b",
                imageGenerationId: "gen-b",
                originationMessageId: "bbb",
                createdAt: sameTime,
            }),
            imageEntry({
                fileId: "file_a",
                libraryFileId: "lib_a",
                imageGenerationId: "gen-a",
                originationMessageId: "aaa",
                createdAt: sameTime,
            }),
        ];

        const forward = reconcileChatGPTLibraryArtifacts(
            messages,
            CONVERSATION,
            buildIndex(entries),
            allPresent
        );
        const reversed = reconcileChatGPTLibraryArtifacts(
            messages,
            CONVERSATION,
            buildIndex([...entries].reverse()),
            allPresent
        );

        // Same input set, same output order regardless of index insertion order.
        expect(forward.messages.map((m) => m.id)).toEqual(
            reversed.messages.map((m) => m.id)
        );
        expect(forward.messages.map((m) => m.id)).toEqual([
            "m1",
            "nexus-library-artifact-aaa",
            "nexus-library-artifact-bbb",
        ]);
    });

    describe("placeholder handling", () => {
        const PROMPT = "Generate an image of a brain versus a circuit";

        function withPlaceholder(): StandardMessage[] {
            return [
                message("m1", "user", 1000, PROMPT),
                message("m2", "assistant", 1001, "Here is your image", [
                    createMissingGeneratedImageAttachment(PROMPT),
                ]),
            ];
        }

        it("replaces the placeholder with the real file instead of adding a second message", () => {
            const index = buildIndex([
                imageEntry({ originationMessageId: "missing-msg" }),
            ]);

            const { messages: result, stats } =
                reconcileChatGPTLibraryArtifacts(
                    withPlaceholder(),
                    CONVERSATION,
                    index,
                    allPresent
                );

            expect(stats.replacedPlaceholder).toBe(1);
            expect(stats.attachedToSyntheticMessage).toBe(0);
            // No extra message: the placeholder's host received the real file.
            expect(result).toHaveLength(2);

            const attachments = attachmentsOf(result);
            expect(attachments).toHaveLength(1);
            expect(attachments[0].fileName).toBe("Brain_vs_circuit_symbol.png");
            expect(attachments[0].status).toBeUndefined();
            // The prompt the conversion pass resolved is preserved.
            expect(attachments[0].generationPrompt).toBe(PROMPT);
            expect(attachments[0].extractedContent).toContain(
                "**Image prompt**"
            );
            expect(attachments[0].extractedContent).toContain("{{FILENAME}}");
        });

        it("also clears the placeholder when the artifact resolves to its exported message", () => {
            const index = buildIndex([
                imageEntry({ originationMessageId: "m2" }),
            ]);

            const { messages: result, stats } =
                reconcileChatGPTLibraryArtifacts(
                    withPlaceholder(),
                    CONVERSATION,
                    index,
                    allPresent
                );

            expect(stats.replacedPlaceholder).toBe(1);
            const attachments = attachmentsOf(result);
            expect(attachments).toHaveLength(1);
            expect(attachments[0].status?.found).toBeUndefined();
        });

        it("keeps the placeholder when the payload is absent from the archive", () => {
            const index = buildIndex([
                imageEntry({ originationMessageId: "missing-msg" }),
            ]);

            const { messages: result, stats } =
                reconcileChatGPTLibraryArtifacts(
                    withPlaceholder(),
                    CONVERSATION,
                    index,
                    nonePresent
                );

            expect(stats.missingPayload).toBe(1);
            expect(stats.replacedPlaceholder).toBe(0);
            const attachments = attachmentsOf(result);
            expect(attachments).toHaveLength(1);
            expect(attachments[0].status?.reason).toBe("not_in_export");
        });

        it("leaves a surplus placeholder in place when fewer real files arrive", () => {
            const messages = [
                message("m1", "user", 1000, "Generate an image of a brain"),
                message("m2", "assistant", 1001, "First", [
                    createMissingGeneratedImageAttachment("first prompt"),
                ]),
                message("m3", "assistant", 1002, "Second", [
                    createMissingGeneratedImageAttachment("second prompt"),
                ]),
            ];
            const index = buildIndex([
                imageEntry({ originationMessageId: "missing-msg" }),
            ]);

            const { messages: result } = reconcileChatGPTLibraryArtifacts(
                messages,
                CONVERSATION,
                index,
                allPresent
            );

            const attachments = attachmentsOf(result);
            expect(attachments).toHaveLength(2);
            // One real file, one honest "still missing" placeholder.
            expect(
                attachments.filter((a) => a.status?.reason === "not_in_export")
            ).toHaveLength(1);
            expect(
                attachments.filter((a) => a.fileId === "file_img_1")
            ).toHaveLength(1);
        });
    });

    describe("entries that must not be injected", () => {
        it("ignores an artifact whose conversation is not in this export", () => {
            const messages = [message("m1", "user", 1000, "Hello")];
            const index = buildIndex([
                imageEntry({
                    originationThreadId: OTHER_CONVERSATION,
                    originationMessageId: "foreign-msg",
                }),
            ]);

            const { messages: result, stats } =
                reconcileChatGPTLibraryArtifacts(
                    messages,
                    CONVERSATION,
                    index,
                    allPresent
                );

            expect(result).toBe(messages);
            expect(stats.attachedToSyntheticMessage).toBe(0);
            expect(attachmentsOf(result)).toHaveLength(0);
        });

        it("does not inject an entry that only claims a foreign conversation even if a message id collides", () => {
            const messages = [message("m1", "user", 1000, "Hello")];
            const index = buildIndex([
                imageEntry({
                    originationThreadId: OTHER_CONVERSATION,
                    originationMessageId: "m1",
                }),
            ]);

            const { messages: result } = reconcileChatGPTLibraryArtifacts(
                messages,
                CONVERSATION,
                index,
                allPresent
            );

            expect(attachmentsOf(result)).toHaveLength(0);
        });

        it("does not duplicate a user upload already referenced by its message", () => {
            const messages = [
                message("m1", "user", 1000, "Look at this", [
                    {
                        fileName: "IMG_sample.jpeg",
                        fileType: "image/jpeg",
                        fileId: "file_upload_1",
                    },
                ]),
            ];
            const index = buildIndex([
                imageEntry({
                    fileId: "file_upload_1",
                    libraryFileId: "lib_upload_1",
                    originationMessageId: "m1",
                }),
            ]);

            const { messages: result, stats } =
                reconcileChatGPTLibraryArtifacts(
                    messages,
                    CONVERSATION,
                    index,
                    allPresent
                );

            expect(stats.alreadyReferenced).toBe(1);
            expect(attachmentsOf(result)).toHaveLength(1);
        });

        it("does not inject writing_block or plain-upload entries", () => {
            const messages = [message("m1", "user", 1000, "Pasted content")];
            const index = buildIndex([
                {
                    fileId: "file_wb",
                    fileName: "Pasted markdown.md",
                    mimeType: "text/markdown",
                    artifactType: "writing_block",
                    originationMessageId: "m1",
                    originationThreadId: CONVERSATION,
                },
                {
                    fileId: "file_upload",
                    fileName: "IMG_sample.jpeg",
                    mimeType: "image/jpeg",
                    originationMessageId: "m1",
                    originationThreadId: CONVERSATION,
                },
            ]);

            const { messages: result, stats } =
                reconcileChatGPTLibraryArtifacts(
                    messages,
                    CONVERSATION,
                    index,
                    allPresent
                );

            expect(stats.unsupported).toBe(2);
            expect(attachmentsOf(result)).toHaveLength(0);
        });

        it("does not duplicate a legacy DALL-E image that shares its generation id", () => {
            const messages = [
                message("m1", "assistant", 1000, "DALL-E Generated Image", [
                    {
                        fileName: "dalle_gen-1_1024x1024.png",
                        fileType: "image/png",
                        fileId: "file-service://dalle-asset",
                        attachmentType: "generated_image",
                        providerMetadata: { dalle: { gen_id: "gen-1" } },
                    },
                ]),
            ];
            const index = buildIndex([
                imageEntry({ originationMessageId: "m1" }),
            ]);

            const { messages: result, stats } =
                reconcileChatGPTLibraryArtifacts(
                    messages,
                    CONVERSATION,
                    index,
                    allPresent
                );

            expect(stats.alreadyReferenced).toBe(1);
            expect(attachmentsOf(result)).toHaveLength(1);
        });
    });

    describe("prompt association", () => {
        it("uses the nearest preceding image request for a synthetic message", () => {
            const createdAt = Date.parse("2026-08-01T10:00:00.000Z");
            const requestTime = Math.floor(createdAt / 1000) - 60;
            const messages = [
                message("m1", "user", requestTime - 100, "Unrelated question"),
                message(
                    "m1b",
                    "user",
                    requestTime,
                    "Generate an image of a cat"
                ),
            ];
            const index = buildIndex([
                imageEntry({
                    originationMessageId: "missing-msg",
                    createdAt,
                }),
            ]);

            const { messages: result } = reconcileChatGPTLibraryArtifacts(
                messages,
                CONVERSATION,
                index,
                allPresent
            );

            const attachment = attachmentsOf(result)[0];
            expect(attachment.generationPrompt).toBe(
                "Generate an image of a cat"
            );
        });

        it("never reuses one request for a competing artifact", () => {
            const first = Date.parse("2026-08-01T10:00:00.000Z");
            const second = Date.parse("2026-08-01T11:00:00.000Z");
            const messages = [
                message(
                    "m1",
                    "user",
                    Math.floor(first / 1000) - 60,
                    "Generate an image of a cat"
                ),
            ];
            const index = buildIndex([
                imageEntry({
                    fileId: "file_a",
                    libraryFileId: "lib_a",
                    imageGenerationId: "gen-a",
                    originationMessageId: "missing-a",
                    createdAt: first,
                }),
                imageEntry({
                    fileId: "file_b",
                    libraryFileId: "lib_b",
                    imageGenerationId: "gen-b",
                    originationMessageId: "missing-b",
                    createdAt: second,
                }),
            ]);

            const { messages: result } = reconcileChatGPTLibraryArtifacts(
                messages,
                CONVERSATION,
                index,
                allPresent
            );

            const prompts = attachmentsOf(result).map(
                (a) => a.generationPrompt
            );
            expect(prompts.filter(Boolean)).toHaveLength(1);
        });

        it("does not attach a request that comes after the artifact", () => {
            const createdAt = Date.parse("2026-08-01T10:00:00.000Z");
            const messages = [
                message(
                    "m1",
                    "user",
                    Math.floor(createdAt / 1000) + 600,
                    "Generate an image of a dog"
                ),
            ];
            const index = buildIndex([
                imageEntry({
                    originationMessageId: "missing-msg",
                    createdAt,
                }),
            ]);

            const { messages: result } = reconcileChatGPTLibraryArtifacts(
                messages,
                CONVERSATION,
                index,
                allPresent
            );

            const attachment = attachmentsOf(result).find(
                (a) => a.fileId === "file_img_1"
            )!;
            expect(attachment.generationPrompt).toBeUndefined();
            expect(attachment.extractedContent).toBeUndefined();
        });
    });

    describe("idempotency", () => {
        it("changes nothing when run again on its own output", () => {
            const messages = [
                message("m1", "user", 1000, "Generate an image of a brain"),
                message("m2", "assistant", 1001, "Here you go", [
                    createMissingGeneratedImageAttachment("brain prompt"),
                ]),
            ];
            const index = buildIndex([
                imageEntry({ originationMessageId: "missing-msg" }),
                documentEntry({ originationMessageId: "m2" }),
            ]);

            const first = reconcileChatGPTLibraryArtifacts(
                messages,
                CONVERSATION,
                index,
                allPresent
            );
            const second = reconcileChatGPTLibraryArtifacts(
                first.messages,
                CONVERSATION,
                index,
                allPresent
            );

            expect(second.messages).toEqual(first.messages);
            expect(second.stats.alreadyReferenced).toBe(2);
            expect(second.stats.attachedToExportedMessage).toBe(0);
            expect(second.stats.replacedPlaceholder).toBe(0);
            expect(second.stats.attachedToSyntheticMessage).toBe(0);
        });

        it("produces the same synthetic ids on a second independent run", () => {
            const messages = [message("m1", "user", 1000, "Question")];
            const index = buildIndex([
                imageEntry({ originationMessageId: "missing-msg" }),
            ]);

            const runA = reconcileChatGPTLibraryArtifacts(
                messages,
                CONVERSATION,
                index,
                allPresent
            );
            const runB = reconcileChatGPTLibraryArtifacts(
                messages,
                CONVERSATION,
                index,
                allPresent
            );

            expect(runA.messages.map((m) => m.id)).toEqual(
                runB.messages.map((m) => m.id)
            );
        });

        it("does not mutate the input messages", () => {
            const original = message("m2", "assistant", 1001, "Here you go");
            const messages = [original];
            const index = buildIndex([
                documentEntry({ originationMessageId: "m2" }),
            ]);

            reconcileChatGPTLibraryArtifacts(
                messages,
                CONVERSATION,
                index,
                allPresent
            );

            expect(original.attachments).toBeUndefined();
            expect(messages).toHaveLength(1);
        });
    });

    it("returns the original array untouched when the library has nothing for this conversation", () => {
        const messages = [message("m1", "user", 1000, "Hello")];
        const index = buildIndex([]);

        const { messages: result } = reconcileChatGPTLibraryArtifacts(
            messages,
            CONVERSATION,
            index,
            allPresent
        );

        expect(result).toBe(messages);
    });
});
