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

// src/utils/note-message-blocks.ts

/**
 * A message as it sits in a note: its callout, then the UID comment that
 * closes it. Read back when a provider has to recognise a message it cannot
 * match by id — two Perplexity exports of the same thread number their answers
 * differently, so the text is the only thing they share.
 */
export interface NoteMessageBlock {
    uid: string;
    role: "user" | "assistant" | "other";
    /** The message text, with the callout's `>` prefixes removed. */
    text: string;
    /**
     * Where the whole block sits in the note: its callout, its UID comment,
     * and the `---` rule the formatter writes after an answer. Replacing a
     * block has to take that rule with it, or the replacement's own rule
     * lands next to the one left behind.
     */
    start: number;
    end: number;
}

const BLOCK_PATTERN =
    /^>\[!nexus_(\w+)\][\s\S]*?\n<!-- UID: (.*?) -->[ \t]*(?:\n\n---(?=\n|$))?/gm;

export function readNoteMessageBlocks(content: string): NoteMessageBlock[] {
    const blocks: NoteMessageBlock[] = [];
    BLOCK_PATTERN.lastIndex = 0;

    let match: RegExpExecArray | null;
    while ((match = BLOCK_PATTERN.exec(content)) !== null) {
        const [block, calloutType, uid] = match;
        blocks.push({
            uid,
            role: readRole(calloutType),
            text: readCalloutText(block),
            start: match.index,
            end: match.index + block.length,
        });
    }

    return blocks;
}

function readRole(calloutType: string): NoteMessageBlock["role"] {
    if (calloutType === "user") return "user";
    if (calloutType === "agent") return "assistant";
    return "other";
}

/**
 * The text as it was written, minus the callout scaffolding: the header line
 * that names the speaker, the `>` prefixes, and the UID comment.
 */
function readCalloutText(block: string): string {
    return block
        .split("\n")
        .slice(1)
        .filter((line) => !line.startsWith("<!-- UID:") && line !== "---")
        .map((line) => line.replace(/^>[ \t]?/, ""))
        .join("\n")
        .trim();
}
