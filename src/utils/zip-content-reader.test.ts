import { describe, expect, it } from "vitest";
import { classifyArchiveEntries, extractConversationsStream, extractRawConversations } from "./zip-content-reader";
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

    it("extracts Perplexity thread JSON files", async () => {
        const reader = new MemoryZipReader({
            "perplexity_selected_0001_test.json": JSON.stringify({
                metadata: { thread_id: "t1", thread_title: "Thread 1" },
                conversations: [{ uuid: "u1", query: "Q", answer: "A" }],
            }),
            "perplexity_selected_0002_test.json": JSON.stringify({
                metadata: { thread_id: "t2", thread_title: "Thread 2" },
                conversations: [{ uuid: "u2", query: "Q2", answer: "A2" }],
            }),
        });

        const result = await extractRawConversations(reader);

        expect(result.conversations).toHaveLength(2);
        expect(result.conversations.map(conv => conv.metadata.thread_id)).toEqual(["t1", "t2"]);
    });

    it("streams Perplexity thread JSON one file at a time", async () => {
        const reader = new MemoryZipReader({
            "perplexity_selected_0001_test.json": JSON.stringify({
                metadata: { thread_id: "t1", thread_title: "Thread 1" },
                conversations: [{ uuid: "u1", query: "Q", answer: "A" }],
            }),
            "perplexity_selected_0002_test.json": JSON.stringify({
                metadata: { thread_id: "t2", thread_title: "Thread 2" },
                conversations: [{ uuid: "u2", query: "Q2", answer: "A2" }],
            }),
        });

        const ids: string[] = [];
        for await (const conversation of extractConversationsStream(reader)) {
            ids.push(conversation.metadata.thread_id);
        }

        expect(ids).toEqual(["t1", "t2"]);
    });

    it("extracts Perplexity entries[] JSON files", async () => {
        const reader = new MemoryZipReader({
            "perplexity_entries_0001.json": JSON.stringify({
                status: "success",
                thread_metadata: {
                    title: "Entries Thread",
                },
                entries: [
                    {
                        uuid: "entry-1",
                        thread_url_slug: "entries-thread-abc",
                        query_str: "Question?",
                        blocks: [
                            {
                                markdown_block: {
                                    answer: "Answer text",
                                },
                            },
                        ],
                    },
                ],
            }),
        });

        const result = await extractRawConversations(reader);

        expect(result.conversations).toHaveLength(1);
        expect(Array.isArray(result.conversations[0].entries)).toBe(true);
    });

    it("streams Perplexity entries[] JSON one file at a time", async () => {
        const reader = new MemoryZipReader({
            "perplexity_entries_0001.json": JSON.stringify({
                status: "success",
                entries: [
                    {
                        uuid: "entry-1",
                        thread_url_slug: "entries-thread-abc",
                        query_str: "Question?",
                        blocks: [
                            {
                                markdown_block: {
                                    answer: "Answer text",
                                },
                            },
                        ],
                    },
                ],
            }),
        });

        const streamed: any[] = [];
        for await (const conversation of extractConversationsStream(reader)) {
            streamed.push(conversation);
        }

        expect(streamed).toHaveLength(1);
        expect(Array.isArray(streamed[0].entries)).toBe(true);
    });

    it("classifies nested ZIP containers with a dedicated guidance message", () => {
        const classification = classifyArchiveEntries([
            "perplexity_export_1777357714391_part1of3.zip",
            "perplexity_export_1777357714391_part2of3.zip",
            "perplexity_export_1777357714391_part3of3.zip",
        ], "perplexity");

        expect(classification.supported).toBe(false);
        if (classification.supported) return;
        expect(classification.reason).toBe("nested-zip-container");
        expect(classification.message).toContain("Extract the outer ZIP");
    });
});
