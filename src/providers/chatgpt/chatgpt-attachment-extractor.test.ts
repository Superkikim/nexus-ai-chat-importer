import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChatGPTAttachmentExtractor } from "./chatgpt-attachment-extractor";
import { StandardAttachment } from "../../types/standard";
import { ZipArchiveReader, ZipEntryHandle } from "../../utils/zip-loader";

const PNG_BYTES = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00,
]);
const JPEG_BYTES = new Uint8Array([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
]);
const PDF_BYTES = new Uint8Array([
    0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a, 0x00, 0x00, 0x00,
]);
const WAV_BYTES = new Uint8Array([
    0x52, 0x49, 0x46, 0x46, 0x26, 0x2d, 0x02, 0x00, 0x57, 0x41, 0x56, 0x45,
]);
const WEBP_BYTES = new Uint8Array([
    0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
]);

function createZipMock(
    files: Record<string, Uint8Array | string>
): ZipArchiveReader {
    const encoder = new TextEncoder();
    const asBytes = (content: Uint8Array | string): Uint8Array =>
        typeof content === "string" ? encoder.encode(content) : content;

    const makeHandle = (
        name: string,
        content: Uint8Array | string
    ): ZipEntryHandle => ({
        name,
        readBytes: async () => asBytes(content),
        readText: async () => new TextDecoder().decode(asBytes(content)),
    });

    return {
        listEntries: async () =>
            Object.entries(files).map(([path, content]) => ({
                path,
                size: asBytes(content).byteLength,
            })),
        has: (name: string) => name in files,
        get: (name: string) =>
            name in files ? makeHandle(name, files[name]) : null,
    };
}

interface PluginMock {
    plugin: unknown;
    writtenFiles: Map<string, ArrayBuffer>;
}

function createPluginMock(): PluginMock {
    const writtenFiles = new Map<string, ArrayBuffer>();
    const folders = new Set<string>();

    const plugin = {
        settings: { attachmentFolder: "attachments" },
        logger: { warn: vi.fn(), error: vi.fn() },
        getFileService: () => ({
            getFileExtension: (fileName: string) => {
                const lastDot = fileName.lastIndexOf(".");
                return lastDot === -1
                    ? ""
                    : fileName.substring(lastDot + 1).toLowerCase();
            },
        }),
        app: {
            vault: {
                getAbstractFileByPath: (path: string) =>
                    folders.has(path) ? { path } : null,
                createFolder: async (path: string) => {
                    folders.add(path);
                },
                adapter: {
                    exists: async (path: string) => writtenFiles.has(path),
                    writeBinary: async (path: string, data: ArrayBuffer) => {
                        writtenFiles.set(path, data);
                    },
                },
            },
        },
    };

    return { plugin, writtenFiles };
}

function createExtractor(mock: PluginMock): ChatGPTAttachmentExtractor {
    return new ChatGPTAttachmentExtractor(mock.plugin, mock.plugin.logger);
}

const NEW_FORMAT_INDEX = JSON.stringify({
    "file-12aRihqTCNon1VFE6ZpQqx.dat": "Screenshot_20250827_125754.jpg",
    "file_00000000aad871f49969859f2bccd6cb.dat":
        "c130441a-a12b-43d3-89df-71da1c01ffb3.png",
    "file-0HDUFW2JaMMvCvhqOQsPCGxF.dat":
        "dalle-generations/bdd53f7d-8240-47c6-9a5d-091f78dbaf75.webp",
    "file_0000000005987246b06f11c12c4e779f.dat":
        "6a1c1a89-9b9c-83eb-81b2-46226805d7b3/audio/c8a38444.wav",
    "file-111aDjU1njXUJLNmUUSD4F.dat": "9f8a1380-40e1-457a-8d88-742adc20908b",
});

