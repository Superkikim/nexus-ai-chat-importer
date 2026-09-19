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
        id: "6ff87162-ac88-4b61-996e-9d11280e7bf1",
        title: "Dark Captivity Books Without Romance",
        create_time: "2026-05-26T16:06:57.420837Z",
        modify_time: "2026-05-26T16:10:41.726Z",
    },
    responses: [
        {
            response: {
                _id: "q1",
                sender: "human",
                message: "Question",
                create_time: { $date: { $numberLong: "1779811617461" } },
            },
        },
        {
            response: {
                _id: "a1",
                sender: "assistant",
                message: "",
                create_time: { $date: { $numberLong: "1779811620000" } },
            },
        },
    ],
};

const post: GrokMediaPost = {
    id: "1b8074c0-59df-4703-b4da-0011c9949db5",
    original_prompt: "A black-and-white abstract drawing",
    media_type: "image",
    create_time: "2026-02-21T09:51:31.000110Z",
    link: "https://grok.com/imagine/post/1b8074c0-59df-4703-b4da-0011c9949db5",
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
        expect(adapter.getTitle(conversation)).toBe(
            "Dark Captivity Books Without Romance"
        );
        expect(adapter.getTitle(post)).toBe(
            "Imagine - A black-and-white abstract drawing"
        );
    });

    it("dates items in whole seconds", () => {
        expect(adapter.getCreateTime(conversation)).toBe(
            Math.floor(Date.parse("2026-05-26T16:06:57.420837Z") / 1000)
        );
        expect(adapter.getUpdateTime(post)).toBe(
            Math.floor(Date.parse("2026-02-21T09:51:31.000110Z") / 1000)
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
