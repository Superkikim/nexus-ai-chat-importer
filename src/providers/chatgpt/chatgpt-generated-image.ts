// SPDX-License-Identifier: GPL-3.0-or-later
//
// Unified "generated image" handling for ChatGPT imports.
//
// Generated images can reach the importer two ways:
//   1. Structured (older / DALL-E exports, and new exports that embed
//      "dalle-generations/*.webp"): the image is referenced by the message and
//      resolves like any other attachment. Handled by chatgpt-dalle-processor.ts
//      and the asset index — NOT touched here.
//   2. Omitted (recent 2026 exports): ChatGPT no longer ships generated images
//      at all (no asset, no .dat, no metadata). Only the conversation text
//      survives. This module detects those turns and inserts a clear placeholder
//      so the loss is visible instead of silent.
//
// To avoid regressing case 1, the heuristic here runs ONLY when a conversation
// has no structured generated-image data and no assistant-side image, and it
// keys off message role (user request vs assistant claim).

import { Chat, ChatMessage } from "./chatgpt-types";
import { StandardMessage, StandardAttachment } from "../../types/standard";
import { ChatGPTDalleProcessor } from "./chatgpt-dalle-processor";
import { isImageFile } from "../../utils/file-utils";

// A user asking for an image: a generation verb followed (closely) by an
// image noun. Matched per line to keep the window tight.
const REQUEST_RE =
    /\b(g[ée]n[èe]re|g[ée]n[èe]rer|cr[ée]e|cr[ée]er|dessine|dessiner|generate|create|make|draw|render)\b[^.!?\n]{0,25}\b(image|illustration|visuel|dessin|picture|photo|artwork|logo)\b/i;

// A generation verb anywhere (looser): used only to remember the most recent
// user message as the "prompt" even when it lacks an explicit image noun
// (e.g. "Crée une représentation photoréaliste de ...").
const GEN_VERB_RE =
    /\b(g[ée]n[èe]re|g[ée]n[èe]rer|cr[ée]e|cr[ée]er|dessine|dessiner|generate|create|make|draw|render)\b/i;

