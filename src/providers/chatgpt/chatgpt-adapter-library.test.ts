import { describe, expect, it, vi } from "vitest";
import { ChatGPTAdapter } from "./chatgpt-adapter";
import { createMissingGeneratedImageAttachment } from "./chatgpt-generated-image";
import { StandardMessage } from "../../types/standard";
import { ZipArchiveReader, ZipEntryHandle } from "../../utils/zip-loader";
import type NexusAiChatImporterPlugin from "../../main";

const CONVERSATION = "thread-1";

function createTestPlugin(): NexusAiChatImporterPlugin {
    const logger = {
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: () => {},
        child: () => logger,
    };
    return { logger } as unknown as NexusAiChatImporterPlugin;
}

/**
 * ZIP mock that records payload reads, so tests can assert that
 * reconciliation stays metadata-only (no `.dat` preloading).
 */
function createZipMock(
    jsonFiles: Record<string, string>,
    datEntries: string[] = []
) {
    const encoder = new TextEncoder();
    const readPayloads: string[] = [];
    const readTextCalls: string[] = [];

    const names = new Set([...Object.keys(jsonFiles), ...datEntries]);

    const makeHandle = (name: string): ZipEntryHandle => ({
        name,
        readBytes: async () => {
            readPayloads.push(name);
            return encoder.encode(jsonFiles[name] ?? "");
        },
        readText: async () => {
            readTextCalls.push(name);
            return jsonFiles[name] ?? "";
        },
        readTextChunks: async function* () {
            readTextCalls.push(name);
            yield jsonFiles[name] ?? "";
        },
    });

    const zip: ZipArchiveReader = {
        listEntries: async () => [...names].map((path) => ({ path, size: 1 })),
        has: (name: string) => names.has(name),
        get: (name: string) => (names.has(name) ? makeHandle(name) : null),
    };

    return { zip, readPayloads, readTextCalls };
}

function libraryJson(entries: Record<string, unknown>[]): string {
    return JSON.stringify(entries);
}

const GENERATED_IMAGE = {
    id: { id: "libfile_img" },
    file_id: "file_img_1",
    file_name: "Brain vs circuit symbol.png",
    mime_type: "image/png",
    file_size_bytes: 96138,
    library_artifact_type: "image",
    library_file_category: "image",
    image_gen_generation_id: "gen-1",
    origination_message_id: "m2",
    origination_thread_id: CONVERSATION,
    created_at: "2026-07-15T12:25:30.970665+00:00",
};

const GENERATED_REPORT = {
    id: { id: "libfile_doc" },
    file_id: "file_doc_1",
    file_name: "generated_letter.docx",
    mime_type:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    file_size_bytes: 37768,
    library_artifact_type: "report",
    library_file_category: "other",
    origination_message_id: "m2",
    origination_thread_id: CONVERSATION,
    created_at: "2026-06-03T12:51:46.304862+00:00",
};

const WRITING_BLOCK = {
    id: { id: "libfile_wb" },
    file_id: "file_wb_1",
    file_name: "Pasted markdown.md",
    mime_type: "text/markdown",
    library_artifact_type: "writing_block",
    library_file_category: "text",
    origination_message_id: "m1",
    origination_thread_id: CONVERSATION,
    created_at: "2026-06-13T07:56:54.085642+00:00",
};

function baseMessages(): StandardMessage[] {
    return [
        {
            id: "m1",
            role: "user",
            content: "Generate an image of a brain",
            timestamp: 1000,
        },
        { id: "m2", role: "assistant", content: "Here it is", timestamp: 1001 },
    ];
}

