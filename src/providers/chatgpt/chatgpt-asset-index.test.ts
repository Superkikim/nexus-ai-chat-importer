import { describe, expect, it } from "vitest";
import { buildChatGPTAssetIndex } from "./chatgpt-asset-index";
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
    };
}

describe("buildChatGPTAssetIndex", () => {
    it("returns null when conversation_asset_file_names.json is absent (old format)", async () => {
        const zip = createZipMock({ "conversations.json": "[]" });
        expect(await buildChatGPTAssetIndex(zip)).toBeNull();
    });

    it("returns null for malformed JSON without throwing", async () => {
        const zip = createZipMock({
            "conversation_asset_file_names.json": "{ not json",
        });
        expect(await buildChatGPTAssetIndex(zip)).toBeNull();
    });

    it("returns null when JSON is not an object", async () => {
        const zip = createZipMock({
            "conversation_asset_file_names.json": '["a", "b"]',
        });
        expect(await buildChatGPTAssetIndex(zip)).toBeNull();
    });

    it("indexes file-<base62>.dat entries with original filename", async () => {
        const zip = createZipMock({
            "conversation_asset_file_names.json": JSON.stringify({
                "file-12aRihqTCNon1VFE6ZpQqx.dat":
                    "Screenshot_20250827_125754.jpg",
            }),
        });
        const index = await buildChatGPTAssetIndex(zip);
        const entry = index!.byFileId.get("file-12aRihqTCNon1VFE6ZpQqx");
        expect(entry).toBeDefined();
        expect(entry!.datPath).toBe("file-12aRihqTCNon1VFE6ZpQqx.dat");
        expect(entry!.displayName).toBe("Screenshot_20250827_125754.jpg");
        expect(entry!.isDalle).toBe(false);
        expect(entry!.isAudio).toBe(false);
    });

    it("indexes file_<hex>.dat entries (sediment scheme)", async () => {
        const zip = createZipMock({
            "conversation_asset_file_names.json": JSON.stringify({
                "file_00000000aad871f49969859f2bccd6cb.dat":
                    "c130441a-a12b-43d3-89df-71da1c01ffb3.png",
            }),
        });
        const index = await buildChatGPTAssetIndex(zip);
        const entry = index!.byFileId.get(
            "file_00000000aad871f49969859f2bccd6cb"
        );
        expect(entry).toBeDefined();
        expect(entry!.displayName).toBe(
            "c130441a-a12b-43d3-89df-71da1c01ffb3.png"
        );
    });

    it("flags dalle-generations values and uses their basename", async () => {
        const zip = createZipMock({
            "conversation_asset_file_names.json": JSON.stringify({
                "file-0HDUFW2JaMMvCvhqOQsPCGxF.dat":
                    "dalle-generations/bdd53f7d-8240-47c6-9a5d-091f78dbaf75.webp",
            }),
        });
        const index = await buildChatGPTAssetIndex(zip);
        const entry = index!.byFileId.get("file-0HDUFW2JaMMvCvhqOQsPCGxF");
        expect(entry!.isDalle).toBe(true);
        expect(entry!.displayName).toBe(
            "bdd53f7d-8240-47c6-9a5d-091f78dbaf75.webp"
        );
    });

    it("flags voice recordings stored under <conv-uuid>/audio/<uuid>.wav", async () => {
        const zip = createZipMock({
            "conversation_asset_file_names.json": JSON.stringify({
                "file_0000000005987246b06f11c12c4e779f.dat":
                    "6a1c1a89-9b9c-83eb-81b2-46226805d7b3/audio/c8a38444-9b69-44f0-8c15-2be00dcd875e.wav",
            }),
        });
        const index = await buildChatGPTAssetIndex(zip);
        const entry = index!.byFileId.get(
            "file_0000000005987246b06f11c12c4e779f"
        );
        expect(entry!.isAudio).toBe(true);
        expect(entry!.isDalle).toBe(false);
    });

    it("keeps bare uuid values without extension as-is", async () => {
        const zip = createZipMock({
            "conversation_asset_file_names.json": JSON.stringify({
                "file-111aDjU1njXUJLNmUUSD4F.dat":
                    "9f8a1380-40e1-457a-8d88-742adc20908b",
            }),
        });
        const index = await buildChatGPTAssetIndex(zip);
        const entry = index!.byFileId.get("file-111aDjU1njXUJLNmUUSD4F");
        expect(entry!.displayName).toBe(
            "9f8a1380-40e1-457a-8d88-742adc20908b"
        );
        expect(entry!.isAudio).toBe(false);
    });

    it("indexes ids both with and without the file prefix", async () => {
        const zip = createZipMock({
            "conversation_asset_file_names.json": JSON.stringify({
                "file-12aRihqTCNon1VFE6ZpQqx.dat": "photo.jpg",
                "file_00000000aad871f49969859f2bccd6cb.dat": "image.png",
            }),
        });
        const index = await buildChatGPTAssetIndex(zip);
        expect(index!.byFileId.get("12aRihqTCNon1VFE6ZpQqx")).toBeDefined();
        expect(
            index!.byFileId.get("00000000aad871f49969859f2bccd6cb")
        ).toBeDefined();
        expect(index!.byFileId.get("12aRihqTCNon1VFE6ZpQqx")!.datPath).toBe(
            "file-12aRihqTCNon1VFE6ZpQqx.dat"
        );
    });
});
