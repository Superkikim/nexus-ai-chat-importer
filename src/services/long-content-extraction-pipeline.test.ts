import { describe, expect, it, vi } from "vitest";
import { LongContentExtractor } from "./long-content-extractor";
import { StandardAttachment, StandardMessage } from "../types/standard";

/**
 * The rule lives on the standard conversation, so it holds whatever the
 * provider was: ChatGPT carries its oversized lines in message text, Claude in
 * attachment callouts, and both come through here.
 */

function createPlugin() {
    const created: Array<{ path: string; content: string }> = [];
    const vaultFiles = new Map<string, string>();
    const logger: Record<string, unknown> = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    };
    logger.child = vi.fn(() => logger);

    return {
        created,
        plugin: {
            logger,
            settings: {
                attachmentFolder: "Nexus/Attachments",
                addDatePrefix: false,
                dateFormat: "YYYY-MM-DD",
            },
            app: {
                vault: {
                    getAbstractFileByPath: vi.fn(() => null),
                    createFolder: vi.fn(async () => {}),
                    create: vi.fn(async (path: string, content: string) => {
                        created.push({ path, content });
                        vaultFiles.set(path, content);
                    }),
                    adapter: {
                        exists: vi.fn(async (p: string) => vaultFiles.has(p)),
                        // Returns what was written: the conflict resolver
                        // compares bytes, so an empty stub would make every
                        // existing file look like a different one.
                        readBinary: vi.fn(async (p: string) => {
                            const stored = vaultFiles.get(p) ?? "";
                            return new TextEncoder().encode(stored).buffer;
                        }),
                    },
                },
            },
        },
    };
}

const CONVERSATION = {
    id: "conv-1",
    title: "Home Assistant Docker Stack",
    createTime: 0,
    provider: "chatgpt",
};

const message = (over: Partial<StandardMessage>): StandardMessage => ({
    id: "m1",
    role: "user",
    content: "",
    timestamp: 0,
    ...over,
});

