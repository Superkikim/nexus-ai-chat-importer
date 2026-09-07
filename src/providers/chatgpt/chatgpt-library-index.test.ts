import { describe, expect, it, vi } from "vitest";
import {
    buildChatGPTLibraryIndex,
    classifyChatGPTLibraryArtifact,
    ChatGPTLibraryEntry,
} from "./chatgpt-library-index";
import { ZipArchiveReader, ZipEntryHandle } from "../../utils/zip-loader";
import {
    SANITIZED_LIBRARY_FILES_SAMPLE,
    SANITIZED_GENERATED_IMAGE_ENTRY,
    SANITIZED_GENERATED_DOCUMENT_ENTRY,
    SANITIZED_WRITING_BLOCK_ENTRY,
    SANITIZED_PLAIN_UPLOAD_ENTRY,
    SANITIZED_UNKNOWN_ARTIFACT_TYPE_ENTRY,
    SANITIZED_MISSING_CREATED_AT_ENTRY,
} from "./chatgpt-library-index.fixtures";
import { ScopedLogger, Logger } from "../../logger";

function createZipMock(files: Record<string, string>): ZipArchiveReader {
    const encoder = new TextEncoder();

    const makeHandle = (name: string, content: string): ZipEntryHandle => ({
        name,
        readBytes: async () => encoder.encode(content),
        readText: async () => content,
        readTextChunks: async function* () {
            yield content;
        },
    });

    return {
        listEntries: async () =>
            Object.entries(files).map(([path, content]) => ({
                path,
                size: content.length,
            })),
        has: (name: string) => name in files,
        get: (name: string) =>
            name in files ? makeHandle(name, files[name]) : null,
    };
}

const SAMPLE = JSON.stringify([
    {
        file_id: "file_0000000044c071f491e2d28bb4f6a09f",
        file_name: "lettre_opposition_isabelle_bally.docx",
        mime_type:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        library_artifact_type: "report",
        origination_message_id: "07625cea-5297-4e80-abe1-432448da0665",
    },
    {
        file_id: "file_00000000eaac720ab8a205a2fad78f12",
        file_name: "e8c23025-9d52-4419-9c73-083beb4a1f2a.png",
        mime_type: "image/png",
        library_artifact_type: null,
        origination_message_id: "fc3dffac-af68-4297-b3b1-4bd981ffde4f",
    },
    {
        file_id: "file_00000000a178720cb5a5c84f26c47d24",
        file_name: "IMG_8916.jpeg",
        mime_type: "image/jpeg",
        origination_message_id: null,
    },
]);

describe("buildChatGPTLibraryIndex", () => {
    it("returns null when library_files.json is absent (old format)", async () => {
        const zip = createZipMock({ "conversations.json": "[]" });
        expect(await buildChatGPTLibraryIndex(zip)).toBeNull();
    });

    it("returns null when the JSON is not an array", async () => {
        const zip = createZipMock({ "library_files.json": '{"oops":true}' });
        expect(await buildChatGPTLibraryIndex(zip)).toBeNull();
    });

    it("returns null for unparseable JSON", async () => {
        const zip = createZipMock({ "library_files.json": "not json" });
        expect(await buildChatGPTLibraryIndex(zip)).toBeNull();
    });

    it("indexes entries by origination message id and by file id", async () => {
        const zip = createZipMock({ "library_files.json": SAMPLE });
        const index = await buildChatGPTLibraryIndex(zip);
        expect(index).not.toBeNull();

        const docx = index!.byOriginationMessageId.get(
            "07625cea-5297-4e80-abe1-432448da0665"
        );
        expect(docx).toHaveLength(1);
        expect(docx![0].fileName).toBe("lettre_opposition_isabelle_bally.docx");
        expect(docx![0].artifactType).toBe("report");

        expect(
            index!.byFileId.get("file_0000000044c071f491e2d28bb4f6a09f")
                ?.fileName
        ).toBe("lettre_opposition_isabelle_bally.docx");
    });

    it("omits entries with no origination message id from the message map", async () => {
        const zip = createZipMock({ "library_files.json": SAMPLE });
        const index = await buildChatGPTLibraryIndex(zip);
        // IMG_8916.jpeg has origination_message_id null -> only in byFileId.
        expect(
            index!.byFileId.has("file_00000000a178720cb5a5c84f26c47d24")
        ).toBe(true);
        const allOrigKeys = [...index!.byOriginationMessageId.keys()];
        expect(allOrigKeys).not.toContain(null);
        expect(allOrigKeys).toHaveLength(2);
    });

    it("skips records missing file_id or file_name", async () => {
        const zip = createZipMock({
            "library_files.json": JSON.stringify([
                { file_name: "no-id.txt" },
                { file_id: "file_x" },
                { file_id: "file_y", file_name: "ok.txt" },
            ]),
        });
        const index = await buildChatGPTLibraryIndex(zip);
        expect(index!.byFileId.size).toBe(1);
        expect(index!.byFileId.has("file_y")).toBe(true);
    });

    describe("with the sanitized 2026-08-03 fixture sample", () => {
        const zip = createZipMock({
            "library_files.json": JSON.stringify(
                SANITIZED_LIBRARY_FILES_SAMPLE
            ),
        });

        it("indexes entries by origination thread id, message id, and file id", async () => {
            const index = await buildChatGPTLibraryIndex(zip);
            expect(index).not.toBeNull();

            expect(
                index!.byFileId.get(SANITIZED_GENERATED_IMAGE_ENTRY.file_id)
                    ?.fileName
            ).toBe(SANITIZED_GENERATED_IMAGE_ENTRY.file_name);

            expect(
                index!.byOriginationMessageId.get(
                    SANITIZED_GENERATED_DOCUMENT_ENTRY.origination_message_id
                )
            ).toHaveLength(1);

            expect(
                index!.byOriginationThreadId.get(
                    SANITIZED_GENERATED_IMAGE_ENTRY.origination_thread_id
                )
            ).toHaveLength(1);

            // Plain upload has no origination ids at all.
            expect(
                [...index!.byOriginationThreadId.values()].flat()
            ).not.toContainEqual(
                expect.objectContaining({
                    fileId: SANITIZED_PLAIN_UPLOAD_ENTRY.file_id,
                })
            );
        });

        it("parses createdAt from created_at when present", async () => {
            const index = await buildChatGPTLibraryIndex(zip);
            const entry = index!.byFileId.get(
                SANITIZED_GENERATED_IMAGE_ENTRY.file_id
            );
            expect(entry?.createdAt).toBe(
                Date.parse(SANITIZED_GENERATED_IMAGE_ENTRY.created_at)
            );
        });

        it("falls back to version_created_at when created_at and record_creation_time are missing", async () => {
            const index = await buildChatGPTLibraryIndex(zip);
            const entry = index!.byFileId.get(
                SANITIZED_MISSING_CREATED_AT_ENTRY.file_id
            );
            expect(entry?.createdAt).toBe(
                Date.parse(
                    SANITIZED_MISSING_CREATED_AT_ENTRY.version_created_at
                )
            );
        });

        it("captures libraryFileId from the nested id.id field", async () => {
            const index = await buildChatGPTLibraryIndex(zip);
            const entry = index!.byFileId.get(
                SANITIZED_GENERATED_IMAGE_ENTRY.file_id
            );
            expect(entry?.libraryFileId).toBe(
                SANITIZED_GENERATED_IMAGE_ENTRY.id.id
            );
        });
    });
});

