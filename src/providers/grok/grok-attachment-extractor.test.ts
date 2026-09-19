import { beforeEach, describe, expect, it, vi } from "vitest";
import { GrokAttachmentExtractor } from "./grok-attachment-extractor";
import { StandardAttachment } from "../../types/standard";
import { ZipArchiveReader, ZipEntryHandle } from "../../utils/zip-loader";
import type NexusAiChatImporterPlugin from "../../main";
import { jpegWithTag } from "../../utils/jpeg-exif.fixture";

const JPEG_BYTES = new Uint8Array([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
]);
const PDF_BYTES = new Uint8Array([
    0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a, 0x00, 0x00, 0x00,
]);

const ASSETS = "ttl/30d/export_data/u1/prod-mc-asset-server/";

function createZipMock(files: Record<string, Uint8Array>): ZipArchiveReader {
    const handle = (name: string, bytes: Uint8Array): ZipEntryHandle => ({
        name,
        readBytes: async () => bytes,
        readText: async () => new TextDecoder().decode(bytes),
    });
    return {
        listEntries: async () =>
            Object.entries(files).map(([path, bytes]) => ({
                path,
                size: bytes.byteLength,
            })),
        has: (name: string) => name in files,
        get: (name: string) =>
            name in files ? handle(name, files[name]) : null,
    };
}

function createPluginMock() {
    const written = new Map<string, ArrayBuffer>();
    const folders = new Set<string>();
    const plugin = {
        settings: { attachmentFolder: "attachments" },
        logger: { warn: vi.fn(), error: vi.fn() },
        app: {
            vault: {
                getAbstractFileByPath: (path: string) =>
                    folders.has(path) ? { path } : null,
                createFolder: async (path: string) => {
                    folders.add(path);
                },
                adapter: {
                    exists: async (path: string) => written.has(path),
                    readBinary: async (path: string) => written.get(path)!,
                    writeBinary: async (path: string, data: ArrayBuffer) => {
                        written.set(path, data);
                    },
                },
            },
        },
    };
    return {
        plugin: plugin as unknown as NexusAiChatImporterPlugin,
        written,
    };
}

const CONVERSATION_ID = "6ff87162-ac88-4b61-996e-9d11280e7bf1";
const CHAT_URL = `https://grok.com/c/${CONVERSATION_ID}`;

