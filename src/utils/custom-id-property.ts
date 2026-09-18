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

// src/utils/custom-id-property.ts

/**
 * The custom ID property: an extra, user-named frontmatter property (e.g.
 * `uid`) carrying the note's `conversation_id`. See issue #86.
 *
 * Existing notes are edited line by line, never through
 * `app.fileManager.processFrontMatter`: that API re-serializes the whole
 * block, which drops comments and quotes, turns flow lists into block lists,
 * rewrites values such as `007` as `7`, and writes LF into a CRLF note. Here,
 * every line that is not the property itself is kept byte for byte.
 */

/** Keys whose value is not a single-line scalar the plugin could have written. */
const COMPLEX_VALUE_START = /^[[{|>&*!]/;

/** A property name: usable unquoted in YAML and stable across writes. */
const VALID_NAME = /^[A-Za-z_][A-Za-z0-9_-]*$/;

/**
 * Names that cannot be used, compared case-insensitively.
 * - Obsidian's own properties, and their legacy singular forms.
 * - Obsidian Publish properties.
 * - Keys written on conversation notes: a duplicate key invalidates the
 *   whole frontmatter, and the importer then stops recognising the note.
 */
const RESERVED_NAMES = new Set([
    "tags",
    "aliases",
    "cssclasses",
    "tag",
    "alias",
    "cssclass",
    "publish",
    "permalink",
    "description",
    "image",
    "cover",
    "nexus",
    "plugin_version",
    "provider",
    "conversation_id",
    "create_time",
    "update_time",
    "mode",
    "models",
]);

export type PropertyNameCheck =
    | { valid: true; name: string }
    | { valid: false; reason: "format" | "reserved" };

/** Validate a name typed in the setting. An empty name is not valid here. */
export function checkCustomIdPropertyName(raw: string): PropertyNameCheck {
    const name = raw.trim();
    if (!VALID_NAME.test(name)) {
        return { valid: false, reason: "format" };
    }
    if (RESERVED_NAMES.has(name.toLowerCase())) {
        return { valid: false, reason: "reserved" };
    }
    return { valid: true, name };
}

/**
 * The property to write, or null when the feature is off. A setting that
 * no longer validates (edited by hand in data.json) writes nothing rather
 * than frontmatter that would not parse.
 */
export function resolveCustomIdProperty(configured?: string): string | null {
    const check = checkCustomIdPropertyName(configured ?? "");
    return check.valid ? check.name : null;
}

// ---------------------------------------------------------------------------
// Line-by-line frontmatter editing
// ---------------------------------------------------------------------------

interface Frontmatter {
    /** Every line of the note, each with its own line ending. */
    lines: string[];
    /** Index of the opening `---`. */
    open: number;
    /** Index of the closing `---` (or `...`). */
    close: number;
    /** Line ending for inserted lines: the one the opening line uses. */
    eol: string;
}

interface PropertyBlock {
    /** First line (the `key:` line). */
    start: number;
    /** One past the last line of the value. */
    end: number;
}

function splitLines(content: string): string[] {
    const lines = content.match(/[^\r\n]*(?:\r\n|\n|\r|$)/g) ?? [];
    // The pattern always ends with an empty match at end of input.
    if (lines.length > 0 && lines[lines.length - 1] === "") {
        lines.pop();
    }
    return lines;
}

function stripEol(line: string): string {
    return line.replace(/(?:\r\n|\n|\r)$/, "");
}

function parseFrontmatter(content: string): Frontmatter | null {
    const lines = splitLines(content);
    if (lines.length === 0) return null;
    const first = stripEol(lines[0]).replace(/^\uFEFF/, "");
    if (first.trimEnd() !== "---") return null;

    for (let i = 1; i < lines.length; i++) {
        const text = stripEol(lines[i]).trimEnd();
        if (text === "---" || text === "...") {
            const eol = lines[0].slice(stripEol(lines[0]).length) || "\n";
            return { lines, open: 0, close: i, eol };
        }
    }
    return null;
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function keyLinePattern(key: string): RegExp {
    const k = escapeRegExp(key);
    return new RegExp(`^(?:${k}|"${k}"|'${k}')[ \\t]*:(?=[ \\t]|$)`);
}

function findProperty(fm: Frontmatter, key: string): PropertyBlock | null {
    const pattern = keyLinePattern(key);
    for (let i = fm.open + 1; i < fm.close; i++) {
        if (!pattern.test(stripEol(fm.lines[i]))) continue;

        const valueIsEmpty = valueText(stripEol(fm.lines[i])) === "";
        let end = i + 1;
        while (end < fm.close) {
            const text = stripEol(fm.lines[end]);
            const continues =
                text.trim() === "" ||
                /^[ \t]/.test(text) ||
                // A sequence may sit at column 0 under its key.
                (valueIsEmpty && /^-(?:[ \t]|$)/.test(text));
            if (!continues) break;
            end++;
        }
        // Blank lines before the next key belong to nobody: leave them.
        while (end > i + 1 && stripEol(fm.lines[end - 1]).trim() === "") {
            end--;
        }
        return { start: i, end };
    }
    return null;
}

/** Text after `key:` on a key line. */
function valueText(keyLine: string): string {
    const colon = keyLine.indexOf(":");
    return keyLine.slice(colon + 1).trim();
}

/**
 * The value of a single-line scalar, unquoted. Null when the property holds
 * anything else (list, map, multi-line or empty value): no such value can
 * be an ID the plugin wrote.
 */
function scalarValue(fm: Frontmatter, block: PropertyBlock): string | null {
    if (block.end - block.start > 1) return null;
    const raw = valueText(stripEol(fm.lines[block.start]));
    if (raw === "" || COMPLEX_VALUE_START.test(raw)) return null;

    if (raw.startsWith('"')) {
        const match = raw.match(/^("(?:[^"\\]|\\.)*")(?:[ \t]+#.*)?$/);
        if (!match) return null;
        try {
            return JSON.parse(match[1]) as string;
        } catch {
            return null;
        }
    }
    if (raw.startsWith("'")) {
        const match = raw.match(/^'((?:[^']|'')*)'(?:[ \t]+#.*)?$/);
        return match ? match[1].replace(/''/g, "'") : null;
    }
    return raw.replace(/[ \t]+#.*$/, "").trim();
}

/** The text after `conversation_id:`, as written, comment dropped. */
function rawConversationId(fm: Frontmatter): string | null {
    const block = findProperty(fm, "conversation_id");
    if (!block || block.end - block.start > 1) return null;
    const raw = valueText(stripEol(fm.lines[block.start]));
    if (raw === "" || COMPLEX_VALUE_START.test(raw)) return null;
    return raw.startsWith('"') || raw.startsWith("'")
        ? raw.replace(/(["'])[ \t]+#.*$/, "$1")
        : raw.replace(/[ \t]+#.*$/, "");
}

function conversationIdOf(fm: Frontmatter): string | null {
    const block = findProperty(fm, "conversation_id");
    return block ? scalarValue(fm, block) : null;
}

/** Where a new property goes: right after `conversation_id`, else at the end. */
function insertionIndex(fm: Frontmatter): number {
    const block = findProperty(fm, "conversation_id");
    return block ? block.end : fm.close;
}

/** The ending of the line an inserted line follows, so CRLF stays CRLF. */
function eolBefore(fm: Frontmatter, index: number): string {
    const previous = fm.lines[index - 1];
    const eol = previous.slice(stripEol(previous).length);
    return eol || fm.eol;
}

function join(fm: Frontmatter): string {
    return fm.lines.join("");
}

// ---------------------------------------------------------------------------
// Operations on one note
// ---------------------------------------------------------------------------

export type NoteEditOutcome =
    /** The property was added. */
    | "added"
    /** An existing value was replaced with the conversation ID. */
    | "overwritten"
    /** The property was renamed (old one removed, new one written). */
    | "renamed"
    /** The property was removed. */
    | "removed"
    /** Nothing to do, or the note's value was left as is. */
    | "skipped";

export interface NoteEditResult {
    content: string;
    outcome: NoteEditOutcome;
}

/** Why a note could not be edited. */
export class NoteEditError extends Error {
    constructor(
        readonly reason: "no_frontmatter" | "no_conversation_id",
        message: string
    ) {
        super(message);
        this.name = "NoteEditError";
    }
}

function requireFrontmatter(content: string): Frontmatter {
    const fm = parseFrontmatter(content);
    if (!fm) {
        throw new NoteEditError("no_frontmatter", "Frontmatter not found");
    }
    return fm;
}

function requireConversationId(fm: Frontmatter): {
    raw: string;
    value: string;
} {
    const raw = rawConversationId(fm);
    const value = conversationIdOf(fm);
    if (raw === null || value === null) {
        throw new NoteEditError(
            "no_conversation_id",
            "conversation_id not found in frontmatter"
        );
    }
    return { raw, value };
}

/**
 * Give `key` the note's conversation ID. Where the property already exists,
 * `overwrite` decides: off leaves it as is, whatever its value.
 */
export function setCustomIdProperty(
    content: string,
    key: string,
    overwrite: boolean
): NoteEditResult {
    const fm = requireFrontmatter(content);
    const id = requireConversationId(fm);
    const line = (eol: string) => `${key}: ${id.raw}${eol}`;

    const existing = findProperty(fm, key);
    if (!existing) {
        const at = insertionIndex(fm);
        fm.lines.splice(at, 0, line(eolBefore(fm, at)));
        return { content: join(fm), outcome: "added" };
    }

    if (!overwrite || scalarValue(fm, existing) === id.value) {
        return { content, outcome: "skipped" };
    }

    const last = fm.lines[existing.end - 1];
    const eol = last.slice(stripEol(last).length) || fm.eol;
    fm.lines.splice(existing.start, existing.end - existing.start, line(eol));
    return { content: join(fm), outcome: "overwritten" };
}

/**
 * Remove `key`. With `onlyPluginValue`, only where its value is the note's
 * own conversation ID, i.e. a value the plugin wrote.
 */
export function removeCustomIdProperty(
    content: string,
    key: string,
    onlyPluginValue: boolean
): NoteEditResult {
    const fm = requireFrontmatter(content);
    const existing = findProperty(fm, key);
    if (!existing) {
        return { content, outcome: "skipped" };
    }
    if (onlyPluginValue) {
        const id = requireConversationId(fm);
        if (scalarValue(fm, existing) !== id.value) {
            return { content, outcome: "skipped" };
        }
    }
    fm.lines.splice(existing.start, existing.end - existing.start);
    return { content: join(fm), outcome: "removed" };
}

/**
 * Move the property from `oldKey` to `newKey`.
 *
 * `newKey` ends up carrying the conversation ID on every note; where it
 * already exists, `overwrite` decides. `oldKey` is removed only where its
 * value is the plugin's (the note's own conversation ID): a value the user
 * had under that name before the plugin used it is theirs, and stays.
 */
export function renameCustomIdProperty(
    content: string,
    oldKey: string,
    newKey: string,
    overwrite: boolean
): NoteEditResult {
    const fm = requireFrontmatter(content);
    const id = requireConversationId(fm);

    let removedOld = false;
    const old = findProperty(fm, oldKey);
    if (old && scalarValue(fm, old) === id.value) {
        fm.lines.splice(old.start, old.end - old.start);
        removedOld = true;
    }

    const set = setCustomIdProperty(join(fm), newKey, overwrite);
    if (set.outcome === "overwritten") {
        return set;
    }
    if (removedOld) {
        return { content: set.content, outcome: "renamed" };
    }
    return set;
}

/**
 * The line to write in a freshly generated note, or "" when the feature is
 * off. Same value text as the `conversation_id` line, so both parse alike.
 */
export function customIdPropertyLine(
    key: string | null,
    conversationId: string
): string {
    return key ? `${key}: ${conversationId}\n` : "";
}
