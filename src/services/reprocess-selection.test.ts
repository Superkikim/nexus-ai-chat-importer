import { describe, expect, it } from "vitest";
import {
    ConversationMetadataExtractor,
    UnchangedPolicy,
} from "./conversation-metadata-extractor";
import { DefaultProviderRegistry } from "../providers/provider-adapter";
import { buildZip, toFile } from "../tests/zip-fixtures";
import type { ConversationCatalogEntry } from "../types/plugin";

function createTestPlugin() {
    const logger = {
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: () => {},
        child: () => logger,
    };
    return { logger } as never;
}

function chat(id: string, title: string, updateTime: number) {
    return {
        id,
        conversation_id: id,
        title,
        create_time: updateTime - 100,
        update_time: updateTime,
        mapping: {
            root: {
                id: "root",
                message: {
                    id: "m1",
                    author: { role: "user" },
                    create_time: updateTime - 100,
                    content: { content_type: "text", parts: ["hello"] },
                },
                parent: null,
                children: [],
            },
        },
    };
}

async function exportWith(chats: unknown[]): Promise<File> {
    const bytes = await buildZip([
        {
            name: "conversations.json",
            data: new TextEncoder().encode(JSON.stringify(chats)),
            compress: true,
        },
    ]);
    return toFile(bytes, "chatgpt-export.zip");
}

function vaultEntry(id: string, updateTime: number): ConversationCatalogEntry {
    return {
        conversationId: id,
        provider: "chatgpt",
        updateTime,
        path: `Conversations/${id}.md`,
        create_time: updateTime - 100,
        update_time: updateTime,
    };
}

async function analyse(unchangedPolicy: UnchangedPolicy) {
    const extractor = new ConversationMetadataExtractor(
        new DefaultProviderRegistry(),
        createTestPlugin()
    );
    const file = await exportWith([
        chat("conv-unchanged", "Already imported", 1_700_000_000),
        chat("conv-new", "Never seen", 1_700_000_500),
    ]);
    const existing = new Map<string, ConversationCatalogEntry>([
        ["conv-unchanged", vaultEntry("conv-unchanged", 1_700_000_000)],
    ]);

    return extractor.extractMetadataFromMultipleZips(
        [file],
        "chatgpt",
        existing,
        unchangedPolicy
    );
}

describe("reprocess pulls unchanged conversations back into the selection", () => {
    it("drops unchanged conversations by default", async () => {
        const result = await analyse("drop");

        expect(result.conversations.map((c) => c.id)).toEqual(["conv-new"]);
        expect(result.analysisInfo?.conversationsUnchanged).toBe(1);
        expect(result.analysisInfo?.conversationsDroppedUnchanged).toBe(1);
        expect(result.analysisInfo?.conversationsReprocessed).toBe(0);
    });

    it("offers them to the selection without claiming a rebuild", async () => {
        const result = await analyse("offer");

        expect(result.conversations.map((c) => c.id).sort()).toEqual([
            "conv-new",
            "conv-unchanged",
        ]);
        expect(result.analysisInfo?.conversationsUnchanged).toBe(1);
        expect(result.analysisInfo?.conversationsDroppedUnchanged).toBe(0);
        // Nobody asked for anything yet: the user still has to select the
        // conversation and tick the rebuild box.
        expect(result.analysisInfo?.conversationsReprocessed).toBe(0);
    });

    it("keeps them when a rebuild is requested", async () => {
        const result = await analyse("rebuild");

        expect(result.conversations.map((c) => c.id).sort()).toEqual([
            "conv-new",
            "conv-unchanged",
        ]);
        // The conversation is still unchanged in the vault — the rebuild only
        // changes what we do about it. The dialog's "Unchanged" card reads this
        // one, so it must not drop to zero just because reprocess is on.
        expect(result.analysisInfo?.conversationsUnchanged).toBe(1);
        expect(result.analysisInfo?.conversationsDroppedUnchanged).toBe(0);
        expect(result.analysisInfo?.conversationsReprocessed).toBe(1);
    });

    it("still reports an unchanged conversation as unchanged", async () => {
        const result = await analyse("rebuild");

        const rebuilt = result.conversations.find(
            (c) => c.id === "conv-unchanged"
        );
        // The selection dialog must keep telling the truth about vault state.
        expect(rebuilt?.existenceStatus).toBe("unchanged");
        expect(rebuilt?.hasNewerContent).toBe(false);
    });
});

/**
 * The toggle lives in the shared file-selection flow, not in a provider
 * adapter. Claude proves the behaviour is not ChatGPT-specific.
 */
describe("reprocess is provider-agnostic", () => {
    function claudeChat(uuid: string, name: string, iso: string) {
        return {
            uuid,
            name,
            created_at: iso,
            updated_at: iso,
            chat_messages: [
                {
                    uuid: `${uuid}-m1`,
                    sender: "human",
                    text: "hello",
                    created_at: iso,
                },
            ],
        };
    }

    async function analyseClaude(unchangedPolicy: UnchangedPolicy) {
        const extractor = new ConversationMetadataExtractor(
            new DefaultProviderRegistry(),
            createTestPlugin()
        );
        const bytes = await buildZip([
            {
                name: "conversations.json",
                data: new TextEncoder().encode(
                    JSON.stringify([
                        claudeChat(
                            "claude-unchanged",
                            "Already imported",
                            "2026-08-01T10:00:00.000Z"
                        ),
                    ])
                ),
                compress: true,
            },
            {
                name: "users.json",
                data: new TextEncoder().encode(JSON.stringify([{ uuid: "u" }])),
            },
        ]);
        const updateTime = Math.floor(
            new Date("2026-08-01T10:00:00.000Z").getTime() / 1000
        );
        const existing = new Map<string, ConversationCatalogEntry>([
            [
                "claude-unchanged",
                {
                    conversationId: "claude-unchanged",
                    provider: "claude",
                    updateTime,
                    path: "Conversations/claude.md",
                    create_time: updateTime,
                    update_time: updateTime,
                },
            ],
        ]);

        return extractor.extractMetadataFromMultipleZips(
            [toFile(bytes, "claude-export.zip")],
            "claude",
            existing,
            unchangedPolicy
        );
    }

    it("skips an unchanged Claude conversation by default", async () => {
        const result = await analyseClaude("drop");

        expect(result.conversations).toHaveLength(0);
        expect(result.analysisInfo?.conversationsUnchanged).toBe(1);
        expect(result.analysisInfo?.conversationsDroppedUnchanged).toBe(1);
    });

    it("rebuilds it when asked, exactly as for ChatGPT", async () => {
        const result = await analyseClaude("rebuild");

        expect(result.conversations.map((c) => c.id)).toEqual([
            "claude-unchanged",
        ]);
        expect(result.analysisInfo?.conversationsUnchanged).toBe(1);
        expect(result.analysisInfo?.conversationsDroppedUnchanged).toBe(0);
        expect(result.analysisInfo?.conversationsReprocessed).toBe(1);
    });
});