// An assistant claiming it produced an image.
const ASSISTANT_CLAIM_RES: RegExp[] = [
    /\bimages?\s+g[ée]n[ée]r[ée]e?s?\b/i,
    /\bvoici\s+(?:ton|votre|une?|l[' ]?)\s*(?:image|illustration|visuel)/i,
    /\bj'?ai\s+(?:g[ée]n[ée]r[ée]|cr[éé]é|dessin[ée]|r[ée]alis[ée])[^.!?\n]{0,25}(?:image|illustration|visuel)/i,
    /\b(?:here(?:'s| is)|i\s+(?:have\s+)?(?:generated|created|made))[^.!?\n]{0,25}(?:image|illustration|picture)/i,
    /\bgenerated\s+image\b/i,
];

/** True when a user line asks for an image to be generated. */
export function isImageGenerationRequest(text: string): boolean {
    if (!text) return false;
    return text.split("\n").some((line) => REQUEST_RE.test(line));
}

/** True when an assistant message claims it produced an image. */
export function isAssistantImageClaim(text: string): boolean {
    if (!text) return false;
    return ASSISTANT_CLAIM_RES.some((re) => re.test(text));
}

/**
 * True when the raw conversation already carries structured generated-image
 * data (DALL-E asset metadata or a DALL-E prompt message). In that case the
 * existing structured pipeline owns rendering and the heuristic must stay off.
 */
export function hasStructuredGeneratedImage(chat: Chat): boolean {
    const mapping = chat?.mapping;
    if (!mapping) return false;

    for (const node of Object.values(mapping)) {
        const message = (node as { message?: ChatMessage })?.message;
        if (!message) continue;

        if (ChatGPTDalleProcessor.isDallePromptMessage(message)) {
            return true;
        }

        const parts = message.content?.parts;
        if (!Array.isArray(parts)) continue;
        for (const part of parts) {
            if (
                part &&
                typeof part === "object" &&
                (part as Record<string, unknown>).content_type ===
                    "image_asset_pointer" &&
                (part as Record<string, unknown>).metadata
            ) {
                return true;
            }
        }
    }

    return false;
}

/** Build a placeholder attachment for an image that the export omitted. */
export function createMissingGeneratedImageAttachment(
    promptText?: string
): StandardAttachment {
    const trimmed = (promptText || "").trim();
    const warning =
        "⚠️ ChatGPT generated an image here, but recent exports no longer include generated images. Open the original conversation to view it.";

    let extractedContent: string;
    if (trimmed) {
        const formattedPrompt = trimmed.split("\n").join("\n>> ");
        extractedContent = `>>[!nexus_prompt] **Image prompt**
>> \`\`\`
>> ${formattedPrompt}
>> \`\`\`
>
>>[!nexus_attachment] **Generated image — not in export**
>> ${warning}`;
    } else {
        extractedContent = `>>[!nexus_attachment] **Generated image — not in export**
>> ${warning}`;
    }

    return {
        fileName: "generated_image_not_in_export.png",
        fileType: "image/png",
        attachmentType: "generated_image",
        generationPrompt: trimmed || undefined,
        extractedContent,
        status: {
            processed: true,
            found: false,
            reason: "not_in_export",
            note: "Generated images are omitted by recent ChatGPT exports.",
        },
    };
}

function messageHasImageAttachment(message: StandardMessage): boolean {
    return (message.attachments ?? []).some(
        (att) => att.attachmentType === "generated_image" || isImageFile(att)
    );
}

function appendPlaceholder(
    message: StandardMessage,
    promptText: string | undefined
): StandardMessage {
    return {
        ...message,
        attachments: [
            ...(message.attachments ?? []),
            createMissingGeneratedImageAttachment(promptText),
        ],
    };
}

function makeSyntheticPlaceholderMessage(
    promptText: string | undefined,
    timestamp: number,
    seq: number
): StandardMessage {
    return {
        id: `nexus-generated-image-missing-${seq}`,
        role: "assistant",
        content: "",
        timestamp,
        attachments: [createMissingGeneratedImageAttachment(promptText)],
    };
}

/**
 * Insert "generated image not in export" placeholders for conversations whose
 * generated images were omitted by the export. No-op for conversations that
 * still carry their generated images (structured data or an assistant-side
 * image present), so older/DALL-E exports are unaffected.
 *
 * `messages` is assumed chronologically ordered.
 */
export function annotateMissingGeneratedImages(
    messages: StandardMessage[],
    chat: Chat
): StandardMessage[] {
    if (messages.length === 0) return messages;
    if (hasStructuredGeneratedImage(chat)) return messages;

    // If the conversation already has an assistant-side image, generation
    // worked here — don't second-guess it.
    if (
        messages.some(
            (m) => m.role === "assistant" && messageHasImageAttachment(m)
        )
    ) {
        return messages;
    }

    const result: StandardMessage[] = [];
    let pendingPrompt: string | null = null; // a request awaiting its assistant turn
    let lastGenerationPrompt: string | undefined; // best-known prompt text
    let seq = 0;

    for (const message of messages) {
        if (message.role === "user") {
            if (GEN_VERB_RE.test(message.content)) {
                lastGenerationPrompt = message.content.trim();
            }
            if (isImageGenerationRequest(message.content)) {
                pendingPrompt = message.content.trim();
            }
            result.push(message);
            continue;
        }

        // assistant message
        const claim = isAssistantImageClaim(message.content);
        if ((pendingPrompt || claim) && !messageHasImageAttachment(message)) {
            const prompt = pendingPrompt || lastGenerationPrompt;
            result.push(appendPlaceholder(message, prompt));
            pendingPrompt = null;
            seq++;
        } else {
            result.push(message);
        }
    }

    // A request with no following assistant turn (e.g. only the user message
    // survived the export) — synthesize an assistant placeholder.
    if (pendingPrompt) {
        const last = result[result.length - 1];
        result.push(
            makeSyntheticPlaceholderMessage(
                pendingPrompt || lastGenerationPrompt,
                (last?.timestamp || 0) + 1,
                seq
            )
        );
    }

    return result;
}
