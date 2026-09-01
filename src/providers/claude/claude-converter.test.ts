import { describe, it, expect, beforeAll } from "vitest";
import { ClaudeConverter } from "./claude-converter";
import type { ClaudeConversation, ClaudeMessage } from "./claude-types";

/**
 * Minimal plugin stub. Attachment-only messages do not exercise artifact or
 * ZIP extraction, so a logger is all the converter needs on these paths.
 */
const logger = {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
    child: () => logger,
};
const pluginStub = { logger } as never;

function message(overrides: Partial<ClaudeMessage>): ClaudeMessage {
    return {
        uuid: "m-1",
        text: "",
        sender: "human",
        created_at: "2025-01-01T00:00:00.000Z",
        content: [],
        attachments: [],
        files: [],
        ...overrides,
    };
}

function conversation(messages: ClaudeMessage[]): ClaudeConversation {
    return {
        uuid: "c-1",
        name: "",
        account: { uuid: "a-1" },
        created_at: "2025-01-01T00:00:00.000Z",
        updated_at: "2025-01-01T00:00:00.000Z",
        chat_messages: messages,
    };
}

describe("ClaudeConverter attachment-only messages", () => {
    beforeAll(() => {
        ClaudeConverter.setPlugin(pluginStub);
    });

    it("keeps a message whose only content is an uploaded document", async () => {
        const chat = conversation([
            message({
                uuid: "m-doc",
                attachments: [
                    {
                        file_name: "brief.pdf",
                        file_size: 1234,
                        file_type: "application/pdf",
                    },
                ] as never,
            }),
        ]);

        const result = await ClaudeConverter.convertChat(chat);

        expect(result.messages).toHaveLength(1);
    });

    it("keeps a message whose only content is an uploaded file", async () => {
        const chat = conversation([
            message({
                uuid: "m-file",
                files: [{ file_name: "photo.png" }] as never,
            }),
        ]);

        const result = await ClaudeConverter.convertChat(chat);

        expect(result.messages).toHaveLength(1);
    });

    it("still drops a message with no text, content, attachments or files", async () => {
        const chat = conversation([message({ uuid: "m-empty" })]);

        const result = await ClaudeConverter.convertChat(chat);

        expect(result.messages).toHaveLength(0);
    });

    it("keeps text-only messages as before", async () => {
        const chat = conversation([message({ uuid: "m-text", text: "hello" })]);

        const result = await ClaudeConverter.convertChat(chat);

        expect(result.messages).toHaveLength(1);
    });
});
