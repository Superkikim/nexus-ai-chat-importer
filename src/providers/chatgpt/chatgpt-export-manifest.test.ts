import { describe, expect, it } from "vitest";
import { countMissingExportFiles } from "./chatgpt-export-manifest";
import { buildZip, toFile } from "../../tests/zip-fixtures";

const encoder = new TextEncoder();
const PART1_DAT = "file_00000000aaaa1111bbbb2222cccc3333.dat";
const PART2_DAT = "file_00000000dddd4444eeee5555ffff6666.dat";

async function part1(): Promise<File> {
    const manifest = {
        version: 1,
        export_files: [
            { path: "conversations-000.json", size_bytes: 2 },
            { path: PART1_DAT, size_bytes: 1 },
            { path: PART2_DAT, size_bytes: 1 },
        ],
    };
    return toFile(
        await buildZip([
            {
                name: "export_manifest.json",
                data: encoder.encode(JSON.stringify(manifest)),
            },
            { name: "conversations-000.json", data: encoder.encode("[]") },
            { name: PART1_DAT, data: new Uint8Array([1]) },
        ]),
        "export-part-0001.zip"
    );
}

async function part2(): Promise<File> {
    return toFile(
        await buildZip([{ name: PART2_DAT, data: new Uint8Array([2]) }]),
        "export-part-0002.zip"
    );
}

describe("countMissingExportFiles", () => {
    it("counts the files of a part left out of the selection", async () => {
        expect(await countMissingExportFiles([await part1()])).toBe(1);
    });

    it("finds nothing missing when every part is selected", async () => {
        expect(
            await countMissingExportFiles([await part2(), await part1()])
        ).toBe(0);
    });

    it("returns null for an export without a manifest", async () => {
        expect(await countMissingExportFiles([await part2()])).toBeNull();
    });
});
