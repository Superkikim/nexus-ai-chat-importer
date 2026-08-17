// SPDX-License-Identifier: GPL-3.0-or-later
//
// Reconciles ChatGPT library artifacts (generated images and generated
// documents) with the messages of a single conversation.
//
// Generated content lives in library_files.json, not in the message's own
// metadata.attachments, and the message that produced it is sometimes missing
// from the export entirely. This module decides — from normalized models only —
// which artifact belongs to which message, creating a minimal synthetic
// assistant message when the originating message was omitted.
//
// It is deliberately PURE: no ZIP access, no Obsidian API, no I/O. Payload
// availability is supplied by the caller as a predicate so the reconciler stays
// testable in isolation and never forces a `.dat` read.

import { StandardAttachment, StandardMessage } from "../../types/standard";
import { ScopedLogger } from "../../logger";
import { sortMessagesByTimestamp } from "../../utils/message-utils";
import {
    ChatGPTLibraryEntry,
    ChatGPTLibraryIndex,
    classifyChatGPTLibraryArtifact,
} from "./chatgpt-library-index";
import { createLibraryAttachment } from "./chatgpt-library-attachment";
import { isImageGenerationRequest } from "./chatgpt-generated-image";

/** Aggregate counters for debug logging — never file names or user content. */
export interface LibraryReconciliationStats {
    /** Attached to the exported message named by origination_message_id. */
    attachedToExportedMessage: number;
    /** Attached in place of a "generated image not in export" placeholder. */
    replacedPlaceholder: number;
    /** Attached to a synthetic message because the real one was omitted. */
    attachedToSyntheticMessage: number;
    /** Already present on a message (user upload seen by both pipelines). */
    alreadyReferenced: number;
    /** Supported artifact whose `.dat` payload is absent from the archive. */
    missingPayload: number;
    /** Supported artifact with no message and no conversation match here. */
    noConversationMatch: number;
    /** Entry type we do not inject (upload, writing_block, unknown type). */
    unsupported: number;
}

function emptyStats(): LibraryReconciliationStats {
    return {
        attachedToExportedMessage: 0,
        replacedPlaceholder: 0,
        attachedToSyntheticMessage: 0,
        alreadyReferenced: 0,
        missingPayload: 0,
        noConversationMatch: 0,
        unsupported: 0,
    };
}

/** Placeholder produced by annotateMissingGeneratedImages() for an omitted image. */
function isMissingGeneratedImagePlaceholder(
    attachment: StandardAttachment
): boolean {
    return (
        attachment.attachmentType === "generated_image" &&
        attachment.status?.found === false &&
        attachment.status?.reason === "not_in_export"
    );
}

function readLibraryMetadata(
    attachment: StandardAttachment
): Record<string, unknown> | undefined {
    const library = attachment.providerMetadata?.library;
    return typeof library === "object" && library !== null
        ? (library as Record<string, unknown>)
        : undefined;
}

function readDalleMetadata(
    attachment: StandardAttachment
): Record<string, unknown> | undefined {
    const dalle = attachment.providerMetadata?.dalle;
    return typeof dalle === "object" && dalle !== null
        ? (dalle as Record<string, unknown>)
        : undefined;
}

/**
 * Identity keys for an attachment already present on a message. An artifact
 * sharing any key with an existing attachment is considered already imported.
 */
function attachmentIdentityKeys(attachment: StandardAttachment): string[] {
    const keys: string[] = [];
    if (attachment.fileId) keys.push(attachment.fileId);

    const library = readLibraryMetadata(attachment);
    if (typeof library?.libraryFileId === "string") {
        keys.push(library.libraryFileId);
    }
    if (typeof library?.imageGenerationId === "string") {
        keys.push(library.imageGenerationId);
    }

    const dalle = readDalleMetadata(attachment);
    if (typeof dalle?.gen_id === "string") keys.push(dalle.gen_id);

    return keys;
}

/** Identity keys for a library entry, matched against the set above. */
function entryIdentityKeys(entry: ChatGPTLibraryEntry): string[] {
    const keys = [entry.fileId];
    if (entry.libraryFileId) keys.push(entry.libraryFileId);
    if (entry.imageGenerationId) keys.push(entry.imageGenerationId);
    return keys;
}

