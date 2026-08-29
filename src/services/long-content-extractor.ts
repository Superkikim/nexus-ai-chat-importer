/**
 * Nexus AI Chat Importer - Obsidian Plugin
 * Copyright (C) 2024 Akim Sissaoui
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

// src/services/long-content-extractor.ts
import type NexusAiChatImporterPlugin from "../main";
import { StandardMessage } from "../types/standard";
import { ensureFolderExists, generateConversationFileName } from "../utils";
import { resolveAttachmentTarget } from "../utils/attachment-target";

/**
 * A line this long is not prose. Nobody writes ten thousand characters without
 * a line break: past this it is JSON, markup or machine output, pasted into a
 * conversation. Obsidian parses a line whole, so a handful of them slow the
 * whole vault down — not just the note holding them.
 *
 * Measured on 5.7 million lines of ChatGPT and Claude exports, 230 lines cross
 * this bar: four thousandths of a percent.
 */
export const LONG_LINE_CHARS = 10_000;

/**
 * A whole block this large belongs in a file even when its lines are short:
 * an export that ships a 500 KB document inside a message makes a note nobody
 * can open comfortably, however it is wrapped.
 */
export const INLINE_BLOCK_MAX_BYTES = 20 * 1024;

/** Where a wrapped line is cut when nothing better presents itself. */
const WRAP_WIDTH = 120;

export type ExtractedKind = "json" | "html" | "md" | "txt";

const BLOCK_TAG_END =
    /(<\/(?:div|p|li|ul|ol|tr|table|section|article|header|footer|h[1-6]|pre|blockquote|form|nav|main|figure)>)/i;

/**
 * What the content is, from the content alone. Only four answers, because
 * only four change what we do with it.
 */
