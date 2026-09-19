// SPDX-License-Identifier: GPL-3.0-or-later
//
// Grok export → StandardConversation.
//
// A Grok export holds two kinds of item: conversations, and Imagine posts
// (a prompt and the media generated from it, made on grok.com/imagine). Both
// become notes; an Imagine post becomes a two-message note, the prompt and
// the generated media, the way a DALL-E image appears in a ChatGPT note.
//
// Reasoning traces, tool steps and search results are ignored, as for every
// provider. The message tree (`parent_response_id`) is ignored too: messages
// are ordered by their millisecond timestamps, regenerations included.

import {
    StandardAttachment,
    StandardConversation,
    StandardMessage,
} from "../../types/standard";
import { PROVIDER_URLS } from "../../config/constants";
import { truncateTitlePreview } from "../../utils/title-preview";
import { renderCollapsedCallout } from "../../utils/collapsed-callout";
import {
    GrokCard,
    GrokConversationRecord,
    GrokMediaPost,
    GrokMongoDate,
    GrokResponse,
} from "./grok-types";

export const GROK_IMAGINE_CATEGORY = "Imagine";

const RENDER_TAG_RE = /<grok:render\b([^>]*)>[\s\S]*?<\/grok:render>/g;
const ARTIFACT_TAG_RE = /<xaiArtifact\b([^>]*)>([\s\S]*?)<\/xaiArtifact>/g;

export class GrokConverter {
    static convertConversation(
        record: GrokConversationRecord
    ): StandardConversation {
        const id = record.conversation.id;
        const chatUrl = PROVIDER_URLS.GROK.CHAT(id);
        const messages = this.sortResponses(
            record.responses.map((r) => r.response).filter(Boolean)
        )
            .map((response) => this.convertResponse(response, chatUrl))
            .filter((message): message is StandardMessage => !!message);

        const createTime =
            this.parseIso(record.conversation.create_time) ||
            messages[0]?.timestamp ||
            0;
        const updateTime =
            this.parseIso(record.conversation.modify_time) ||
            messages[messages.length - 1]?.timestamp ||
            createTime;

        return {
            id,
            title: this.conversationTitle(record),
            provider: "grok",
            createTime,
            updateTime,
            messages,
            chatUrl,
            metadata: {},
        };
    }

    static convertMediaPost(post: GrokMediaPost): StandardConversation {
        const prompt = (post.original_prompt || "").trim();
        const timestamp = this.parseIso(post.create_time);
        const postUrl = post.link || PROVIDER_URLS.GROK.IMAGINE_POST(post.id);
        const isVideo = post.media_type === "video";

        const media: StandardAttachment = {
            fileName: post.id,
            fileId: post.id,
            attachmentType: "generated_image",
            generationPrompt: prompt || undefined,
            url: postUrl,
            providerMetadata: {
                imaginePost: true,
                mediaType: isVideo ? "video" : "image",
            },
        };

        return {
            id: post.id,
            title: this.mediaPostTitle(post),
            provider: "grok",
            createTime: timestamp,
            updateTime: timestamp,
            messages: [
                {
                    id: `${post.id}-prompt`,
                    role: "user",
                    content: prompt,
                    timestamp,
                },
                {
                    id: `${post.id}-media`,
                    role: "assistant",
                    content: "",
                    timestamp,
                    attachments: [media],
                },
            ],
            chatUrl: postUrl,
            metadata: {},
        };
    }

    static conversationTitle(record: GrokConversationRecord): string {
        return (record.conversation.title || "").trim() || "Untitled";
    }

    static mediaPostTitle(post: GrokMediaPost): string {
        return `${GROK_IMAGINE_CATEGORY} - ${truncateTitlePreview(
            post.original_prompt || ""
        )}`;
    }

    /** Unix seconds, fractional: millisecond order survives the conversion. */
    static parseMongoDate(value?: GrokMongoDate): number {
        const raw = value?.$date;
        const ms =
            typeof raw === "string"
                ? Date.parse(raw)
                : Number(raw?.$numberLong ?? NaN);
        return Number.isFinite(ms) ? ms / 1000 : 0;
    }

    static parseIso(value?: string): number {
        if (!value) return 0;
        const ms = Date.parse(value);
        return Number.isFinite(ms) ? ms / 1000 : 0;
    }

    static roleOf(response: GrokResponse): "user" | "assistant" | null {
        const sender = (response.sender || "").toLowerCase();
        if (sender === "human") return "user";
        if (sender === "assistant") return "assistant";
        return null;
    }

