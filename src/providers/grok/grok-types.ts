// SPDX-License-Identifier: GPL-3.0-or-later
//
// Raw shapes of a Grok export (`prod-grok-backend.json`). Only the fields the
// importer reads are declared; the export carries many more (reasoning traces,
// tool steps, search results) that are deliberately ignored.

/** Mongo-style timestamp: `{ $date: { $numberLong: "<ms>" } }`. */
export interface GrokMongoDate {
    $date?: { $numberLong?: string } | string;
}

export interface GrokResponse {
    _id: string;
    conversation_id?: string;
    /** "human", "assistant", or "ASSISTANT" (older exports). */
    sender: string;
    message: string;
    model?: string;
    create_time: GrokMongoDate;
    /** Asset ids, resolved under `prod-mc-asset-server/<id>/content`. */
    file_attachments?: string[];
    /** JSON strings, one card each, referenced by `<grok:render card_id>`. */
    card_attachments_json?: string[];
    generated_image_urls?: string[];
}

export interface GrokConversationRecord {
    conversation: {
        id: string;
        title?: string;
        create_time?: string;
        modify_time?: string;
    };
    responses: { response: GrokResponse }[];
}

/** An Imagine post: a prompt and the media Grok generated from it. */
export interface GrokMediaPost {
    id: string;
    original_prompt?: string;
    /** "image" or "video". */
    media_type?: string;
    create_time?: string;
    /** `https://grok.com/imagine/post/<id>`. */
    link?: string;
}

/** One raw item of the export stream: a conversation or an Imagine post. */
export type GrokItem = GrokConversationRecord | GrokMediaPost;

export function isGrokConversation(
    item: unknown
): item is GrokConversationRecord {
    const record = item as GrokConversationRecord | null;
    return (
        !!record &&
        typeof record === "object" &&
        typeof record.conversation?.id === "string" &&
        Array.isArray(record.responses)
    );
}

export function isGrokMediaPost(item: unknown): item is GrokMediaPost {
    const record = item as GrokMediaPost | null;
    return (
        !!record &&
        typeof record === "object" &&
        typeof record.id === "string" &&
        "original_prompt" in record &&
        "media_type" in record
    );
}

/** A card from `card_attachments_json`. */
export interface GrokCard {
    id: string;
    cardType?: string;
    url?: string;
    image?: { title?: string; link?: string };
}
