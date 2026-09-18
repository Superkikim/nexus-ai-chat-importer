import { describe, expect, it } from "vitest";
import type { TFile } from "obsidian";
import { WikilinkCharMigrator } from "./wikilink-char-migrator";
import type { UpgradeContext } from "../upgrade-interface";

/**
 * A minimal in-memory vault: a path → content map for markdown files, plus
 * a path → binary-file record for non-markdown attachments. Just enough
 * surface for WikilinkCharMigrator and the LinkUpdateService it drives.
 */
function makeFakeVault(
    markdownFiles: Record<string, string>,
    attachmentPaths: string[] = []
) {
    const content = new Map(Object.entries(markdownFiles));
    const attachments = new Set(attachmentPaths);

    const toTFile = (path: string): TFile => {
        const name = path.split("/").pop() as string;
        const dotIndex = name.lastIndexOf(".");
        const basename = dotIndex > 0 ? name.slice(0, dotIndex) : name;
        const extension = dotIndex > 0 ? name.slice(dotIndex + 1) : "";
        return { path, name, basename, extension } as unknown as TFile;
    };

    const rename = async (file: TFile, newPath: string) => {
        if (content.has(file.path)) {
            content.set(newPath, content.get(file.path) as string);
            content.delete(file.path);
        } else if (attachments.has(file.path)) {
            attachments.delete(file.path);
            attachments.add(newPath);
        }
    };

    const vault = {
        getMarkdownFiles: () => [...content.keys()].map(toTFile),
        getFiles: () => [
            ...[...content.keys()].map(toTFile),
            ...[...attachments].map(toTFile),
        ],
        rename,
        read: async (file: TFile) => content.get(file.path) ?? "",
        modify: async (file: TFile, newContent: string) => {
            content.set(file.path, newContent);
        },
        adapter: {
            exists: async (path: string) =>
                content.has(path) || attachments.has(path),
        },
    };

    return { vault, content, attachments };
}

function makeContext(vault: unknown): UpgradeContext {
    const plugin = {
        settings: {
            conversationFolder: "Nexus/Conversations",
            reportFolder: "Nexus/Reports",
            attachmentFolder: "Nexus/Attachments",
        },
        app: { vault, metadataCache: { getFileCache: () => null } },
        logger: {
            debug: () => undefined,
            info: () => undefined,
            warn: () => undefined,
            error: () => undefined,
        },
    };

    return {
        plugin: plugin as unknown as UpgradeContext["plugin"],
        fromVersion: "1.7.0",
        toVersion: "1.7.1",
        pluginData: {},
    };
}

describe("WikilinkCharMigrator", () => {
    it("does nothing when no filename needs fixing", async () => {
        const { vault } = makeFakeVault({
            "Nexus/Conversations/claude/2025/06/Clean title.md": "content",
        });
        const context = makeContext(vault);
        const migrator = new WikilinkCharMigrator();

        const scan = await migrator.scan(context);
        expect(scan.conversationFiles).toHaveLength(0);
        expect(scan.attachmentFiles).toHaveLength(0);
    });

    it("finds a note and an attachment with a structural character", async () => {
        const { vault } = makeFakeVault(
            {
                "Nexus/Conversations/claude/2025/06/STR# to JSON Parser.md":
                    "content",
            },
            ["Nexus/Attachments/claude/documents/Invoice #12.pdf"]
        );
        const context = makeContext(vault);
        const migrator = new WikilinkCharMigrator();

        const scan = await migrator.scan(context);
        expect(scan.conversationFiles.map((f) => f.path)).toEqual([
            "Nexus/Conversations/claude/2025/06/STR# to JSON Parser.md",
        ]);
        expect(scan.attachmentFiles.map((f) => f.path)).toEqual([
            "Nexus/Attachments/claude/documents/Invoice #12.pdf",
        ]);
    });

    it("renames an affected note and fixes the link pointing at it in a report", async () => {
        const oldPath =
            "Nexus/Conversations/claude/2025/06/STR# to JSON Parser.md";
        const newPath =
            "Nexus/Conversations/claude/2025/06/STR＃ to JSON Parser.md";

        const { vault, content } = makeFakeVault({
            [oldPath]: "# Title: STR# to JSON Parser\n\nBody.",
            "Nexus/Reports/claude/20250620-000000 - import summary.md": `- [[${oldPath}\\|STR# to JSON Parser]]`,
        });
        const context = makeContext(vault);
        const migrator = new WikilinkCharMigrator();

        const scan = await migrator.scan(context);
        const result = await migrator.migrate(context, scan);

        expect(result.success).toBe(true);
        expect(content.has(oldPath)).toBe(false);
        expect(content.has(newPath)).toBe(true);

        const report = content.get(
            "Nexus/Reports/claude/20250620-000000 - import summary.md"
        );
        expect(report).toContain(newPath);
        expect(report).not.toContain(oldPath);
    });

    it("renames an affected attachment and fixes its embed in the conversation note", async () => {
        const oldPath = "Nexus/Attachments/claude/documents/Invoice #12.pdf";
        const newPath = "Nexus/Attachments/claude/documents/Invoice ＃12.pdf";
        const notePath =
            "Nexus/Conversations/claude/2025/06/Expenses review.md";

        const { vault, content } = makeFakeVault(
            {
                [notePath]: `Body.\n>> [[${oldPath}]]`,
            },
            [oldPath]
        );
        const context = makeContext(vault);
        const migrator = new WikilinkCharMigrator();

        const scan = await migrator.scan(context);
        const result = await migrator.migrate(context, scan);

        expect(result.success).toBe(true);
        const note = content.get(notePath);
        expect(note).toContain(newPath);
        expect(note).not.toContain(oldPath);
    });

    it("fixes the Conversation back-link in a Claude artifact note", async () => {
        const oldPath =
            "Nexus/Conversations/claude/2025/06/STR# to JSON Parser.md";
        const newPath =
            "Nexus/Conversations/claude/2025/06/STR＃ to JSON Parser.md";
        const artifactPath = "Nexus/Attachments/claude/artifacts/art-1_v1.md";

        const { vault, content } = makeFakeVault({
            [oldPath]: "# Title: STR# to JSON Parser",
            [artifactPath]: `---\nnexus: nexus-ai-chat-importer\n---\n**Conversation:** [[${oldPath}|STR# to JSON Parser]]`,
        });
        const context = makeContext(vault);
        const migrator = new WikilinkCharMigrator();

        const scan = await migrator.scan(context);
        const result = await migrator.migrate(context, scan);

        expect(result.success).toBe(true);
        const artifact = content.get(artifactPath);
        expect(artifact).toContain(newPath);
        expect(artifact).not.toContain(oldPath);
    });

    it("is a no-op the second time it runs against its own output", async () => {
        const oldPath =
            "Nexus/Conversations/claude/2025/06/STR# to JSON Parser.md";

        const { vault } = makeFakeVault({
            [oldPath]: "content",
        });
        const context = makeContext(vault);
        const migrator = new WikilinkCharMigrator();

        const firstScan = await migrator.scan(context);
        await migrator.migrate(context, firstScan);

        const secondScan = await migrator.scan(context);
        expect(secondScan.conversationFiles).toHaveLength(0);
        expect(secondScan.attachmentFiles).toHaveLength(0);
    });
});
