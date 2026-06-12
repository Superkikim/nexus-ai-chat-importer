import { describe, expect, it, vi } from "vitest";
import { writeZipEntryToVault } from "./write-zip-entry-to-vault";
import { BinaryVaultTarget, ZipEntryHandle } from "./types";

function createEntry(bytes: Uint8Array): ZipEntryHandle {
    return {
        name: "file_test.dat",
        readBytes: async () => bytes,
        readText: async () => new TextDecoder().decode(bytes),
    };
}

function createVault(): BinaryVaultTarget & {
    writeBinary: ReturnType<typeof vi.fn>;
} {
    const writeBinary = vi.fn(async () => undefined);
    return { adapter: { writeBinary }, writeBinary };
}

const PNG_BYTES = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00,
]);

const WAV_BYTES = new Uint8Array([
    0x52, 0x49, 0x46, 0x46, 0x26, 0x2d, 0x02, 0x00, 0x57, 0x41, 0x56, 0x45,
]);

describe("writeZipEntryToVault", () => {
    it("writes the entry when targetPath is a string (existing behavior)", async () => {
        const vault = createVault();
        const result = await writeZipEntryToVault(
            createEntry(PNG_BYTES),
            "attachments/test.png",
            vault
        );

        expect(result.targetPath).toBe("attachments/test.png");
        expect(result.detectedExtension).toBe("png");
        expect(vault.writeBinary).toHaveBeenCalledTimes(1);
    });

    it("writes the entry when the callback returns a path", async () => {
        const vault = createVault();
        const result = await writeZipEntryToVault(
            createEntry(PNG_BYTES),
            async (detection) => `attachments/test.${detection.detectedExtension}`,
            vault
        );

        expect(result.targetPath).toBe("attachments/test.png");
        expect(vault.writeBinary).toHaveBeenCalledTimes(1);
    });

    it("cancels the write when the callback returns null", async () => {
        const vault = createVault();
        const result = await writeZipEntryToVault(
            createEntry(WAV_BYTES),
            async (detection) =>
                detection.detectedExtension === "wav" ? null : "out.bin",
            vault
        );

        expect(result.targetPath).toBeNull();
        expect(result.detectedExtension).toBe("wav");
        expect(result.detectedMimeType).toBe("audio/wav");
        expect(vault.writeBinary).not.toHaveBeenCalled();
    });
});