describe("GrokAttachmentExtractor", () => {
    let mock: ReturnType<typeof createPluginMock>;
    let extractor: GrokAttachmentExtractor;

    beforeEach(() => {
        mock = createPluginMock();
        extractor = new GrokAttachmentExtractor(
            mock.plugin,
            mock.plugin.logger
        );
    });

    it("writes an upload under a name built from the ids and the detected type", async () => {
        const zip = createZipMock({
            // Grok's paths carry a doubled slash before the asset id.
            [`${ASSETS}/8daf320f-73fb-47cf-b21a-b25e1da2aa39/content`]:
                JPEG_BYTES,
        });
        const upload: StandardAttachment = {
            fileName: "8daf320f-73fb-47cf-b21a-b25e1da2aa39",
            fileId: "8daf320f-73fb-47cf-b21a-b25e1da2aa39",
            attachmentType: "file",
            url: CHAT_URL,
        };

        const [result] = await extractor.extractAttachments(
            zip,
            CONVERSATION_ID,
            [upload],
            "da30493c-0000"
        );

        const path =
            "attachments/grok/images/grok_6ff87162_da30493c_8daf320f.jpg";
        expect(result.status).toEqual({
            processed: true,
            found: true,
            localPath: path,
        });
        expect(result.url).toBe(path);
        expect(result.fileName).toBe("grok_6ff87162_da30493c_8daf320f.jpg");
        expect(result.fileType).toBe("image/jpeg");
        expect(mock.written.has(path)).toBe(true);
    });

    it("files a PDF under documents", async () => {
        const zip = createZipMock({
            [`${ASSETS}aaaaaaaa-0000/content`]: PDF_BYTES,
        });

        const [result] = await extractor.extractAttachments(
            zip,
            CONVERSATION_ID,
            [{ fileName: "aaaaaaaa-0000", fileId: "aaaaaaaa-0000" }],
            "m1"
        );

        expect(result.url).toBe(
            "attachments/grok/documents/grok_6ff87162_m1_aaaaaaaa.pdf"
        );
    });

    it("marks a missing upload and keeps the link to the conversation", async () => {
        const [result] = await extractor.extractAttachments(
            createZipMock({}),
            CONVERSATION_ID,
            [
                {
                    fileName: "gone",
                    fileId: "gone",
                    attachmentType: "file",
                    url: CHAT_URL,
                },
            ],
            "m1"
        );

        expect(result.url).toBe(CHAT_URL);
        expect(result.status?.found).toBe(false);
        expect(result.status?.reason).toBe("missing_from_export");
    });

    it("gives a missing Imagine image a placeholder linking to its post", async () => {
        const postUrl = "https://grok.com/imagine/post/p1";
        const [result] = await extractor.extractAttachments(
            createZipMock({}),
            "p1",
            [
                {
                    fileName: "p1",
                    fileId: "p1",
                    attachmentType: "generated_image",
                    generationPrompt: "a cat",
                    url: postUrl,
                    providerMetadata: { imaginePost: true, mediaType: "image" },
                },
            ],
            "p1-media"
        );

        expect(result.status?.reason).toBe("not_in_export");
        expect(result.generationPrompt).toBe("a cat");
        expect(result.extractedContent).toContain(
            "**Generated image — not in export**"
        );
        expect(result.extractedContent).toContain(
            `[Open original](${postUrl})`
        );
        // The prompt is the note's first message; it is not repeated here.
        expect(result.extractedContent).not.toContain("Image prompt");
    });

    it("names a missing Imagine video as a video", async () => {
        const [result] = await extractor.extractAttachments(
            createZipMock({}),
            "p2",
            [
                {
                    fileName: "p2",
                    fileId: "p2",
                    url: "https://grok.com/imagine/post/p2",
                    providerMetadata: { imaginePost: true, mediaType: "video" },
                },
            ],
            "p2-media"
        );

        expect(result.extractedContent).toContain(
            "**Generated video — not in export**"
        );
        expect(result.extractedContent).toContain(
            "this export did not include the generated video"
        );
    });

    describe("Imagine media", () => {
        const POST = "b2d2143f-4e28-43fd-9a7a-8698bfd0c76a";
        const media: StandardAttachment = {
            fileName: POST,
            fileId: POST,
            attachmentType: "generated_image",
            generationPrompt: "a night street",
            url: `https://grok.com/imagine/post/${POST}`,
            providerMetadata: { imaginePost: true, mediaType: "image" },
        };

        async function resolve(files: Record<string, Uint8Array>) {
            return extractor.extractAttachments(
                createZipMock(files),
                POST,
                [media],
                `${POST}-media`
            );
        }

        it("uses the asset named after the post", async () => {
            const results = await resolve({
                [`${ASSETS}${POST}/content`]: JPEG_BYTES,
            });

            expect(results).toHaveLength(1);
            expect(results[0].status?.found).toBe(true);
            expect(results[0].attachmentType).toBe("generated_image");
        });

        it("finds the variants signed with the post id", async () => {
            const results = await resolve({
                [`${ASSETS}/3a747abd-0000/content`]: jpegWithTag(POST),
                [`${ASSETS}/b8c56377-0000/content`]: jpegWithTag(POST),
                [`${ASSETS}/ffffffff-0000/content`]: jpegWithTag("other-post"),
                [`${ASSETS}/eeeeeeee-0000/content`]: JPEG_BYTES,
            });

            expect(results.map((r) => r.url)).toEqual([
                "attachments/grok/images/grok_b2d2143f_b2d2143f_3a747abd.jpg",
                "attachments/grok/images/grok_b2d2143f_b2d2143f_b8c56377.jpg",
            ]);
            expect(results.every((r) => r.generationPrompt)).toBe(true);
        });

        it("puts the post's own asset before its variants", async () => {
            const results = await resolve({
                [`${ASSETS}/00000000-variant/content`]: jpegWithTag(POST),
                [`${ASSETS}/${POST}/content`]: JPEG_BYTES,
            });

            expect(results.map((r) => r.url)).toEqual([
                "attachments/grok/images/grok_b2d2143f_b2d2143f_b2d2143f.jpg",
                "attachments/grok/images/grok_b2d2143f_b2d2143f_00000000.jpg",
            ]);
        });

        it("falls back to the placeholder when nothing matches", async () => {
            const results = await resolve({
                [`${ASSETS}/ffffffff-0000/content`]: jpegWithTag("other-post"),
            });

            expect(results).toHaveLength(1);
            expect(results[0].status?.reason).toBe("not_in_export");
        });
    });
});
