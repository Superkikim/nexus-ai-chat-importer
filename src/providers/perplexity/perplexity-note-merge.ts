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

// src/providers/perplexity/perplexity-note-merge.ts

import { StandardMessage } from "../../types/standard";
import { NoteMessageBlock } from "../../utils/note-message-blocks";
import { NoteMergePlan } from "../provider-adapter";

/**
 * Perplexity has two exports of the same thread — its own, and the Thread
 * Exporter extension's — and they number their answers differently: across ten
 * threads held in both, not one message id matched. The question does: all 48
 * were identical, character for character.
 *
 * So a turn already in the note is recognised by the start of its question,
 * taken in order, and only the extension's export carries the sources. A turn
 * the note holds without its sources is rewritten from the richer export;
 * everything else is either already there or genuinely new.
 */
const QUESTION_KEY_CHARS = 60;

/** The heading the converter writes above a turn's source list. */
const REFERENCES_HEADING = "### References";

interface Turn<T> {
    question: T;
    rest: T[];
}

export function planPerplexityNoteMerge(
    existing: NoteMessageBlock[],
    incoming: StandardMessage[]
): NoteMergePlan {
    const existingTurns = groupTurns(existing, (block) => block.role);
    const incomingTurns = groupTurns(incoming, (message) => message.role);

    const available = new Map<string, Turn<NoteMessageBlock>[]>();
    for (const turn of existingTurns) {
        const key = questionKey(turn.question.text);
        const queue = available.get(key);
        if (queue) {
            queue.push(turn);
        } else {
            available.set(key, [turn]);
        }
    }

    const plan: NoteMergePlan = { append: [], rewrites: [] };

    for (const turn of incomingTurns) {
        const queue = available.get(questionKey(turn.question.content));
        const match = queue?.shift();

        if (!match) {
            plan.append.push(turn.question, ...turn.rest);
            continue;
        }

        if (carriesSources(turn) && !carriesSources(match)) {
            const blocks = [match.question, ...match.rest];
            plan.rewrites.push({
                start: blocks[0].start,
                end: blocks[blocks.length - 1].end,
                messages: [turn.question, ...turn.rest],
            });
        }
    }

    return plan;
}

/**
 * A turn is a question and what answered it. A note or a conversation that
 * opens on an answer — nothing in these exports does — keeps that answer with
 * the turn before it rather than losing it.
 */
function groupTurns<T>(items: T[], roleOf: (item: T) => string): Turn<T>[] {
    const turns: Turn<T>[] = [];

    for (const item of items) {
        if (roleOf(item) === "user" || turns.length === 0) {
            turns.push({ question: item, rest: [] });
            continue;
        }
        turns[turns.length - 1].rest.push(item);
    }

    return turns;
}

function questionKey(text: string): string {
    return text
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, QUESTION_KEY_CHARS)
        .toLowerCase();
}

function carriesSources(
    turn: Turn<NoteMessageBlock | StandardMessage>
): boolean {
    return turn.rest.some((item) =>
        ("text" in item ? item.text : item.content).includes(REFERENCES_HEADING)
    );
}
