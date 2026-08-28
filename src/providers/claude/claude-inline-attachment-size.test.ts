import { describe, expect, it, vi } from "vitest";
import { ClaudeConverter } from "./claude-converter";
import { ClaudeAttachment, ClaudeMessage } from "./claude-types";
import { ClaudeAttachmentExtractor } from "./claude-attachment-extractor";
import type { ZipArchiveReader } from "../../utils/zip-loader";

/**
 * A pasted log or HTML page arrives in conversations.json as one enormous
 * string. Inlining it put 138 000 characters on a single line of the note,
 * and Obsidian's parser reads a line whole: three such notes were enough to
 * make indexing a 4 000-note vault crawl.
 */

function createPlugin(existing = new Set<string>()) {
    const created: Array<{ path: string; content: string }> = [];
    const logger: Record<string, unknown> = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    };
    logger.child = vi.fn(() => logger);

    const plugin = {
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
                    existing.add(path);
                }),
                adapter: {
                    exists: vi.fn(async (p: string) => existing.has(p)),
                    readBinary: vi.fn(async () => new ArrayBuffer(0)),
                },
            },
        },
    };
    return { plugin, created };
}

function messageWith(attachments: ClaudeAttachment[]): ClaudeMessage {
    return {
        uuid: `msg-${Math.random()}`,
        sender: "human",
        text: "Voilà le fichier",
        created_at: "2026-01-14T12:33:59.000Z",
        attachments,
    } as unknown as ClaudeMessage;
}

const attachment = (name: string, content: string): ClaudeAttachment => ({
    file_name: name,
    file_type: "txt",
    file_size: content.length,
    extracted_content: content,
});

const SMALL = "ligne de log\n".repeat(100); // ~1.3 KB
const HUGE = "x".repeat(30 * 1024);

async function convert(messages: ClaudeMessage[], plugin: unknown) {
    (ClaudeConverter as unknown as { plugin: unknown }).plugin = plugin;
    return ClaudeConverter.convertMessages(
        messages,
        "conv-uuid",
        "Configuration du switch",
        0
    );
}

describe("Claude inline attachments", () => {
    it("keeps small content in the note", async () => {
        const { plugin, created } = createPlugin();

        const messages = await convert(
            [messageWith([attachment("notes.txt", SMALL)])],
            plugin
        );

        expect(created).toHaveLength(0);
        const att = messages[0].attachments?.[0];
        expect(att?.extractedContent).toContain("ligne de log");
        expect(att?.url).toBeUndefined();
    });

    it("writes oversized content beside the conversation and links to it", async () => {
        const { plugin, created } = createPlugin();

        const messages = await convert(
            [messageWith([attachment("dump.log", HUGE)])],
            plugin
        );

        expect(created).toHaveLength(1);
        expect(created[0].path).toBe(
            "Nexus/Attachments/claude/documents/Configuration du switch/dump.log"
        );
        expect(created[0].content).toBe(HUGE);

        const att = messages[0].attachments?.[0];
        // No inline copy left behind, and the formatter renders the link.
        expect(att?.extractedContent).toBeUndefined();
        expect(att?.url).toBe(created[0].path);
        // The report counts a file by its localPath: without it this would be
        // tallied as inline content, which it stopped being.
        expect(att?.status?.localPath).toBe(created[0].path);
    });

    it("writes it once when several messages carry the same file", async () => {
        // The 3.5 MB note in the wild: the same attachment on two consecutive
        // messages, inlined twice, half the note duplicated.
        const { plugin, created } = createPlugin();

        const messages = await convert(
            [
                messageWith([attachment("dump.log", HUGE)]),
                messageWith([attachment("dump.log", HUGE)]),
            ],
            plugin
        );

        expect(created).toHaveLength(1);
        expect(messages[0].attachments?.[0].url).toBe(
            messages[1].attachments?.[0].url
        );
    });

    it("gives an extensionless name one, so the file can be opened", async () => {
        const { plugin, created } = createPlugin();

        await convert([messageWith([attachment("paste", HUGE)])], plugin);

        expect(created[0].path).toMatch(/\/paste\.txt$/);
    });

    it("survives the attachment extractor, which has nothing to look up", async () => {
        // The extractor runs after the converter and replaces anything it
        // cannot find in the ZIP with a "not provided by export" placeholder.
        // A file the converter just wrote must not be handed that.
        const { plugin, created } = createPlugin();
        const messages = await convert(
            [messageWith([attachment("dump.log", HUGE)])],
            plugin
        );

        const extractor = new ClaudeAttachmentExtractor(
            plugin as unknown as ConstructorParameters<
                typeof ClaudeAttachmentExtractor
            >[0],
            plugin.logger as unknown as ConstructorParameters<
                typeof ClaudeAttachmentExtractor
            >[1]
        );
        const processed = await extractor.extractAttachments(
            {
                has: () => false,
                get: () => null,
            } as unknown as ZipArchiveReader,
            "conv-uuid",
            messages[0].attachments ?? []
        );

        expect(processed[0].url).toBe(created[0].path);
        expect(processed[0].extractedContent).toBeUndefined();
    });

    it("falls back to inlining when the write fails", async () => {
        const { plugin, created } = createPlugin();
        plugin.app.vault.create = vi.fn(async () => {
            throw new Error("EACCES");
        });

        const messages = await convert(
            [messageWith([attachment("dump.log", HUGE)])],
            plugin
        );

        expect(created).toHaveLength(0);
        // Worse for the index, but the content is never lost.
        expect(messages[0].attachments?.[0].extractedContent).toContain("xxx");
    });
});