/**
 * True when an entry's own thread claim, if any, does not rule out this
 * conversation. An entry with no thread claim at all is only reached here via
 * a message-id match, so it is treated as belonging to that message's
 * conversation.
 */
function belongsToConversation(
    entry: ChatGPTLibraryEntry,
    conversationId: string
): boolean {
    return (
        !entry.originationThreadId ||
        entry.originationThreadId === conversationId
    );
}

/**
 * Candidate entries for this conversation, deduplicated by file id and ordered
 * deterministically (creation time, then file id) so reconciliation of the same
 * export always produces the same result.
 *
 * A candidate reached only through a message-id collision with a DIFFERENT
 * conversation's entry is included too (rather than silently dropped here) so
 * the main loop's ownership check can count and log it as "no conversation
 * match" instead of the export simply looking like it had nothing to say.
 */
function collectCandidates(
    messages: StandardMessage[],
    conversationId: string,
    index: ChatGPTLibraryIndex
): ChatGPTLibraryEntry[] {
    const byFileId = new Map<string, ChatGPTLibraryEntry>();

    for (const entry of index.byOriginationThreadId.get(conversationId) ?? []) {
        if (!byFileId.has(entry.fileId)) byFileId.set(entry.fileId, entry);
    }

    for (const message of messages) {
        if (!message.id) continue;
        for (const entry of index.byOriginationMessageId.get(message.id) ??
            []) {
            if (!byFileId.has(entry.fileId)) byFileId.set(entry.fileId, entry);
        }
    }

    return [...byFileId.values()].sort((a, b) => {
        const aTime = a.createdAt ?? 0;
        const bTime = b.createdAt ?? 0;
        if (aTime !== bTime) return aTime - bTime;
        return a.fileId.localeCompare(b.fileId);
    });
}

/** Library timestamps are epoch milliseconds; StandardMessage uses seconds. */
function toUnixSeconds(createdAtMs: number | undefined): number | undefined {
    if (createdAtMs === undefined) return undefined;
    return Math.floor(createdAtMs / 1000);
}

interface WorkingMessage {
    message: StandardMessage;
    attachments: StandardAttachment[];
    /** Index of an unconsumed missing-image placeholder, when present. */
    placeholderIndex: number | null;
    dirty: boolean;
}

export interface LibraryReconciliationResult {
    messages: StandardMessage[];
    stats: LibraryReconciliationStats;
}

/**
 * Attach this conversation's library artifacts to its messages.
 *
 * Attachment priority, first match wins:
 *   1. Already referenced by an exported message — nothing to do.
 *   2. `origination_message_id` names a message present in the export.
 *   3. A "generated image not in export" placeholder is waiting — the real
 *      file replaces it in place, keeping the position and prompt the
 *      conversion pass already worked out.
 *   4. `origination_thread_id` matches this conversation — a minimal synthetic
 *      assistant message is created at the artifact's real creation time.
 *   5. Otherwise the artifact is left alone (it belongs to a conversation that
 *      is not in this export, or only to the global library).
 *
 * The function is pure and idempotent: running it on its own output changes
 * nothing, because every artifact it attaches is then found by rule 1.
 *
 * @param messages - converted, chronologically ordered messages
 * @param conversationId - id of the conversation being processed
 * @param index - normalized library index for the archive
 * @param hasPayload - true when `<fileId>.dat` exists (metadata check only)
 * @param log - optional logger for aggregate debug counters
 */
