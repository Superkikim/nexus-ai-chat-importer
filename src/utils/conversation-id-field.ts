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

// src/utils/conversation-id-field.ts

/**
 * Which frontmatter key holds a note's conversation id.
 *
 * The importer uses this id as its primary key: every scan reads it to decide
 * whether a conversation already has a note. Vaults that key notes on their own
 * identifier — `uid` is the common one — otherwise end up with imported notes
 * that their own tooling cannot see.
 *
 * Reading is deliberately NOT "configured key first". A vault that identifies
 * notes by `uid` normally has a plugin stamping a random `uid` on every note,
 * including conversation notes already written with `conversation_id`. Trying
 * the configured key first would resolve those notes to their vault uid rather
 * than their chat id, empty the catalog of real ids, and duplicate the whole
 * library on the next import — the exact failure this setting exists to avoid.
 *
 * So `conversation_id` — the key every previously written note carries — is
 * always tried first, and the configured key only when that is absent. A note
 * written under the configured key has no `conversation_id`, so it resolves
 * correctly either way, and switching the setting cannot orphan anything.
 */

/** The key written when nothing is configured, and always read first. */
export const DEFAULT_CONVERSATION_ID_FIELD = "conversation_id";

/**
 * Keys the note formatter already writes. Reusing one would emit the same
 * mapping key twice; Obsidian's YAML parser rejects a duplicate key, the note
 * loses its frontmatter entirely, and the importer stops recognising it — so
 * every import would re-create it. `conversation_id` is excluded: it is the
 * default, and writing it is not a duplicate.
 */
const RESERVED_FIELDS = new Set([
    "nexus",
    "plugin_version",
    "provider",
    "aliases",
    "create_time",
    "update_time",
    "mode",
    "models",
]);

/** A frontmatter key must be usable unquoted in YAML and stable across writes. */
const VALID_FIELD = /^[A-Za-z_][A-Za-z0-9_-]*$/;

export function isValidConversationIdField(field: string): boolean {
    const trimmed = field.trim();
    return VALID_FIELD.test(trimmed) && !RESERVED_FIELDS.has(trimmed);
}

/**
 * The key to write. Falls back to the default when unset, malformed, or one the
 * formatter already writes, so a bad setting degrades to standard behaviour
 * instead of producing frontmatter that will not parse.
 */
export function resolveConversationIdField(configured?: string): string {
    const trimmed = (configured ?? "").trim();
    return trimmed && isValidConversationIdField(trimmed)
        ? trimmed
        : DEFAULT_CONVERSATION_ID_FIELD;
}

/**
 * Every key to try when reading: the built-in key first, then the configured
 * one. Nothing else — a key that is neither is not this plugin's to interpret.
 */
export function conversationIdFieldCandidates(configured?: string): string[] {
    const resolved = resolveConversationIdField(configured);
    return resolved === DEFAULT_CONVERSATION_ID_FIELD
        ? [DEFAULT_CONVERSATION_ID_FIELD]
        : [DEFAULT_CONVERSATION_ID_FIELD, resolved];
}

/**
 * Read the conversation id out of a frontmatter object. Returns null when no
 * candidate holds a usable value.
 *
 * Numbers are accepted and stringified: Obsidian's YAML cache parses an
 * unquoted all-digit value as a number, and timestamp-shaped uids
 * (`20240115143022`) are common.
 */
export function readConversationId(
    frontmatter: Record<string, unknown> | null | undefined,
    configured?: string
): string | null {
    if (!frontmatter) return null;
    for (const field of conversationIdFieldCandidates(configured)) {
        const value = frontmatter[field];
        if (typeof value === "string" && value.trim()) {
            return value.trim();
        }
        if (typeof value === "number" && Number.isFinite(value)) {
            return String(value);
        }
    }
    return null;
}
