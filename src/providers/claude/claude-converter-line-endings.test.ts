import { describe, it, expect, beforeAll } from "vitest";
import { ClaudeConverter } from "./claude-converter";
import type { ClaudeConversation, ClaudeMessage } from "./claude-types";

const logger = {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
    child: () => logger,
};

function chatWith(attachment: unknown): ClaudeConversation {
    const message = {
        uuid: "m-1",
        text: "",
        sender: "human",
        created_at: "2025-01-01T00:00:00.000Z",
        content: [],
        attachments: [attachment],
        files: [],
    } as unknown as ClaudeMessage;
    return {
        uuid: "c-1",
        name: "",
        account: { uuid: "a-1" },
        created_at: "2025-01-01T00:00:00.000Z",
        updated_at: "2025-01-01T00:00:00.000Z",
        chat_messages: [message],
    };
}

describe("Claude inline attachments with bare CR line endings", () => {
    beforeAll(() => {
        ClaudeConverter.setPlugin({ logger } as never);
    });

    it("keeps every physical line inside the nested callout", async () => {
        const result = await ClaudeConverter.convertChat(
            chatWith({
                file_name: "paste.txt",
                file_type: "txt",
                extracted_content: "line one\rline two\rline three",
            })
        );

        const block = result.messages[0].attachments?.[0]
            ?.extractedContent as string;

        const escaped = block
            .split("\n")
            .filter((l) => l.trim() !== "" && !l.startsWith(">"));
        expect(escaped).toEqual([]);
        expect(block).toContain(">> line two");
        expect(block).toContain(">> line three");
    });

    it("keeps a CR-separated script inside its code fence", async () => {
        const result = await ClaudeConverter.convertChat(
            chatWith({
                file_name: "script.applescript",
                file_type: "applescript",
                extracted_content: 'on run\rdisplay dialog "hi"\rend run',
            })
        );

        const block = result.messages[0].attachments?.[0]
            ?.extractedContent as string;

        for (const line of block.split("\n")) {
            if (line.trim() === "") continue;
            expect(line.startsWith(">>")).toBe(true);
        }
        expect(block).toContain(">> end run");
    });
});