export function reconcileChatGPTLibraryArtifacts(
    messages: StandardMessage[],
    conversationId: string,
    index: ChatGPTLibraryIndex,
    hasPayload: (fileId: string) => boolean,
    log?: ScopedLogger
): LibraryReconciliationResult {
    const stats = emptyStats();

    const candidates = collectCandidates(messages, conversationId, index);
    if (candidates.length === 0) {
        return { messages, stats };
    }

    const working: WorkingMessage[] = messages.map((message) => {
        const attachments = message.attachments ?? [];
        const placeholderIndex = attachments.findIndex(
            isMissingGeneratedImagePlaceholder
        );
        return {
            message,
            attachments,
            placeholderIndex: placeholderIndex === -1 ? null : placeholderIndex,
            dirty: false,
        };
    });

    // Identity keys already present anywhere in the conversation.
    const seenKeys = new Set<string>();
    for (const item of working) {
        for (const attachment of item.attachments) {
            for (const key of attachmentIdentityKeys(attachment)) {
                seenKeys.add(key);
            }
        }
    }

    const byMessageId = new Map<string, WorkingMessage>();
    for (const item of working) {
        if (item.message.id && !byMessageId.has(item.message.id)) {
            byMessageId.set(item.message.id, item);
        }
    }

    // Synthetic hosts created during this pass, so several artifacts lost with
    // the same message land on one message instead of one message each.
    const syntheticHosts = new Map<string, WorkingMessage>();
    const created: WorkingMessage[] = [];
    // User requests already used as a generation prompt — a prompt is never
    // reused, so a competing artifact gets no prompt rather than a wrong one.
    const consumedPromptIds = new Set<string>();

    for (const entry of candidates) {
        const kind = classifyChatGPTLibraryArtifact(entry, log);
        if (kind === "unsupported") {
            stats.unsupported++;
            continue;
        }

        // Rule 1: already imported through the message's own attachments.
        if (entryIdentityKeys(entry).some((key) => seenKeys.has(key))) {
            stats.alreadyReferenced++;
            continue;
        }

        // Never advertise a file the archive does not actually carry: an
        // existing placeholder stays, which is the honest result.
        if (!hasPayload(entry.fileId)) {
            stats.missingPayload++;
            continue;
        }

        // An entry whose own thread claim names a different conversation is
        // never attached here, even if a message id happens to collide —
        // it falls through every rule below to rule 5.
        const ownedHere = belongsToConversation(entry, conversationId);

        // Rule 2: the exported message that produced it.
        let host =
            ownedHere && entry.originationMessageId
                ? byMessageId.get(entry.originationMessageId)
                : undefined;
        let outcome: keyof LibraryReconciliationStats | undefined = host
            ? "attachedToExportedMessage"
            : undefined;

        // Rule 3: take over a waiting placeholder (images only).
        if (!host && ownedHere && kind === "generated_image") {
            host = working.find((item) => item.placeholderIndex !== null);
            if (host) outcome = "replacedPlaceholder";
        }

        // Rule 4: the message was omitted but the conversation is ours.
        if (!host && entry.originationThreadId === conversationId) {
            const hostKey = entry.originationMessageId ?? entry.fileId;
            host = syntheticHosts.get(hostKey);
            if (!host) {
                host = createSyntheticHost(hostKey, entry, working, created);
                syntheticHosts.set(hostKey, host);
                created.push(host);
            }
            outcome = "attachedToSyntheticMessage";
        }

        // Rule 5: not ours — leave it in the library.
        if (!host || !outcome) {
            stats.noConversationMatch++;
            continue;
        }

        // A real file supersedes any placeholder on its host message, whichever
        // rule chose that host. The placeholder's prompt is the one the
        // conversion pass already resolved, so it is preferred.
        const inheritedPrompt = consumePlaceholder(host, kind);
        if (inheritedPrompt !== undefined) {
            outcome = "replacedPlaceholder";
        }

        const prompt =
            kind === "generated_image"
                ? inheritedPrompt ||
                  takeNearestPrompt(
                      working,
                      toUnixSeconds(entry.createdAt) ?? host.message.timestamp,
                      consumedPromptIds
                  )
                : undefined;

        host.attachments = [
            ...host.attachments,
            createLibraryAttachment(entry, kind, prompt),
        ];
        host.dirty = true;

        for (const key of entryIdentityKeys(entry)) seenKeys.add(key);
        stats[outcome]++;
    }

    log?.debug("ChatGPT library artifacts reconciled", {
        conversationId,
        candidates: candidates.length,
        ...stats,
    });

    if (created.length === 0 && !working.some((item) => item.dirty)) {
        return { messages, stats };
    }

    const result = [...working, ...created].map((item) =>
        item.dirty
            ? { ...item.message, attachments: item.attachments }
            : item.message
    );

    return { messages: sortMessagesByTimestamp(result), stats };
}

