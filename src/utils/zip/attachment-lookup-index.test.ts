import { describe, expect, it } from "vitest";
import { buildAttachmentLookupIndex } from "./attachment-lookup-index";

describe("buildAttachmentLookupIndex", () => {
    it("indexes exact paths, base names, file ids, and dalle ids", () => {
        const index = buildAttachmentLookupIndex([
            { path: "conversations-001.json", size: 100 },
            { path: "file-EtspPqHms32ek1BF5bG1F2-image.png", size: 200 },
            { path: "dalle-generations/file-abc123-preview.webp", size: 300 },
            { path: "attachments/file_deadbeef.dat", size: 400 },
        ]);

        expect(index.byExactPath.get("conversations-001.json")).toBe("conversations-001.json");
        expect(index.byBaseName.get("file-EtspPqHms32ek1BF5bG1F2-image.png")).toContain("file-EtspPqHms32ek1BF5bG1F2-image.png");
        expect(index.byFileId.get("file-EtspPqHms32ek1BF5bG1F2")).toContain("file-EtspPqHms32ek1BF5bG1F2-image.png");
        expect(index.byFileId.get("EtspPqHms32ek1BF5bG1F2")).toContain("file-EtspPqHms32ek1BF5bG1F2-image.png");
        expect(index.byFileId.get("file_deadbeef")).toContain("attachments/file_deadbeef.dat");
        expect(index.byDalleId.get("abc123")).toContain("dalle-generations/file-abc123-preview.webp");
    });
});