export function detectKind(text: string): ExtractedKind {
    const trimmed = text.trim();

    if (
        (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
        (trimmed.startsWith("[") && trimmed.endsWith("]"))
    ) {
        try {
            JSON.parse(trimmed);
            return "json";
        } catch {
            // Looks like JSON but is not: treat it as text rather than lie.
        }
    }

    if (
        /<\/[a-zA-Z][^>]*>/.test(trimmed) &&
        (trimmed.match(/</g) || []).length > 10
    ) {
        return "html";
    }

    // A flattened Markdown table is the one Markdown shape that arrives on a
    // single line; anything else keeps its own line breaks.
    if (/^\s*\|.*\|/.test(trimmed) && (trimmed.match(/\|/g) || []).length > 6) {
        return "md";
    }

    return "txt";
}

function wrap(line: string, width = WRAP_WIDTH): string[] {
    const out: string[] = [];
    let rest = line;

    while (rest.length > width) {
        const boundary = rest.lastIndexOf(" ", width);
        // A run with no spaces — base64, a hash, a URL — is left whole: a
        // break there would corrupt it, and it is short enough to survive.
        const cut = boundary > width / 2 ? boundary : width;
        out.push(rest.slice(0, cut));
        rest = rest.slice(cut).replace(/^ +/, "");
    }
    out.push(rest);
    return out;
}

/**
 * The same content, on lines a reader and a parser can both handle.
 *
 * JSON is re-serialised, so the document is unchanged and merely indented.
 * Markup breaks after block-level tags, which carry no meaningful whitespace.
 * Everything else is wrapped on word boundaries — for the flattened tables and
 * console dumps that make up the rest, the line breaks were there before some
 * export dropped them.
 */
export function beautify(text: string, kind: ExtractedKind): string {
    if (kind === "json") {
        try {
            return JSON.stringify(JSON.parse(text.trim()), null, 2);
        } catch {
            return text;
        }
    }

    const lines = text.split("\n");
    const out: string[] = [];

    for (const line of lines) {
        if (line.length <= WRAP_WIDTH) {
            out.push(line);
            continue;
        }

        const pieces =
            kind === "html"
                ? line.split(BLOCK_TAG_END).reduce<string[]>((acc, part) => {
                      if (BLOCK_TAG_END.test(part) && acc.length > 0) {
                          acc[acc.length - 1] += part;
                      } else if (part) {
                          acc.push(part);
                      }
                      return acc;
                  }, [])
                : kind === "md"
                ? // Lookahead only: lookbehind is unsupported on iOS below
                  // 16.4, and this plugin runs on mobile.
                  line.replace(/\|(?=\s*\|)/g, "|\n").split("\n")
                : [line];

        for (const piece of pieces) {
            out.push(...wrap(piece));
        }
    }

    return out.join("\n");
}

/**
 * A name derived from the content, so the same paste always lands on the same
 * file — whether it was extracted during an import or by the 1.7.0 cleanup of
 * notes an older version wrote. Two paths, one file, no orphan.
 *
 * FNV-1a rather than a cryptographic digest: it is synchronous, it works the
 * same on desktop and mobile, and a collision costs nothing here — the writer
 * compares the bytes and takes a free name when they differ.
 */
export function contentFileName(content: string, kind: ExtractedKind): string {
    let hash = 0x811c9dc5;
    for (let i = 0; i < content.length; i++) {
        hash ^= content.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return `paste-${hash.toString(16).padStart(8, "0")}.${kind}`;
}

export interface ExtractionTarget {
    id: string;
    title: string;
    createTime: number;
    provider: string;
}

/**
 * Moves oversized lines out of a conversation and into files beside it.
 *
 * This runs on the standard conversation, after every provider has had its
 * say, because the problem is not provider-specific: ChatGPT carries its long
 * lines in message text, Claude in attachments, and a future provider will
 * find its own way. One pass, one rule, one place to fix it.
 */
export class LongContentExtractor {
    constructor(private plugin: NexusAiChatImporterPlugin) {}

    async extract(
        messages: StandardMessage[],
        conversation: ExtractionTarget
    ): Promise<StandardMessage[]> {
        const hasLongLine = (text?: string) =>
            !!text &&
            text.length > LONG_LINE_CHARS &&
            text.split("\n").some((line) => line.length > LONG_LINE_CHARS);

        if (
            !messages.some(
                (message) =>
                    hasLongLine(message.content) ||
                    (message.attachments ?? []).some(
                        (attachment) =>
                            hasLongLine(attachment.extractedContent) ||
                            (attachment.extractedContent?.length ?? 0) >
                                INLINE_BLOCK_MAX_BYTES
                    )
            )
        ) {
            return messages;
        }

        const folder = await this.ensureFolder(conversation);
        if (!folder) return messages;

        const result: StandardMessage[] = [];
        for (const message of messages) {
            const content = await this.rewrite(message.content, folder, "");
            const attachments = [];
            for (const attachment of message.attachments ?? []) {
                attachments.push(
                    attachment.extractedContent
                        ? {
                              ...attachment,
                              extractedContent: await this.rewriteCallout(
                                  attachment.extractedContent,
                                  folder
                              ),
                          }
                        : attachment
                );
            }
            result.push({ ...message, content, attachments });
        }

        return result;
    }

    /**
     * An attachment callout: its header stays, its body goes to a file once it
     * is large enough, whether that size comes from one impossible line or
     * from a document that simply does not belong in a note.
     */
    private async rewriteCallout(
        content: string,
        folder: string
    ): Promise<string> {
        const lines = content.split("\n");
        const header = lines[0]?.startsWith(">>[!") ? lines[0] : null;
        const body = header ? lines.slice(1) : lines;
        const payload = body
            .map((line) =>
                // ">>" alone is the blank line a callout uses to breathe.
                line === ">>"
                    ? ""
                    : line.startsWith(">> ")
                    ? line.slice(3)
                    : line
            )
            .join("\n")
            .trim();

        if (payload.length > INLINE_BLOCK_MAX_BYTES) {
            const path = await this.write(payload, folder);
            if (path) {
                return [header, ">>", `>> [[${path}]]`]
                    .filter((line): line is string => line !== null)
                    .join("\n");
            }
        }

        return this.rewrite(content, folder, ">> ");
    }

    /**
     * Replaces every oversized line with a link to the file now holding it.
     * `prefix` is the callout quoting the line already carried, so the link
     * lands inside the same block rather than breaking out of it.
     */
    private async rewrite(
        text: string | undefined,
        folder: string,
        prefix: string
    ): Promise<string> {
        if (!text) return text ?? "";

        const lines = text.split("\n");
        const out: string[] = [];

        for (const line of lines) {
            const payload = prefix ? line.slice(prefix.length) : line;
            if (line.length <= LONG_LINE_CHARS) {
                out.push(line);
                continue;
            }

            const path = await this.write(payload, folder);
            out.push(path ? `${prefix}[[${path}]]` : line);
        }

        return out.join("\n");
    }

    /** Writes the content, beautified, and returns its vault path. */
    private async write(
        content: string,
        folder: string
    ): Promise<string | null> {
        try {
            const kind = detectKind(content);
            const body = beautify(content, kind);
            const path = await resolveAttachmentTarget(
                this.plugin.app.vault.adapter,
                `${folder}/${contentFileName(body, kind)}`,
                new TextEncoder().encode(body)
            );

            if (!(await this.plugin.app.vault.adapter.exists(path))) {
                await this.plugin.app.vault.create(path, body);
            }
            return path;
        } catch (error) {
            // A line left in place is a slow note; a lost line is a lost
            // conversation. The first is the better failure.
            this.plugin.logger
                .child("LongContent")
                .warn("Could not move an oversized line out of the note", {
                    error: String(error),
                });
            return null;
        }
    }

    private async ensureFolder(
        conversation: ExtractionTarget
    ): Promise<string | null> {
        const folder = `${this.plugin.settings.attachmentFolder}/${
            conversation.provider
        }/documents/${generateConversationFileName(
            conversation.title || "unknown",
            conversation.createTime || 0,
            this.plugin.settings.addDatePrefix,
            this.plugin.settings.dateFormat
        )}`;

        const result = await ensureFolderExists(folder, this.plugin.app.vault);
        return result.success ? folder : null;
    }
}
