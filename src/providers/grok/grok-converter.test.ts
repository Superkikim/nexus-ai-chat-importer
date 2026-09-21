import { describe, expect, it } from "vitest";
import { GrokConverter } from "./grok-converter";
import { GrokConversationRecord, GrokResponse } from "./grok-types";

function response(
    id: string,
    sender: string,
    message: string,
    ms: number,
    extra: Partial<GrokResponse> = {}
): { response: GrokResponse } {
    return {
        response: {
            _id: id,
            sender,
            message,
            create_time: { $date: { $numberLong: String(ms) } },
            ...extra,
        },
    };
}

function conversation(
    responses: { response: GrokResponse }[],
    title = "A title"
): GrokConversationRecord {
    return {
        conversation: {
            id: "c0ffee00-0000-0000-0000-000000000000",
            title,
            create_time: "2026-01-10T08:00:00.123Z",
            modify_time: "2026-01-10T08:05:00.456Z",
        },
        responses,
    };
}

describe("GrokConverter — conversations", () => {
    it("maps senders to roles, whatever their case", () => {
        const std = GrokConverter.convertConversation(
            conversation([
                response("r1", "human", "Hi", 1000),
                response("r2", "ASSISTANT", "Hello", 2000),
                response("r3", "assistant", "Again", 3000),
            ])
        );

        expect(std.messages.map((m) => m.role)).toEqual([
            "user",
            "assistant",
            "assistant",
        ]);
    });

    it("orders by millisecond, the question first when both share one", () => {
        const std = GrokConverter.convertConversation(
            conversation([
                response("a002", "ASSISTANT", "Answer", 5000),
                response("a001", "human", "Question", 5000),
                response("0001", "human", "Earlier", 4999),
            ])
        );

        expect(std.messages.map((m) => m.id)).toEqual(["0001", "a001", "a002"]);
    });

    it("keeps every regenerated answer, in order", () => {
        const std = GrokConverter.convertConversation(
            conversation([
                response("q", "human", "Q", 1000),
                response("a2", "assistant", "Second try", 3000),
                response("a1", "assistant", "First try", 2000),
            ])
        );

        expect(std.messages.map((m) => m.content)).toEqual([
            "Q",
            "First try",
            "Second try",
        ]);
    });

    it("keeps millisecond precision in the timestamps", () => {
        const std = GrokConverter.convertConversation(
            conversation([response("r1", "human", "Hi", 1768032000123)])
        );

        expect(std.messages[0].timestamp).toBe(1768032000.123);
    });

    it("drops a response with neither text nor file", () => {
        const std = GrokConverter.convertConversation(
            conversation([
                response("q", "human", "Q", 1000),
                response("a", "ASSISTANT", "   ", 2000),
            ])
        );

        expect(std.messages.map((m) => m.id)).toEqual(["q"]);
    });

    it("turns file_attachments into attachments linked to the conversation", () => {
        const std = GrokConverter.convertConversation(
            conversation([
                response("q", "human", "Look", 1000, {
                    file_attachments: ["44444444-dddd-4ddd-8ddd-444444444444"],
                }),
            ])
        );

        expect(std.messages[0].attachments).toEqual([
            {
                fileName: "44444444-dddd-4ddd-8ddd-444444444444",
                fileId: "44444444-dddd-4ddd-8ddd-444444444444",
                attachmentType: "file",
                url: "https://grok.com/c/c0ffee00-0000-0000-0000-000000000000",
            },
        ]);
    });

    it("carries the model on assistant messages only", () => {
        const std = GrokConverter.convertConversation(
            conversation([
                response("q", "human", "Q", 1000, { model: "grok-4" }),
                response("a", "assistant", "A", 2000, { model: "grok-4" }),
            ])
        );

        expect(std.messages.map((m) => m.model)).toEqual([undefined, "grok-4"]);
    });

    it("links the conversation and keeps its title and dates", () => {
        const std = GrokConverter.convertConversation(
            conversation([response("q", "human", "Q", 1000)], "  Books  ")
        );

        expect(std.title).toBe("Books");
        expect(std.chatUrl).toBe(
            "https://grok.com/c/c0ffee00-0000-0000-0000-000000000000"
        );
        expect(std.createTime).toBe(
            Date.parse("2026-01-10T08:00:00.123Z") / 1000
        );
        expect(std.updateTime).toBe(
            Date.parse("2026-01-10T08:05:00.456Z") / 1000
        );
    });
    it("dates the update from the last message when it is later than Grok's", () => {
        const lastMs = Date.parse("2026-01-12T00:00:00.000Z");
        const std = GrokConverter.convertConversation(
            conversation([response("q", "human", "Late", lastMs)])
        );

        expect(std.updateTime).toBe(lastMs / 1000);
    });
});