describe("ChatGPTAttachmentExtractor — new 2026 export format", () => {
    let mock: PluginMock;
    let extractor: ChatGPTAttachmentExtractor;

    beforeEach(() => {
        mock = createPluginMock();
        extractor = createExtractor(mock);
    });

    it("resolves a user upload via the asset index (Strategy 0) and keeps the original name", async () => {
        const zip = createZipMock({
            "conversation_asset_file_names.json": NEW_FORMAT_INDEX,
            "file-12aRihqTCNon1VFE6ZpQqx.dat": JPEG_BYTES,
        });

        const attachment: StandardAttachment = {
            fileName: "Screenshot_20250827_125754.jpg",
            fileType: "image/jpeg",
            fileId: "file-12aRihqTCNon1VFE6ZpQqx",
        };

        const [result] = await extractor.extractAttachments(
            zip,
            "conv-1",
            [attachment],
            "msg-1"
        );

        expect(result.status?.found).toBe(true);
        expect(result.fileName).toBe("Screenshot_20250827_125754.jpg");
        expect(result.status?.localPath).toBe(
            "attachments/chatgpt/images/Screenshot_20250827_125754.jpg"
        );
        expect(mock.writtenFiles.size).toBe(1);
    });

    it("resolves <fileId>.dat directly when the file is missing from the index", async () => {
        const zip = createZipMock({
            "conversation_asset_file_names.json": NEW_FORMAT_INDEX,
            "file_000000009b8c71f4ace00c77fc58413d.dat": PDF_BYTES,
        });

        const attachment: StandardAttachment = {
            fileName: "isa0001.ocr.pdf",
            fileType: "application/pdf",
            fileId: "file_000000009b8c71f4ace00c77fc58413d",
        };

        const [result] = await extractor.extractAttachments(zip, "conv-1", [
            attachment,
        ]);

        expect(result.status?.found).toBe(true);
        expect(result.status?.localPath).toBe(
            "attachments/chatgpt/documents/isa0001.ocr.pdf"
        );
    });

    it("restores the index display name for synthetic image_<id> names", async () => {
        const zip = createZipMock({
            "conversation_asset_file_names.json": NEW_FORMAT_INDEX,
            "file_00000000aad871f49969859f2bccd6cb.dat": PNG_BYTES,
        });

        const attachment: StandardAttachment = {
            fileName:
                "image_file_00000000aad871f49969859f2bccd6cb_2048x1612.png",
            fileType: "image/png",
            fileId: "file_00000000aad871f49969859f2bccd6cb",
        };

        const [result] = await extractor.extractAttachments(zip, "conv-1", [
            attachment,
        ]);

        expect(result.status?.found).toBe(true);
        expect(result.fileName).toBe(
            "c130441a-a12b-43d3-89df-71da1c01ffb3.png"
        );
    });

    it("appends the detected extension when the original name has none (bare uuid)", async () => {
        const zip = createZipMock({
            "conversation_asset_file_names.json": NEW_FORMAT_INDEX,
            "file-111aDjU1njXUJLNmUUSD4F.dat": PNG_BYTES,
        });

        const attachment: StandardAttachment = {
            fileName: "image_file-111aDjU1njXUJLNmUUSD4F_512x512.png",
            fileType: "image/png",
            fileId: "file-111aDjU1njXUJLNmUUSD4F",
        };

        const [result] = await extractor.extractAttachments(zip, "conv-1", [
            attachment,
        ]);

        expect(result.status?.found).toBe(true);
        expect(result.fileName).toBe(
            "9f8a1380-40e1-457a-8d88-742adc20908b.png"
        );
    });

    it("resolves DALL-E images without a dalle-generations/ folder and fixes the extension", async () => {
        const zip = createZipMock({
            "conversation_asset_file_names.json": NEW_FORMAT_INDEX,
            "file-0HDUFW2JaMMvCvhqOQsPCGxF.dat": WEBP_BYTES,
        });

        const attachment: StandardAttachment = {
            fileName: "dalle_gen-abc123_1024x1024.png",
            fileType: "image/png",
            fileId: "file-0HDUFW2JaMMvCvhqOQsPCGxF",
            attachmentType: "generated_image",
            extractedContent:
                ">>[!nexus_attachment] **{{FILENAME}}** ({{FILETYPE}}) - {{FILESIZE}}\n>> ![[{{URL}}]]",
        };

        const [result] = await extractor.extractAttachments(zip, "conv-1", [
            attachment,
        ]);

        expect(result.status?.found).toBe(true);
        expect(result.fileName).toBe("dalle_gen-abc123_1024x1024.webp");
        expect(result.fileType).toBe("image/webp");
    });

    it("skips voice recordings flagged by the asset index without reading them", async () => {
        const zip = createZipMock({
            "conversation_asset_file_names.json": NEW_FORMAT_INDEX,
            "file_0000000005987246b06f11c12c4e779f.dat": WAV_BYTES,
        });

        const attachment: StandardAttachment = {
            fileName: "recording",
            fileType: "application/octet-stream",
            fileId: "file_0000000005987246b06f11c12c4e779f",
        };

        const [result] = await extractor.extractAttachments(zip, "conv-1", [
            attachment,
        ]);

        expect(result.status?.found).toBe(false);
        expect(result.status?.reason).toBe("not_in_export");
        expect(mock.writtenFiles.size).toBe(0);
    });

    it("skips WAV payloads detected by magic bytes when absent from the index", async () => {
        const zip = createZipMock({
            "conversation_asset_file_names.json": NEW_FORMAT_INDEX,
            "file_00000000ffffffffffffffffffffffff.dat": WAV_BYTES,
        });

        const attachment: StandardAttachment = {
            fileName: "mystery",
            fileType: "application/octet-stream",
            fileId: "file_00000000ffffffffffffffffffffffff",
        };

        const [result] = await extractor.extractAttachments(zip, "conv-1", [
            attachment,
        ]);

        expect(result.status?.found).toBe(false);
        expect(result.status?.reason).toBe("not_in_export");
        expect(mock.writtenFiles.size).toBe(0);
    });
});