    /**
     * Chronological order. A question and its answer can share a
     * millisecond; the question goes first, then the id keeps the order
     * stable.
     */
    static sortResponses(responses: GrokResponse[]): GrokResponse[] {
        return [...responses].sort((a, b) => {
            const delta =
                this.parseMongoDate(a.create_time) -
                this.parseMongoDate(b.create_time);
            if (delta !== 0) return delta;
            const rank = (r: GrokResponse) =>
                this.roleOf(r) === "user" ? 0 : 1;
            if (rank(a) !== rank(b)) return rank(a) - rank(b);
            return a._id.localeCompare(b._id);
        });
    }

    static convertResponse(
        response: GrokResponse,
        chatUrl: string
    ): StandardMessage | null {
        const role = this.roleOf(response);
        if (!role || !response._id) return null;

        const content =
            role === "assistant"
                ? this.renderAssistantText(
                      response.message || "",
                      this.parseCards(response.card_attachments_json)
                  )
                : (response.message || "").trim();

        const attachments: StandardAttachment[] = (
            response.file_attachments ?? []
        ).map((fileId) => ({
            fileName: fileId,
            fileId,
            attachmentType: role === "user" ? "file" : "generated_image",
            url: chatUrl,
        }));

        if (!content && attachments.length === 0) return null;

        return {
            id: response._id,
            role,
            content,
            timestamp: this.parseMongoDate(response.create_time),
            model:
                role === "assistant" && response.model
                    ? response.model
                    : undefined,
            attachments: attachments.length > 0 ? attachments : undefined,
        };
    }

    static parseCards(raw?: string[]): Map<string, GrokCard> {
        const cards = new Map<string, GrokCard>();
        for (const json of raw ?? []) {
            try {
                const card = JSON.parse(json) as GrokCard;
                if (card?.id) cards.set(card.id, card);
            } catch {
                // A malformed card only loses its link.
            }
        }
        return cards;
    }

    /** Resolve citation and image cards, and unfold inline artifacts. */
    static renderAssistantText(
        text: string,
        cards: Map<string, GrokCard>
    ): string {
        const withCards = text.replace(RENDER_TAG_RE, (_tag, attrs: string) => {
            const card = cards.get(this.attribute(attrs, "card_id") ?? "");
            return card ? this.renderCard(card) : "";
        });

        const withArtifacts = withCards.replace(
            ARTIFACT_TAG_RE,
            (_tag, attrs: string, body: string) =>
                `\n\n${this.renderArtifact(attrs, body)}\n\n`
        );

        return withArtifacts.replace(/\n{3,}/g, "\n\n").trim();
    }

    private static renderCard(card: GrokCard): string {
        if (card.cardType === "citation_card" && card.url) {
            return ` [${this.hostOf(card.url)}](${card.url})`;
        }
        if (card.cardType === "image_card" && card.image?.link) {
            const label =
                (card.image.title || "").trim() || this.hostOf(card.image.link);
            return ` [🖼️ ${label}](${card.image.link})`;
        }
        return "";
    }

    private static renderArtifact(attrs: string, body: string): string {
        const title = this.attribute(attrs, "title") || "Artifact";
        const contentType = this.attribute(attrs, "contentType") || "";
        const language = this.fenceLanguage(contentType, title);
        return renderCollapsedCallout("nexus_artifact", title, body.trim(), {
            fence: language ?? false,
        });
    }

    /** Prose stays prose; anything else is fenced, tagged when known. */
    private static fenceLanguage(
        contentType: string,
        title: string
    ): string | null {
        const type = contentType.toLowerCase();
        if (type === "" || type === "text/markdown" || type === "text/plain") {
            return null;
        }
        const subtype = type.split("/").pop() ?? "";
        const extension = title.includes(".")
            ? title.split(".").pop()!.toLowerCase()
            : "";
        return (extension || subtype.replace(/^x-/, "")).replace(
            /[^a-z0-9+#-]/g,
            ""
        );
    }

    private static attribute(attrs: string, name: string): string | null {
        const match = attrs.match(new RegExp(`\\b${name}="([^"]*)"`));
        return match ? match[1] : null;
    }

    private static hostOf(url: string): string {
        try {
            return new URL(url).hostname.replace(/^www\./, "");
        } catch {
            return "source";
        }
    }
}
