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

// src/utils/wikilink-safe-name.ts

/**
 * Obsidian reads `#`, `^`, `[`, `]` as structure inside a wikilink — `#`
 * opens a heading anchor, `^` a block reference, `[` `]` the link itself.
 * A file whose name contains one can never be resolved by a `[[path]]`
 * link (confirmed directly against Obsidian's own "create file" dialog,
 * which refuses these characters outright — there is no link-syntax
 * workaround).
 *
 * Deleting the character (as first proposed) loses information silently —
 * "C#" and "C" become indistinguishable. Substituting keeps the name
 * legible and tells the two apart:
 *
 * - `#` → `＃` (U+FF03, fullwidth number sign). Legal in filenames, not
 *   wikilink-structural, and reads as the original character rather than
 *   erasing it. The plugin generates and links this itself, so the
 *   "hard to type by hand" objection that rules out full-width lookalikes
 *   for manually-authored links doesn't apply here.
 * - `^` → `-`
 * - `[` → `(`
 * - `]` → `)`
 *
 * Deliberately a fixed table, not a per-character setting: only `#` has a
 * genuine ambiguity (number vs. "sharp"), and a settings section with one
 * free-text field per character — each needing commit-on-blur validation,
 * translated across all locales — is a lot of surface for something almost
 * nobody will ever want to reconfigure. See issue #83.
 *
 * A conversation's displayed title (`aliases:` in frontmatter, the
 * `# Title:` heading in the note body) is untouched by this table — link
 * generation is keyed off the physical filename, never the displayed
 * title, so the original title stays searchable via Obsidian's alias-aware
 * quick switcher and full-text search regardless of what the file is named
 * on disk.
 */
const WIKILINK_STRUCTURAL_SUBSTITUTIONS: Readonly<Record<string, string>> = {
    "#": "＃", // ＃
    "^": "-",
    "[": "(",
    "]": ")",
};

/** Matches any of the four characters this module substitutes. */
export const WIKILINK_STRUCTURAL_CHARS_REGEX = /[#^[\]]/g;

/** True when a name contains a character a wikilink can't resolve through. */
export function hasWikilinkStructuralChars(name: string): boolean {
    WIKILINK_STRUCTURAL_CHARS_REGEX.lastIndex = 0;
    return WIKILINK_STRUCTURAL_CHARS_REGEX.test(name);
}

/**
 * Replace every wikilink-structural character with its fixed substitute.
 * Idempotent: a name with no such character, or one already substituted,
 * passes through unchanged.
 */
export function substituteWikilinkStructuralChars(name: string): string {
    return name.replace(
        WIKILINK_STRUCTURAL_CHARS_REGEX,
        (ch) => WIKILINK_STRUCTURAL_SUBSTITUTIONS[ch]
    );
}
