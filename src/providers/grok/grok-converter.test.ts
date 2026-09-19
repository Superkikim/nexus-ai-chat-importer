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
            create_time: "2026-05-26T16:06:57.420Z",
            modify_time: "2026-05-26T16:10:41.726Z",
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
                response("d708", "ASSISTANT", "Answer", 5000),
                response("da30", "human", "Question", 5000),
                response("0001", "human", "Earlier", 4999),
            ])
        );

        expect(std.messages.map((m) => m.id)).toEqual(["0001", "da30", "d708"]);
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
            conversation([response("r1", "human", "Hi", 1779811617461)])
        );

        expect(std.messages[0].timestamp).toBe(1779811617.461);
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
                    file_attachments: ["8daf320f-73fb-47cf-b21a-b25e1da2aa39"],
                }),
            ])
        );

        expect(std.messages[0].attachments).toEqual([
            {
                fileName: "8daf320f-73fb-47cf-b21a-b25e1da2aa39",
                fileId: "8daf320f-73fb-47cf-b21a-b25e1da2aa39",
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
            Date.parse("2026-05-26T16:06:57.420Z") / 1000
        );
        expect(std.updateTime).toBe(
            Date.parse("2026-05-26T16:10:41.726Z") / 1000
        );
    });
});

describe("GrokConverter — assistant text", () => {
    const cards = GrokConverter.parseCards([
        JSON.stringify({
            id: "c4b8aa",
            type: "render_inline_citation",
            cardType: "citation_card",
            url: "https://www.the-line-up.com/dark-taboo-novels",
        }),
        JSON.stringify({
            id: "92a05a",
            cardType: "image_card",
            image: {
                title: "A picture",
                link: "https://example.com/article",
            },
        }),
    ]);

    it("replaces a citation with a link to its source", () => {
        const text =
            'Tracks.<grok:render card_id="c4b8aa" card_type="citation_card" type="render_inline_citation"><argument name="citation_id">12</argument></grok:render>\n\nNext';

        expect(GrokConverter.renderAssistantText(text, cards)).toBe(
            "Tracks. [the-line-up.com](https://www.the-line-up.com/dark-taboo-novels)\n\nNext"
        );
    });

    it("replaces an image card with a link to its page", () => {
        const text =
            'See<grok:render card_id="92a05a" card_type="image_card" type="render_searched_image"><argument name="image_id">0</argument></grok:render>';

        expect(GrokConverter.renderAssistantText(text, cards)).toBe(
            "See [🖼️ A picture](https://example.com/article)"
        );
    });

    it("drops a render tag whose card is unknown", () => {
        const text =
            'Text<grok:render card_id="nope" type="render_inline_citation"></grok:render>.';

        expect(GrokConverter.renderAssistantText(text, cards)).toBe("Text.");
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
        id: "b2d2143f-4e28-43fd-9a7a-8698bfd0c76a",
        original_prompt:
            "A digital illustration of a young Korean woman in a moody urban night setting.",
        media_type: "image",
        create_time: "2026-03-06T19:16:01.384710Z",
        link: "https://grok.com/imagine/post/b2d2143f-4e28-43fd-9a7a-8698bfd0c76a",
    };

    it("titles the note after the start of the prompt", () => {
        expect(GrokConverter.mediaPostTitle(post)).toBe(
            "Imagine - A digital illustration of a young Korean woman in..."
        );
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
