import { describe, expect, it } from "vitest";
import { sliceStoredZipEntry } from "./nested-zip-slice";
import { createZipArchiveReader } from "./index";
import { buildZip, buildInnerExport, toFile } from "../../tests/zip-fixtures";

async function bytesOf(file: File): Promise<Uint8Array> {
    return new Uint8Array(await file.arrayBuffer());
}

describe("sliceStoredZipEntry", () => {
    it("returns the inner archive byte-for-byte without copying it", async () => {
        const inner = await buildInnerExport();
        const container = await buildZip([
            {
                name: "report.html",
                data: new TextEncoder().encode("<h2>Hi</h2>"),
            },
            {
                name: "User Online Activity/Conversations__x-chatgpt-0001.zip",
                data: inner,
            },
        ]);

        const sliced = await sliceStoredZipEntry(
            toFile(container, "OpenAI-export.zip"),
            "User Online Activity/Conversations__x-chatgpt-0001.zip"
        );

        expect(sliced).not.toBeNull();
        expect(sliced?.name).toBe("Conversations__x-chatgpt-0001.zip");
        expect(sliced?.size).toBe(inner.length);
        expect(await bytesOf(sliced as File)).toEqual(inner);
    });

    it("produces a slice the production reader can open", async () => {
        const inner = await buildInnerExport();
        const container = await buildZip([
            { name: "nested/Conversations__x-chatgpt-0001.zip", data: inner },
        ]);

        const sliced = await sliceStoredZipEntry(
            toFile(container, "container.zip"),
            "nested/Conversations__x-chatgpt-0001.zip"
        );

        const reader = await createZipArchiveReader(sliced as File);
        const paths = (await reader.listEntries()).map((entry) => entry.path);
        expect(paths).toContain("conversations.json");

        const text = await reader.get("conversations.json")?.readText();
        expect(JSON.parse(text as string)).toEqual([
            { id: "abc", title: "Hello" },
        ]);
    });

    it("reads the data offset from the local header, not the central directory", async () => {
        const inner = await buildInnerExport();
        const container = await buildZip([
            {
                name: "nested/Conversations__x-chatgpt-0001.zip",
                data: inner,
                // Central directory declares no extra field; the local header
                // declares 12 bytes. Trusting the wrong one shifts the offset.
                localExtra: new Uint8Array(12),
            },
        ]);

        const sliced = await sliceStoredZipEntry(
            toFile(container, "container.zip"),
            "nested/Conversations__x-chatgpt-0001.zip"
        );

        expect(await bytesOf(sliced as File)).toEqual(inner);
    });

    it("returns null when the nested archive is compressed", async () => {
        const inner = await buildInnerExport();
        const container = await buildZip([
            {
                name: "nested/Conversations__x-chatgpt-0001.zip",
                data: inner,
                compress: true,
            },
        ]);

        const sliced = await sliceStoredZipEntry(
            toFile(container, "container.zip"),
            "nested/Conversations__x-chatgpt-0001.zip"
        );

        expect(sliced).toBeNull();
    });

    it("returns null when the entry is absent", async () => {
        const container = await buildZip([
            { name: "report.html", data: new TextEncoder().encode("hi") },
        ]);

        const sliced = await sliceStoredZipEntry(
            toFile(container, "container.zip"),
            "missing.zip"
        );

        expect(sliced).toBeNull();
    });
});