describe("classifyChatGPTLibraryArtifact", () => {
    function entryFor(fileId: string): ChatGPTLibraryEntry {
        const raw = SANITIZED_LIBRARY_FILES_SAMPLE.find(
            (e) => e.file_id === fileId
        )!;
        return {
            fileId: raw.file_id,
            fileName: raw.file_name,
            mimeType: raw.mime_type,
            artifactType: raw.library_artifact_type ?? undefined,
            originationMessageId: raw.origination_message_id ?? undefined,
            originationThreadId: raw.origination_thread_id ?? undefined,
            imageGenerationId: raw.image_gen_generation_id ?? undefined,
        };
    }

    it("classifies a generated image (image_gen_generation_id present) correctly", () => {
        expect(
            classifyChatGPTLibraryArtifact(
                entryFor(SANITIZED_GENERATED_IMAGE_ENTRY.file_id)
            )
        ).toBe("generated_image");
    });

    it("classifies a generated report document correctly", () => {
        expect(
            classifyChatGPTLibraryArtifact(
                entryFor(SANITIZED_GENERATED_DOCUMENT_ENTRY.file_id)
            )
        ).toBe("generated_document");
    });

    it("does not classify a writing_block as generated (already on its own message)", () => {
        expect(
            classifyChatGPTLibraryArtifact(
                entryFor(SANITIZED_WRITING_BLOCK_ENTRY.file_id)
            )
        ).toBe("unsupported");
    });

    it("does not classify a plain upload as generated", () => {
        expect(
            classifyChatGPTLibraryArtifact(
                entryFor(SANITIZED_PLAIN_UPLOAD_ENTRY.file_id)
            )
        ).toBe("unsupported");
    });

    it("ignores an unknown artifact type without throwing, and logs it at debug level", () => {
        const debug = vi.fn();
        const log = { debug } as unknown as ScopedLogger;

        const result = classifyChatGPTLibraryArtifact(
            entryFor(SANITIZED_UNKNOWN_ARTIFACT_TYPE_ENTRY.file_id),
            log
        );

        expect(result).toBe("unsupported");
        expect(debug).toHaveBeenCalledTimes(1);
    });

    it("does not log for known non-generated types (writing_block, plain upload)", () => {
        const debug = vi.fn();
        const log = { debug } as unknown as ScopedLogger;

        classifyChatGPTLibraryArtifact(
            entryFor(SANITIZED_WRITING_BLOCK_ENTRY.file_id),
            log
        );
        classifyChatGPTLibraryArtifact(
            entryFor(SANITIZED_PLAIN_UPLOAD_ENTRY.file_id),
            log
        );

        expect(debug).not.toHaveBeenCalled();
    });

    it("defaults to the module logger when none is supplied", () => {
        // Real Logger instance, default log level (warn) — debug() is a no-op
        // but must not throw.
        expect(() =>
            classifyChatGPTLibraryArtifact(
                entryFor(SANITIZED_UNKNOWN_ARTIFACT_TYPE_ENTRY.file_id),
                new Logger().child("Test")
            )
        ).not.toThrow();
    });
});
