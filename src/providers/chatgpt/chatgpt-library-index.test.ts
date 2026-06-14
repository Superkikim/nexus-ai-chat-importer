import { describe, expect, it } from "vitest";
import { buildChatGPTLibraryIndex } from "./chatgpt-library-index";
import { ZipArchiveReader, ZipEntryHandle } from "../../utils/zip-loader";

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
    } as ZipArchiveReader;
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
});
