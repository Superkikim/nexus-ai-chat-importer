import { describe, expect, it } from "vitest";
import { extractConversationsStream, extractRawConversations } from "./zip-content-reader";
import { ZipArchiveReader, ZipEntryHandle, ZipEntryMeta } from "./zip-loader";

class MemoryZipEntry implements ZipEntryHandle {
    readonly name: string;

    constructor(name: string, private text: string) {
        this.name = name;
    }

    async readText(): Promise<string> {
        return this.text;
    }

    async readBytes(): Promise<Uint8Array> {
        return new TextEncoder().encode(this.text);
    }

    async *readTextChunks(): AsyncGenerator<string> {
        yield this.text;
    }
}

class MemoryZipReader implements ZipArchiveReader {
    constructor(private files: Record<string, string>) {}

    async listEntries(): Promise<ZipEntryMeta[]> {
        return Object.entries(this.files).map(([path, content]) => ({
            path,
            size: content.length,
        }));
    }

    has(name: string): boolean {
        return Object.prototype.hasOwnProperty.call(this.files, name);
    }

    get(name: string): ZipEntryHandle | null {
        const content = this.files[name];
        return content === undefined ? null : new MemoryZipEntry(name, content);
    }
}

describe("zip-content-reader", () => {
    it("extracts numbered conversation files without loading attachments", async () => {
        const reader = new MemoryZipReader({
            "conversations-001.json": JSON.stringify([{ id: "c1" }]),
            "conversations-002.json": JSON.stringify([{ id: "c2" }]),
            "file-something.png": "ignored",
        });

        const result = await extractRawConversations(reader);

        expect(result.conversations).toHaveLength(2);
        expect(result.conversations.map(conv => conv.id)).toEqual(["c1", "c2"]);
    });

    it("streams legacy conversations.json one conversation at a time", async () => {
        const reader = new MemoryZipReader({
            "conversations.json": JSON.stringify([{ id: "c1" }, { id: "c2" }]),
        });

        const ids: string[] = [];
        for await (const conversation of extractConversationsStream(reader)) {
            ids.push(conversation.id);
        }

        expect(ids).toEqual(["c1", "c2"]);
    });
});