describe("ChatGPTAttachmentExtractor — old format fallback (no index)", () => {
    let mock: PluginMock;
    let extractor: ChatGPTAttachmentExtractor;

    beforeEach(() => {
        mock = createPluginMock();
        extractor = createExtractor(mock);
    });

    it("still resolves file-<id>-<name>.ext entries via legacy strategies", async () => {
        const zip = createZipMock({
            "file-EtspPqHms32ek1BF5bG1F2-photo.png": PNG_BYTES,
        });

        const attachment: StandardAttachment = {
            fileName: "photo.png",
            fileType: "image/png",
            fileId: "file-EtspPqHms32ek1BF5bG1F2",
        };

        const [result] = await extractor.extractAttachments(zip, "conv-1", [
            attachment,
        ]);

        expect(result.status?.found).toBe(true);
        expect(result.fileName).toBe("photo.png");
    });

    it("still resolves dalle-generations/ entries via legacy strategy 2", async () => {
        const zip = createZipMock({
            "dalle-generations/file-abc123-preview.webp": WEBP_BYTES,
        });

        const attachment: StandardAttachment = {
            fileName: "dalle_gen-1_1024x1024.png",
            fileType: "image/png",
            fileId: "file-abc123",
            attachmentType: "generated_image",
        };

        const [result] = await extractor.extractAttachments(zip, "conv-1", [
            attachment,
        ]);

        expect(result.status?.found).toBe(true);
        expect(result.fileName).toBe("dalle_gen-1_1024x1024.webp");
    });

    it("reports missing files as missing_from_export", async () => {
        const zip = createZipMock({});

        const attachment: StandardAttachment = {
            fileName: "ghost.png",
            fileType: "image/png",
            fileId: "file-doesNotExist",
        };

        const [result] = await extractor.extractAttachments(zip, "conv-1", [
            attachment,
        ]);

        expect(result.status?.found).toBe(false);
        expect(result.status?.reason).toBe("missing_from_export");
    });
});