describe("LongContentExtractor", () => {
    it("moves an oversized line out of a message and links to it", async () => {
        const { plugin, created } = createPlugin();
        const blob = "failed to deploy a stack: postgres Pulling ".repeat(400);

        const out = await new LongContentExtractor(plugin as never).extract(
            [
                message({
                    content: `Voici la sortie\n${blob}\nQu'en penses-tu ?`,
                }),
            ],
            CONVERSATION
        );

        expect(created).toHaveLength(1);
        expect(created[0].path).toMatch(
            /^Nexus\/Attachments\/chatgpt\/documents\/Home Assistant Docker Stack\/attachment-[0-9a-f]{8}\.txt$/
        );
        // The prose around it stays; only the blob leaves.
        expect(out[0].content).toContain("Voici la sortie");
        expect(out[0].content).toContain("Qu'en penses-tu ?");
        expect(out[0].content).not.toContain("postgres Pulling");

        // And it leaves behind a collapsed callout, in place — the formatter
        // quotes these lines, making it the nested callout attachments use.
        const lines = out[0].content.split("\n");
        const at = lines.findIndex((l) =>
            l.startsWith(">[!nexus_attachment]-")
        );
        expect(at).toBeGreaterThan(0);
        expect(lines[at]).toContain("(txt)");
        expect(lines[at + 1]).toBe(">");
        expect(lines[at + 2]).toBe(`> [[${created[0].path}]]`);
        // Still between the two sentences, not appended after them.
        expect(lines.indexOf("Voici la sortie")).toBeLessThan(at);
        expect(lines.indexOf("Qu'en penses-tu ?")).toBeGreaterThan(at);
    });

    it("writes the file beautified, not as the single line it was", async () => {
        const { plugin, created } = createPlugin();
        const json = JSON.stringify({
            items: Array.from({ length: 800 }, (_, i) => ({
                id: i,
                name: "x",
            })),
        });

        await new LongContentExtractor(plugin as never).extract(
            [message({ content: json })],
            CONVERSATION
        );

        expect(created[0].path).toMatch(/\.json$/);
        expect(created[0].content.split("\n").length).toBeGreaterThan(100);
        // Same document, only indented.
        expect(JSON.parse(created[0].content)).toEqual(JSON.parse(json));
    });

    it("keeps a link inside the callout when the line was in an attachment", async () => {
        const { plugin, created } = createPlugin();
        const blob = "x ".repeat(6000);

        const out = await new LongContentExtractor(plugin as never).extract(
            [
                message({
                    content: "regarde",
                    attachments: [
                        {
                            fileName: "paste.txt",
                            fileType: "txt",
                            fileSize: blob.length,
                            fileId: "a1",
                            extractedContent: `>>[!nexus_attachment]- **paste.txt** (txt)\n>>\n>> ${blob}`,
                        },
                    ],
                }),
            ],
            CONVERSATION
        );

        const attachment = out[0].attachments?.[0];
        // Still one callout: the link is quoted like the content it replaced.
        expect(attachment?.extractedContent).toContain(
            `>> [[${created[0].path}]]`
        );
        expect(attachment?.extractedContent).toContain("[!nexus_attachment]");
        // And the report counts it as a file, not as text left in the note.
        expect(attachment?.status?.localPath).toBe(created[0].path);
    });

    it("writes one file when two conversations paste the same thing", async () => {
        const { plugin, created } = createPlugin();
        const blob = "same content ".repeat(1000);
        const extractor = new LongContentExtractor(plugin as never);

        await extractor.extract([message({ content: blob })], CONVERSATION);
        await extractor.extract([message({ content: blob })], CONVERSATION);

        // The name comes from the content, so the second import recognises the
        // file the first one wrote — this is what keeps the 1.7.0 cleanup and a
        // later re-import from producing two copies.
        expect(created).toHaveLength(1);
    });

    it("moves a large attachment out even when its lines are short", async () => {
        // A 500 KB document wrapped at 80 columns troubles no parser, but it
        // still makes a note nobody can open comfortably.
        const { plugin, created } = createPlugin();
        const body = Array.from(
            { length: 400 },
            (_, i) => `ligne ${i} ${"contenu ".repeat(10)}`
        ).join("\n");

        const out = await new LongContentExtractor(plugin as never).extract(
            [
                message({
                    attachments: [
                        {
                            fileName: "rapport.txt",
                            fileType: "txt",
                            fileSize: body.length,
                            fileId: "a1",
                            extractedContent: `>>[!nexus_attachment]- **rapport.txt** (txt)\n>>\n${body
                                .split("\n")
                                .map((l) => `>> ${l}`)
                                .join("\n")}`,
                        },
                    ],
                }),
            ],
            CONVERSATION
        );

        expect(created).toHaveLength(1);
        const written = out[0].attachments?.[0].extractedContent ?? "";
        expect(written).toContain("[!nexus_attachment]");
        expect(written).toContain(`>> [[${created[0].path}]]`);
        expect(written).not.toContain("ligne 300");
        expect(out[0].attachments?.[0].status?.localPath).toBe(created[0].path);
        // The file holds the body without the callout quoting.
        expect(created[0].content).toContain("ligne 300");
        expect(created[0].content).not.toContain(">>");
    });

    it("is counted as a file, which means the stats must run after it", async () => {
        // The processor computed attachment stats before this pass, so an
        // attachment the extractor had just turned into a file still reported
        // as text in the note: 572 inline and none extracted, for an import
        // that had written ninety-nine files.
        const { plugin, created } = createPlugin();
        const blob = "x ".repeat(6000);
        const attachment: StandardAttachment = {
            fileName: "paste.txt",
            fileType: "txt",
            fileSize: blob.length,
            fileId: "a1",
            extractedContent: `>>[!nexus_attachment]- **paste.txt** (txt)\n>>\n>> ${blob}`,
        };

        const before = attachment.status?.localPath;
        const out = await new LongContentExtractor(plugin as never).extract(
            [message({ attachments: [attachment] })],
            CONVERSATION
        );

        expect(before).toBeUndefined();
        expect(out[0].attachments?.[0].status?.localPath).toBe(created[0].path);
    });

    it("leaves an ordinary conversation completely alone", async () => {
        const { plugin, created } = createPlugin();
        const messages = [message({ content: "une phrase normale" })];

        const out = await new LongContentExtractor(plugin as never).extract(
            messages,
            CONVERSATION
        );

        expect(created).toHaveLength(0);
        expect(out).toBe(messages);
    });
});
