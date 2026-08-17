import { describe, expect, it, vi } from "vitest";
import JSZip from "jszip";
import {
    expandOpenAiPrivacyPortalArchives,
    includeOpenAiPrivacyPortalFileArchives,
    ZipReaderFactory,
} from "./privacy-portal-archive";
import {
    createZipArchiveReader,
    ZipArchiveReader,
    ZipEntryHandle,
    ZipEntryMeta,
} from "./zip-loader";
import { classifyArchiveEntries } from "./zip-content-reader";

class MemoryEntry implements ZipEntryHandle {
    constructor(readonly name: string, private readonly bytes: Uint8Array) {}

    async readText(): Promise<string> {
        return new TextDecoder().decode(this.bytes);
    }

    async readBytes(): Promise<Uint8Array> {
        return this.bytes;
    }
}

class MemoryReader implements ZipArchiveReader {
    constructor(private readonly entries: Record<string, Uint8Array>) {}

    async listEntries(): Promise<ZipEntryMeta[]> {
        return Object.entries(this.entries).map(([path, bytes]) => ({
            path,
            size: bytes.byteLength,
        }));
    }

    has(name: string): boolean {
        return Object.prototype.hasOwnProperty.call(this.entries, name);
    }

    get(name: string): ZipEntryHandle | null {
        const bytes = this.entries[name];
        return bytes ? new MemoryEntry(name, bytes) : null;
    }
}

function createFile(name: string, lastModified = 123): File {
    return new File([new Uint8Array([1])], name, {
        type: "application/zip",
        lastModified,
    });
}

class ArrayBufferFileReader {
    result: ArrayBuffer | null = null;
    error: Error | null = null;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;

    readAsArrayBuffer(blob: Blob): void {
        void blob.arrayBuffer().then(
            (buffer) => {
                this.result = buffer;
                this.onload?.();
            },
            (error: unknown) => {
                this.error =
                    error instanceof Error ? error : new Error(String(error));
                this.onerror?.();
            }
        );
    }
}

