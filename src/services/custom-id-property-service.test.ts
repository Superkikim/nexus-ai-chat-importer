import { describe, expect, it, vi } from "vitest";
import { TFile } from "obsidian";
import { CustomIdPropertyService } from "./custom-id-property-service";

const ID = "6789abcd-0000-1111-2222-333344445555";

function file(path: string): TFile {
    const f = new TFile();
    f.path = path;
    return f;
}

function conversation(extra = ""): string {
    return `---\nnexus: nexus-ai-chat-importer\nconversation_id: ${ID}\n${extra}---\n\nbody\n`;
}

function createVault(
    entries: Record<string, { content: string; fm?: object; unindexed?: true }>
) {
    const contents = new Map(
        Object.entries(entries).map(([path, e]) => [path, e.content])
    );
    const files = Object.keys(entries).map(file);
    const process = vi.fn(async (f: TFile, fn: (content: string) => string) => {
        const next = fn(contents.get(f.path) ?? "");
        contents.set(f.path, next);
        return next;
    });
    const app = {
        vault: {
            getMarkdownFiles: () => files,
            read: async (f: TFile) => contents.get(f.path) ?? "",
            cachedRead: async (f: TFile) => contents.get(f.path) ?? "",
            process,
        },
        metadataCache: {
            getFileCache: (f: TFile) => {
                const entry = entries[f.path];
                if (entry.unindexed) return null;
                return entry.fm ? { frontmatter: entry.fm } : {};
            },
        },
    };
    return {
        service: new CustomIdPropertyService(
            app as never,
            "nexus-ai-chat-importer"
        ),
        files,
        contents,
        process,
    };
}

describe("CustomIdPropertyService", () => {
    it("finds conversation notes, not artifacts or other notes", async () => {
        const nexus = "nexus-ai-chat-importer";
        const { service } = createVault({
            "a.md": { content: "", fm: { nexus, conversation_id: ID } },
            "artifact.md": {
                content: "",
                fm: { nexus, conversation_id: ID, artifact_id: "x" },
            },
            "other-plugin.md": {
                content: "",
                fm: { nexus: "other", conversation_id: ID },
            },
            "report.md": { content: "", fm: { nexus } },
            "plain.md": { content: "" },
        });

        const notes = await service.findConversationNotes();
        expect(notes.map((f) => f.path)).toEqual(["a.md"]);
    });

    it("reads notes the metadata cache has not indexed yet", async () => {
        const { service, files } = createVault({
            "fresh.md": { content: conversation("uid: 1\n"), unindexed: true },
            "fresh-artifact.md": {
                content: conversation("artifact_id: x\n"),
                unindexed: true,
            },
            "fresh-plain.md": { content: "# text\n", unindexed: true },
        });

        const notes = await service.findConversationNotes();
        expect(notes.map((f) => f.path)).toEqual(["fresh.md"]);
        expect(await service.countWithProperty(files, "uid")).toBe(1);
    });

    it("counts the notes that already have the property", async () => {
        const { service, files } = createVault({
            "a.md": { content: "", fm: { uid: "x" } },
            "b.md": { content: "", fm: { uid: null } },
            "c.md": { content: "", fm: { other: 1 } },
        });

        expect(await service.countWithProperty(files, "uid")).toBe(2);
    });

    it("processes every note, counting each outcome", async () => {
        const { service, files, contents, process } = createVault({
            "new.md": { content: conversation() },
            "same.md": { content: conversation(`uid: ${ID}\n`) },
            "foreign.md": { content: conversation("uid: 42\n") },
            "broken.md": { content: "no frontmatter\n" },
        });
        const progress = vi.fn();

        const summary = await service.run(
            files,
            { kind: "add", name: "uid", overwrite: true },
            progress
        );

        expect(summary).toMatchObject({
            added: 1,
            overwritten: 1,
            skipped: 1,
            failed: 1,
        });
        expect(summary.failures).toEqual([
            { path: "broken.md", message: "Frontmatter not found" },
        ]);
        expect(contents.get("new.md")).toContain(`uid: ${ID}\n`);
        expect(contents.get("foreign.md")).toContain(`uid: ${ID}\n`);
        // Skipped notes are not written at all.
        expect(process).toHaveBeenCalledTimes(2);
        expect(progress).toHaveBeenLastCalledWith(4, 4, "");
    });

    it("removes and renames", async () => {
        const { service, files, contents } = createVault({
            "a.md": { content: conversation(`uid: ${ID}\n`) },
            "b.md": { content: conversation("uid: 42\n") },
        });

        const renamed = await service.run(files, {
            kind: "rename",
            from: "uid",
            to: "note_id",
            overwrite: false,
        });
        expect(renamed).toMatchObject({ renamed: 1, added: 1 });
        expect(contents.get("a.md")).not.toContain("uid:");
        expect(contents.get("b.md")).toContain("uid: 42\n");

        const removed = await service.run(files, {
            kind: "remove",
            name: "note_id",
            onlyPluginValue: true,
        });
        expect(removed).toMatchObject({ removed: 2 });
        expect(contents.get("a.md")).toBe(conversation());
    });
});
