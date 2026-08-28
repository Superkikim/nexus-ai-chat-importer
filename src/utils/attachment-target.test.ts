import { describe, expect, it } from "vitest";
import {
    AttachmentFileReader,
    resolveAttachmentTarget,
} from "./attachment-target";

function vaultWith(files: Record<string, number[]>): AttachmentFileReader {
    return {
        exists: async (p: string) => p in files,
        readBinary: async (p: string) => {
            if (!(p in files)) throw new Error(`missing: ${p}`);
            return new Uint8Array(files[p]).buffer;
        },
    };
}

const bytes = (...values: number[]) => new Uint8Array(values);

describe("resolveAttachmentTarget", () => {
    it("takes the path when nothing occupies it", async () => {
        const path = await resolveAttachmentTarget(
            vaultWith({}),
            "att/img.png",
            bytes(1, 2, 3)
        );

        expect(path).toBe("att/img.png");
    });

    it("reuses the file already holding those exact bytes", async () => {
        // The rebuild case: re-extracting an attachment must re-link the note
        // to the copy the vault already has, not write img_1.png beside it.
        const path = await resolveAttachmentTarget(
            vaultWith({ "att/img.png": [1, 2, 3] }),
            "att/img.png",
            bytes(1, 2, 3)
        );

        expect(path).toBe("att/img.png");
    });

    it("steps aside for a different file of the same size", async () => {
        // Same length, different content: a size check alone would have
        // silently overwritten someone else's attachment.
        const path = await resolveAttachmentTarget(
            vaultWith({ "att/img.png": [9, 9, 9] }),
            "att/img.png",
            bytes(1, 2, 3)
        );

        expect(path).toBe("att/img_1.png");
    });

    it("keeps stepping until it finds the same bytes or a free name", async () => {
        const vault = vaultWith({
            "att/img.png": [9],
            "att/img_1.png": [8],
            "att/img_2.png": [1, 2, 3],
        });

        expect(
            await resolveAttachmentTarget(vault, "att/img.png", bytes(1, 2, 3))
        ).toBe("att/img_2.png");
        expect(
            await resolveAttachmentTarget(vault, "att/img.png", bytes(7))
        ).toBe("att/img_3.png");
    });

    it("suffixes an extensionless name after its own base", async () => {
        const path = await resolveAttachmentTarget(
            vaultWith({ "att/blob": [9] }),
            "att/blob",
            bytes(1)
        );

        expect(path).toBe("att/blob_1");
    });

    it("leaves an unreadable occupant alone", async () => {
        const vault: AttachmentFileReader = {
            exists: async (p) => p === "att/img.png",
            readBinary: async () => {
                throw new Error("EACCES");
            },
        };

        expect(
            await resolveAttachmentTarget(vault, "att/img.png", bytes(1))
        ).toBe("att/img_1.png");
    });
});