describe("OpenAI Privacy Portal archive expansion", () => {
    it("leaves ordinary ChatGPT exports untouched without opening them", async () => {
        const file = createFile("chatgpt-export.zip");
        const readerFactory = vi.fn<ZipReaderFactory>();

        const result = await expandOpenAiPrivacyPortalArchives(
            [file],
            readerFactory
        );

        expect(result.files).toEqual([file]);
        expect(result.expandedContainerNames).toEqual([]);
        expect(readerFactory).not.toHaveBeenCalled();
    });

    it("replaces a Privacy Portal container with its conversation and file archives", async () => {
        const outer = createFile("chatgpt_archive_account.zip", 456);
        const conversationName = "Conversations_account-chatgpt-0001.zip";
        const filesName = "Files_account-files-0001.zip";
        const outerReader = new MemoryReader({
            [`User Online Activity/${conversationName}`]: new Uint8Array([2]),
            [`User Online Activity/${filesName}`]: new Uint8Array([3]),
            "report.html": new Uint8Array([4]),
        });
        const conversationReader = new MemoryReader({
            "conversations.json": new TextEncoder().encode("[]"),
        });
        const filesReader = new MemoryReader({
            "file-abc-document.pdf": new Uint8Array([5]),
        });
        const readerFactory = vi.fn<ZipReaderFactory>(async (file) => {
            if (file === outer) return outerReader;
            if (file.name === conversationName) return conversationReader;
            if (file.name === filesName) return filesReader;
            throw new Error(`Unexpected file: ${file.name}`);
        });

        const result = await expandOpenAiPrivacyPortalArchives(
            [outer],
            readerFactory
        );

        expect(result.files.map((file) => file.name)).toEqual([
            conversationName,
            filesName,
        ]);
        expect(result.files.every((file) => file.lastModified === 456)).toBe(
            true
        );
        expect(result.expandedContainerNames).toEqual([outer.name]);
    });

    it("keeps the outer archive when no valid ChatGPT conversation archive is found", async () => {
        const outer = createFile("chatgpt_archive_account.zip");
        const conversationName = "Conversations_account-chatgpt-0001.zip";
        const outerReader = new MemoryReader({
            [`User Online Activity/${conversationName}`]: new Uint8Array([2]),
        });
        const invalidInnerReader = new MemoryReader({
            "unrelated.json": new TextEncoder().encode("{}"),
        });
        const readerFactory = vi.fn<ZipReaderFactory>(async (file) =>
            file === outer ? outerReader : invalidInnerReader
        );

        const result = await expandOpenAiPrivacyPortalArchives(
            [outer],
            readerFactory
        );

        expect(result.files).toEqual([outer]);
        expect(result.expandedContainerNames).toEqual([]);
    });

    it("does not reserve inner filenames when an earlier container fails validation", async () => {
        const invalidOuter = createFile("chatgpt_archive_invalid.zip", 1);
        const validOuter = createFile("chatgpt_archive_valid.zip", 2);
        const conversationName = "Conversations_account-chatgpt-0001.zip";
        const outerReader = new MemoryReader({
            [`User Online Activity/${conversationName}`]: new Uint8Array([2]),
        });
        const invalidInnerReader = new MemoryReader({
            "unrelated.json": new TextEncoder().encode("{}"),
        });
        const validInnerReader = new MemoryReader({
            "conversations.json": new TextEncoder().encode("[]"),
        });
        const readerFactory = vi.fn<ZipReaderFactory>(async (file) => {
            if (file === invalidOuter || file === validOuter) {
                return outerReader;
            }
            return file.lastModified === 1
                ? invalidInnerReader
                : validInnerReader;
        });

        const result = await expandOpenAiPrivacyPortalArchives(
            [invalidOuter, validOuter],
            readerFactory
        );

        expect(result.files.map((file) => file.name)).toEqual([
            invalidOuter.name,
            conversationName,
        ]);
        expect(result.expandedContainerNames).toEqual([validOuter.name]);
    });

    it("includes Privacy Portal file archives in attachment lookup without duplicating imports", () => {
        const conversations = createFile(
            "Conversations_account-chatgpt-0001.zip"
        );
        const attachments = createFile("Files_account-files-0001.zip");

        expect(
            includeOpenAiPrivacyPortalFileArchives(
                [conversations],
                [conversations, attachments]
            )
        ).toEqual([conversations, attachments]);
        expect(
            includeOpenAiPrivacyPortalFileArchives(
                [conversations, attachments],
                [conversations, createFile("Files_account-files-0001.zip")]
            )
        ).toEqual([conversations, attachments]);
    });

    it("produces inner files that remain readable by the real ZIP reader", async () => {
        const conversationName = "Conversations_account-chatgpt-0001.zip";
        const innerZip = new JSZip();
        innerZip.file("conversations.json", "[]");
        const innerBytes = await innerZip.generateAsync({
            type: "uint8array",
            compression: "DEFLATE",
        });

        const outerZip = new JSZip();
        outerZip.file(`User Online Activity/${conversationName}`, innerBytes);
        outerZip.file("report.html", "<html></html>");
        const outerBytes = await outerZip.generateAsync({
            type: "uint8array",
            compression: "DEFLATE",
        });
        const outerFile = new File(
            [
                outerBytes.buffer.slice(
                    outerBytes.byteOffset,
                    outerBytes.byteOffset + outerBytes.byteLength
                ) as ArrayBuffer,
            ],
            "chatgpt_archive_account.zip",
            { type: "application/zip" }
        );
        vi.stubGlobal("FileReader", ArrayBufferFileReader);

        try {
            const result = await expandOpenAiPrivacyPortalArchives([outerFile]);
            expect(result.files.map((file) => file.name)).toEqual([
                conversationName,
            ]);

            const reader = await createZipArchiveReader(result.files[0]);
            const entries = await reader.listEntries();
            expect(
                classifyArchiveEntries(entries.map((entry) => entry.path))
            ).toMatchObject({
                supported: true,
                provider: "chatgpt",
            });
        } finally {
            vi.unstubAllGlobals();
        }
    });
});
