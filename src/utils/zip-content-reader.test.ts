import { describe, expect, it } from "vitest";
import {
    classifyArchiveEntries,
    extractConversationsStream,
    extractRawConversations,
    resolveArchiveClassification,
} from "./zip-content-reader";
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
        expect(
            result.conversations.map((conv) => (conv as { id: string }).id)
        ).toEqual(["c1", "c2"]);
    });

    it("streams legacy conversations.json one conversation at a time", async () => {
        const reader = new MemoryZipReader({
            "conversations.json": JSON.stringify([{ id: "c1" }, { id: "c2" }]),
        });

        const ids: string[] = [];
        for await (const conversation of extractConversationsStream(reader)) {
            ids.push((conversation as { id: string }).id);
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
        expect(
            result.conversations.map(
                (conv) =>
                    (conv as { metadata: { thread_id: string } }).metadata
                        .thread_id
            )
        ).toEqual(["t1", "t2"]);
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
            ids.push(
                (conversation as { metadata: { thread_id: string } }).metadata
                    .thread_id
            );
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
        expect(
            Array.isArray(
                (result.conversations[0] as { entries: unknown[] }).entries
            )
        ).toBe(true);
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
        const classification = classifyArchiveEntries(
            [
                "perplexity_export_1777357714391_part1of3.zip",
                "perplexity_export_1777357714391_part2of3.zip",
                "perplexity_export_1777357714391_part3of3.zip",
            ],
            "perplexity"
        );

        expect(classification.supported).toBe(false);
        if (classification.supported) return;
        expect(classification.reason).toBe("nested-zip-container");
        expect(classification.message).toContain("Extract the outer ZIP");
    });
});

describe("resolveArchiveClassification", () => {
    const claudePayload = JSON.stringify([
        {
            uuid: "b8d77317-fbe0-469a-9286-a6809831c063",
            name: "Distinguer le scope",
            summary: "",
            created_at: "2026-08-01T10:00:00.000000+00:00",
            updated_at: "2026-08-01T10:05:00.000000+00:00",
            account: { uuid: "bcdaf9cc-43c0-4931-933d-d0f7d3f758a1" },
            chat_messages: [],
        },
    ]);

    const chatgptPayload = JSON.stringify([
        {
            conversation_id: "6a16b971-d460-83eb-bab6-87f985c39a5e",
            title: "Sample",
            create_time: 1779874163.063079,
            mapping: {},
        },
    ]);

    const claudeLegacyEntries = {
        "conversations.json": claudePayload,
        "users.json": "[]",
        "projects/6488fba7-316a-468e-b612-e1f872396d3a.json": "{}",
    };

    const chatgptEntries = {
        "chat.html": "<html></html>",
        "conversations.json": chatgptPayload,
        "user.json": "{}",
        "user_settings.json": "{}",
        "export_manifest.json": "{}",
    };

    async function classify(
        files: Record<string, string>,
        forcedProvider?: string
    ) {
        const reader = new MemoryZipReader(files);
        const entries = await reader.listEntries();
        return resolveArchiveClassification(
            reader,
            entries.map((entry) => entry.path),
            forcedProvider
        );
    }

    it("detects a Claude split export shipping conversations.json alone", async () => {
        const classification = await classify({
            "conversations.json": claudePayload,
        });

        expect(classification.supported).toBe(true);
        if (!classification.supported) return;
        expect(classification.provider).toBe("claude");
    });

    it("detects the Claude split export when Claude is forced", async () => {
        const classification = await classify(
            { "conversations.json": claudePayload },
            "claude"
        );

        expect(classification.supported).toBe(true);
        if (!classification.supported) return;
        expect(classification.provider).toBe("claude");
    });

    it("reports a mismatch when the Claude split export is imported as ChatGPT", async () => {
        const classification = await classify(
            { "conversations.json": claudePayload },
            "chatgpt"
        );

        expect(classification.supported).toBe(false);
        if (classification.supported) return;
        expect(classification.reason).toBe("provider-mismatch");
    });

    it("ignores archiver noise entries when checking for a solo payload", async () => {
        const classification = await classify({
            "__MACOSX/._conversations.json": "noise",
            ".DS_Store": "noise",
            "conversations.json": claudePayload,
        });

        expect(classification.supported).toBe(true);
        if (!classification.supported) return;
        expect(classification.provider).toBe("claude");
    });

    it("keeps a hand-repacked ChatGPT conversations.json on the ChatGPT path", async () => {
        const classification = await classify({
            "conversations.json": chatgptPayload,
        });

        expect(classification.supported).toBe(true);
        if (!classification.supported) return;
        expect(classification.provider).toBe("chatgpt");
    });

    it("keeps a solo payload of unknown shape on the name-based verdict", async () => {
        const classification = await classify({
            "conversations.json": JSON.stringify({ unexpected: true }),
        });

        expect(classification.supported).toBe(true);
        if (!classification.supported) return;
        expect(classification.provider).toBe("chatgpt");
    });

    it("keeps legacy Claude exports on the Claude path", async () => {
        const classification = await classify(claudeLegacyEntries);

        expect(classification.supported).toBe(true);
        if (!classification.supported) return;
        expect(classification.provider).toBe("claude");
    });

    it("keeps full ChatGPT exports on the ChatGPT path", async () => {
        const classification = await classify(chatgptEntries);

        expect(classification.supported).toBe(true);
        if (!classification.supported) return;
        expect(classification.provider).toBe("chatgpt");
    });

    it("rejects the companion archives of a Claude split export", async () => {
        const lightMetadata = await classify({
            "users.json": "[]",
            "login_history.json": "{}",
        });
        const projects = await classify({
            "projects/6488fba7-316a-468e-b612-e1f872396d3a.json": "{}",
        });
        const memories = await classify({
            "memories/bcdaf9cc-43c0-4931-933d-d0f7d3f758a1.json": "{}",
        });

        expect(lightMetadata.supported).toBe(false);
        expect(projects.supported).toBe(false);
        expect(memories.supported).toBe(false);
    });
});
