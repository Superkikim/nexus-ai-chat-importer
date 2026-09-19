import { describe, expect, it, vi } from "vitest";
import { GrokAdapter } from "./grok-adapter";
import { GrokConversationRecord, GrokMediaPost } from "./grok-types";
import type NexusAiChatImporterPlugin from "../../main";

const plugin = {
    settings: { attachmentFolder: "attachments" },
    logger: { warn: vi.fn(), error: vi.fn() },
} as unknown as NexusAiChatImporterPlugin;

const conversation: GrokConversationRecord = {
    conversation: {
        id: "11111111-aaaa-4aaa-8aaa-111111111111",
        title: "Planning a Garden",
        create_time: "2026-01-10T08:00:00.123456Z",
        modify_time: "2026-01-10T08:05:00.456Z",
    },
    responses: [
        {
            response: {
                _id: "q1",
                sender: "human",
                message: "Question",
                create_time: { $date: { $numberLong: "1768032000123" } },
            },
        },
        {
            response: {
                _id: "a1",
                sender: "assistant",
                message: "",
                create_time: { $date: { $numberLong: "1768032003000" } },
            },
        },
    ],
};

const post: GrokMediaPost = {
    id: "22222222-bbbb-4bbb-8bbb-222222222222",
    original_prompt: "A watercolour lighthouse at dawn",
    media_type: "image",
    create_time: "2026-01-12T09:00:00.000100Z",
    link: "https://grok.com/imagine/post/22222222-bbbb-4bbb-8bbb-222222222222",
};

describe("GrokAdapter", () => {
    const adapter = new GrokAdapter(plugin);

    it("detects a stream starting with a conversation or a post", () => {
        expect(adapter.detect([conversation])).toBe(true);
        expect(adapter.detect([post])).toBe(true);
        expect(adapter.detect([{ uuid: "x", chat_messages: [] }])).toBe(false);
    });

    it("identifies both kinds of item", () => {
        expect(adapter.getId(conversation)).toBe(conversation.conversation.id);
        expect(adapter.getId(post)).toBe(post.id);
        expect(adapter.getTitle(conversation)).toBe("Planning a Garden");
        expect(adapter.getTitle(post)).toBe(
            "Imagine - A watercolour lighthouse at dawn"
        );
    });

    it("dates items in whole seconds", () => {
        expect(adapter.getCreateTime(conversation)).toBe(
            Math.floor(Date.parse("2026-01-10T08:00:00.123456Z") / 1000)
        );
        expect(adapter.getUpdateTime(post)).toBe(
            Math.floor(Date.parse("2026-01-12T09:00:00.000100Z") / 1000)
        );
    });

    it("files conversations and Imagine posts in separate categories", () => {
        expect(adapter.getItemCategory(conversation)).toBe("Conversations");
        expect(adapter.getItemCategory(post)).toBe("Imagine");
    });

    it("declines an Imagine post without a prompt, and nothing else", () => {
        expect(adapter.getExclusionReason(conversation)).toBeNull();
        expect(adapter.getExclusionReason(post)).toBeNull();
        expect(
            adapter.getExclusionReason({ ...post, original_prompt: "  " })
        ).toBe("empty prompt");
    });

    it("never reports a response the note does not show as new", () => {
        expect(
            (adapter.getNewMessages(conversation, []) as { id: string }[]).map(
                (m) => m.id
            )
        ).toEqual(["q1"]);
        expect(adapter.getNewMessages(conversation, ["q1"])).toEqual([]);
    });
});