describe("GrokConverter — assistant text", () => {
    const cards = GrokConverter.parseCards([
        JSON.stringify({
            id: "card01",
            type: "render_inline_citation",
            cardType: "citation_card",
            url: "https://www.example.org/reading-list",
        }),
        JSON.stringify({
            id: "card02",
            cardType: "image_card",
            image: {
                title: "A picture",
                link: "https://example.com/article",
            },
        }),
    ]);

    it("replaces a citation with a link to its source", () => {
        const text =
            'Sources.<grok:render card_id="card01" card_type="citation_card" type="render_inline_citation"><argument name="citation_id">12</argument></grok:render>\n\nNext';

        expect(GrokConverter.renderAssistantText(text, cards)).toBe(
            "Sources. [example.org](https://www.example.org/reading-list)\n\nNext"
        );
    });

    it("replaces an image card with a link to its page", () => {
        const text =
            'See<grok:render card_id="card02" card_type="image_card" type="render_searched_image"><argument name="image_id">0</argument></grok:render>';

        expect(GrokConverter.renderAssistantText(text, cards)).toBe(
            "See [🖼️ A picture](https://example.com/article)"
        );
    });

    it("drops a render tag whose card is unknown", () => {
        const text =
            'Text<grok:render card_id="nope" type="render_inline_citation"></grok:render>.';

        expect(GrokConverter.renderAssistantText(text, cards)).toBe("Text.");
    });
    it("leaves the blank lines of the text alone", () => {
        const text = "```\na\n\n\n\nb\n```";

        expect(GrokConverter.renderAssistantText(text, cards)).toBe(text);
    });

    it("unfolds a markdown artifact into a collapsed callout", () => {
        const text =
            'Here.\n<xaiArtifact artifact_id="a1" artifact_version_id="v1" title="story.md" contentType="text/markdown">\n\n# Story\n\nOnce.\n</xaiArtifact>\nDone.';

        expect(GrokConverter.renderAssistantText(text, cards)).toBe(
            "Here.\n\n>[!nexus_artifact]- **story.md**\n> # Story\n>\n> Once.\n\nDone."
        );
    });

    it("fences a code artifact in its language", () => {
        const text =
            '<xaiArtifact artifact_id="a1" title="run.py" contentType="text/x-python">print(1)</xaiArtifact>';

        expect(GrokConverter.renderAssistantText(text, cards)).toBe(
            ">[!nexus_artifact]- **run.py**\n> ```py\n> print(1)\n> ```"
        );
    });
});

describe("GrokConverter — Imagine posts", () => {
    const post = {
        id: "33333333-cccc-4ccc-8ccc-333333333333",
        original_prompt:
            "A pencil sketch of a red bicycle leaning against a stone wall in the rain.",
        media_type: "image",
        create_time: "2026-01-13T10:00:00.000000Z",
        link: "https://grok.com/imagine/post/33333333-cccc-4ccc-8ccc-333333333333",
    };

    it("titles the note after the start of the prompt", () => {
        expect(GrokConverter.mediaPostTitle(post)).toBe(
            "Imagine - A pencil sketch of a red bicycle leaning against a..."
        );
    });
    it("keeps the title on one line", () => {
        expect(
            GrokConverter.mediaPostTitle({
                ...post,
                original_prompt: "Two lines:\nfirst\r\nsecond",
            })
        ).toBe("Imagine - Two lines: first second");
    });

    it("becomes the prompt, then the generated media", () => {
        const std = GrokConverter.convertMediaPost(post);

        expect(std.id).toBe(post.id);
        expect(std.chatUrl).toBe(post.link);
        expect(std.messages.map((m) => [m.role, m.content])).toEqual([
            ["user", post.original_prompt],
            ["assistant", ""],
        ]);
        expect(std.messages[1].attachments).toEqual([
            {
                fileName: post.id,
                fileId: post.id,
                attachmentType: "generated_image",
                generationPrompt: post.original_prompt,
                url: post.link,
                providerMetadata: { imaginePost: true, mediaType: "image" },
            },
        ]);
    });
});