describe("ChatGPTAdapter.reconcileConversationMessages", () => {
    it("attaches a generated image from the library to its exported message", async () => {
        const adapter = new ChatGPTAdapter(createTestPlugin());
        const { zip } = createZipMock(
            { "library_files.json": libraryJson([GENERATED_IMAGE]) },
            ["file_img_1.dat"]
        );

        const result = await adapter.reconcileConversationMessages(
            baseMessages(),
            CONVERSATION,
            zip
        );

        expect(result).toHaveLength(2);
        const attachments = result[1].attachments ?? [];
        expect(attachments).toHaveLength(1);
        expect(attachments[0].fileName).toBe("Brain_vs_circuit_symbol.png");
        expect(attachments[0].attachmentType).toBe("generated_image");
        expect(attachments[0].fileId).toBe("file_img_1");
    });

    it("still injects a Canvas report document (existing behaviour preserved)", async () => {
        const adapter = new ChatGPTAdapter(createTestPlugin());
        const { zip } = createZipMock(
            { "library_files.json": libraryJson([GENERATED_REPORT]) },
            ["file_doc_1.dat"]
        );

        const result = await adapter.reconcileConversationMessages(
            baseMessages(),
            CONVERSATION,
            zip
        );

        const attachments = result[1].attachments ?? [];
        expect(attachments).toHaveLength(1);
        expect(attachments[0].fileName).toBe("generated_letter.docx");
        expect(attachments[0].fileId).toBe("file_doc_1");
    });

    it("does not inject a writing_block (already on its own message)", async () => {
        const adapter = new ChatGPTAdapter(createTestPlugin());
        const { zip } = createZipMock(
            { "library_files.json": libraryJson([WRITING_BLOCK]) },
            ["file_wb_1.dat"]
        );

        const result = await adapter.reconcileConversationMessages(
            baseMessages(),
            CONVERSATION,
            zip
        );

        expect(result.flatMap((m) => m.attachments ?? [])).toHaveLength(0);
    });

    it("returns the messages untouched for an old-format export", async () => {
        const adapter = new ChatGPTAdapter(createTestPlugin());
        const { zip } = createZipMock({ "conversations.json": "[]" });
        const messages = baseMessages();

        const result = await adapter.reconcileConversationMessages(
            messages,
            CONVERSATION,
            zip
        );

        expect(result).toBe(messages);
    });

    it("keeps the placeholder when the payload is absent from the archive", async () => {
        const adapter = new ChatGPTAdapter(createTestPlugin());
        // library_files.json lists the image, but no .dat entry exists.
        const { zip } = createZipMock({
            "library_files.json": libraryJson([
                { ...GENERATED_IMAGE, origination_message_id: "omitted" },
            ]),
        });

        const messages: StandardMessage[] = [
            baseMessages()[0],
            {
                ...baseMessages()[1],
                attachments: [
                    createMissingGeneratedImageAttachment("brain prompt"),
                ],
            },
        ];

        const result = await adapter.reconcileConversationMessages(
            messages,
            CONVERSATION,
            zip
        );

        const attachments = result.flatMap((m) => m.attachments ?? []);
        expect(attachments).toHaveLength(1);
        expect(attachments[0].status?.reason).toBe("not_in_export");
    });

    it("ignores artifacts belonging to another conversation", async () => {
        const adapter = new ChatGPTAdapter(createTestPlugin());
        const { zip } = createZipMock(
            {
                "library_files.json": libraryJson([
                    {
                        ...GENERATED_IMAGE,
                        origination_thread_id: "someone-elses-thread",
                        origination_message_id: "their-message",
                    },
                ]),
            },
            ["file_img_1.dat"]
        );

        const result = await adapter.reconcileConversationMessages(
            baseMessages(),
            CONVERSATION,
            zip
        );

        expect(result.flatMap((m) => m.attachments ?? [])).toHaveLength(0);
    });

    it("parses library_files.json only once per ZIP across conversations", async () => {
        const adapter = new ChatGPTAdapter(createTestPlugin());
        const { zip, readTextCalls } = createZipMock(
            { "library_files.json": libraryJson([GENERATED_IMAGE]) },
            ["file_img_1.dat"]
        );

        await adapter.reconcileConversationMessages(
            baseMessages(),
            CONVERSATION,
            zip
        );
        await adapter.reconcileConversationMessages(
            baseMessages(),
            "another-thread",
            zip
        );
        await adapter.reconcileConversationMessages(
            baseMessages(),
            CONVERSATION,
            zip
        );

        expect(
            readTextCalls.filter((n) => n === "library_files.json")
        ).toHaveLength(1);
    });

    it("never reads a .dat payload while reconciling", async () => {
        const adapter = new ChatGPTAdapter(createTestPlugin());
        const { zip, readPayloads } = createZipMock(
            {
                "library_files.json": libraryJson([
                    GENERATED_IMAGE,
                    GENERATED_REPORT,
                ]),
            },
            ["file_img_1.dat", "file_doc_1.dat"]
        );

        await adapter.reconcileConversationMessages(
            baseMessages(),
            CONVERSATION,
            zip
        );

        // Presence is a central-directory lookup; payloads stay unread until
        // extraction actually needs them (mobile memory guardrail).
        expect(readPayloads).toHaveLength(0);
    });

    it("is idempotent across repeated reconciliation of the same conversation", async () => {
        const adapter = new ChatGPTAdapter(createTestPlugin());
        const { zip } = createZipMock(
            {
                "library_files.json": libraryJson([
                    { ...GENERATED_IMAGE, origination_message_id: "omitted" },
                ]),
            },
            ["file_img_1.dat"]
        );

        const once = await adapter.reconcileConversationMessages(
            baseMessages(),
            CONVERSATION,
            zip
        );
        const twice = await adapter.reconcileConversationMessages(
            once,
            CONVERSATION,
            zip
        );

        expect(twice).toEqual(once);
        expect(twice.flatMap((m) => m.attachments ?? [])).toHaveLength(1);
    });

    it("continues the import when the library index cannot be parsed", async () => {
        const adapter = new ChatGPTAdapter(createTestPlugin());
        const { zip } = createZipMock({ "library_files.json": "not json" });
        const messages = baseMessages();

        const result = await adapter.reconcileConversationMessages(
            messages,
            CONVERSATION,
            zip
        );

        expect(result).toBe(messages);
    });

    it("logs unknown artifact types without interrupting reconciliation", async () => {
        const plugin = createTestPlugin();
        const debug = vi.fn();
        (plugin.logger as unknown as { child: () => unknown }).child = () => ({
            debug,
            info: () => {},
            warn: () => {},
            error: () => {},
        });

        const adapter = new ChatGPTAdapter(plugin);
        const { zip } = createZipMock(
            {
                "library_files.json": libraryJson([
                    {
                        ...GENERATED_IMAGE,
                        library_artifact_type: "future_type_from_openai",
                        image_gen_generation_id: null,
                    },
                    GENERATED_REPORT,
                ]),
            },
            ["file_img_1.dat", "file_doc_1.dat"]
        );

        const result = await adapter.reconcileConversationMessages(
            baseMessages(),
            CONVERSATION,
            zip
        );

        // The unknown type is skipped; the supported document still arrives.
        const attachments = result.flatMap((m) => m.attachments ?? []);
        expect(attachments).toHaveLength(1);
        expect(attachments[0].fileId).toBe("file_doc_1");
        expect(debug).toHaveBeenCalled();
    });
});