/**
 * Drop the "generated image not in export" placeholder from a host that is
 * about to receive the real file, and hand back the prompt it carried.
 *
 * Returns the placeholder's prompt (empty string when it had none) so the
 * caller can tell "consumed" from "nothing to consume" (`undefined`).
 */
function consumePlaceholder(
    host: WorkingMessage,
    kind: "generated_image" | "generated_document"
): string | undefined {
    if (kind !== "generated_image" || host.placeholderIndex === null) {
        return undefined;
    }

    const index = host.placeholderIndex;
    const prompt = host.attachments[index].generationPrompt ?? "";
    host.attachments = host.attachments.filter((_, i) => i !== index);
    host.dirty = true;

    // A message can hold more than one placeholder; expose the next one.
    const next = host.attachments.findIndex(isMissingGeneratedImagePlaceholder);
    host.placeholderIndex = next === -1 ? null : next;

    return prompt;
}

/**
 * Minimal assistant message standing in for one ChatGPT omitted from the
 * export. It carries the artifact and nothing else — no invented prose — and
 * is positioned at the artifact's real creation time.
 *
 * The identifier is derived from the omitted message id when the export names
 * one (so several artifacts from the same lost message share one host), and
 * from the file id otherwise. Both are stable across imports, which is what
 * keeps a second Reprocess idempotent.
 */
function createSyntheticHost(
    hostKey: string,
    entry: ChatGPTLibraryEntry,
    working: WorkingMessage[],
    created: WorkingMessage[]
): WorkingMessage {
    const createdAtSeconds = toUnixSeconds(entry.createdAt);
    const lastTimestamp = [...working, ...created].reduce(
        (max, item) => Math.max(max, item.message.timestamp),
        0
    );

    return {
        message: {
            id: `nexus-library-artifact-${hostKey}`,
            role: "assistant",
            content: "",
            timestamp: createdAtSeconds ?? lastTimestamp + 1,
        },
        attachments: [],
        placeholderIndex: null,
        dirty: true,
    };
}

/**
 * The user turn that produced this image, when the choice is unambiguous.
 *
 * Two signals, in order:
 *   1. The nearest preceding user message that explicitly asks for an image
 *      ("generate an image of ..."). Strongest signal, used whenever present.
 *   2. Otherwise, the message immediately preceding the artifact, if it is a
 *      user turn. Raw image prompts routinely carry no generation verb at all
 *      ("A minimalist flat vector logo mark, pure monochrome black on ..."),
 *      so requiring one would drop the very prompt the note exists to
 *      preserve. Adjacency is the non-ambiguity condition: nothing stands
 *      between that turn and the generated file.
 *
 * A request already claimed by another artifact is never reused — a competing
 * artifact gets no prompt rather than a wrong one.
 */
function takeNearestPrompt(
    working: WorkingMessage[],
    artifactTimestamp: number,
    consumedPromptIds: Set<string>
): string | undefined {
    let request: StandardMessage | undefined; // nearest explicit image request
    let preceding: StandardMessage | undefined; // nearest turn, any role

    // Scan by timestamp rather than array position so the result does not
    // depend on the caller having pre-sorted the messages.
    for (const item of working) {
        const message = item.message;
        if (message.timestamp > artifactTimestamp) continue;

        if (!preceding || message.timestamp >= preceding.timestamp) {
            preceding = message;
        }
        if (
            message.role === "user" &&
            isImageGenerationRequest(message.content) &&
            (!request || message.timestamp >= request.timestamp)
        ) {
            request = message;
        }
    }

    if (request) {
        if (consumedPromptIds.has(request.id)) return undefined;
        consumedPromptIds.add(request.id);
        return request.content.trim();
    }

    if (
        preceding &&
        preceding.role === "user" &&
        preceding.content.trim() &&
        !consumedPromptIds.has(preceding.id)
    ) {
        consumedPromptIds.add(preceding.id);
        return preceding.content.trim();
    }

    return undefined;
}
