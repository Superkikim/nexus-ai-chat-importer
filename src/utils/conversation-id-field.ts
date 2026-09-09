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
 * The importer uses this key as its primary key: every scan reads it to decide
 * whether a conversation already has a note. Vaults that key notes on their own
 * identifier — `uid` is the common one — otherwise end up invisible to the
 * importer, and the next run re-creates every conversation it already has.
 *
 * Reading therefore never depends on the setting alone. The configured key is
 * tried first, then the built-in fallbacks, so changing the setting (or
 * renaming the field across a vault by hand) cannot orphan existing notes.
 */

/** The key written when nothing is configured. */
export const DEFAULT_CONVERSATION_ID_FIELD = "conversation_id";

/**
 * Keys always accepted when reading, in order, after the configured one.
 * `uid` is here because it is the identifier Obsidian vaults most often use.
 */
export const FALLBACK_CONVERSATION_ID_FIELDS = [
    DEFAULT_CONVERSATION_ID_FIELD,
    "uid",
] as const;

/** A frontmatter key must be usable unquoted in YAML and stable across writes. */
const VALID_FIELD = /^[A-Za-z_][A-Za-z0-9_-]*$/;

export function isValidConversationIdField(field: string): boolean {
    return VALID_FIELD.test(field.trim());
}

/**
 * The key to write. Falls back to the default when unset or malformed, so a
 * bad setting degrades to standard behaviour instead of producing broken YAML.
 */
export function resolveConversationIdField(configured?: string): string {
    const trimmed = (configured ?? "").trim();
    return trimmed && isValidConversationIdField(trimmed)
        ? trimmed
        : DEFAULT_CONVERSATION_ID_FIELD;
}

/** Every key to try when reading, configured first, without duplicates. */
export function conversationIdFieldCandidates(configured?: string): string[] {
    const primary = resolveConversationIdField(configured);
    const seen = new Set<string>([primary]);
    const out = [primary];
    for (const field of FALLBACK_CONVERSATION_ID_FIELDS) {
        if (!seen.has(field)) {
            seen.add(field);
            out.push(field);
        }
    }
    return out;
}

/**
 * Read the conversation id out of a frontmatter object, trying the configured
 * key then the fallbacks. Returns null when no candidate holds a usable value.
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
    }
    return null;
}
