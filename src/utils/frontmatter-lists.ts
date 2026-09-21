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

// src/utils/frontmatter-lists.ts

/**
 * A frontmatter field that holds several values — `models` — is written as a
 * YAML list. Written and rewritten in one place, so the note formatter and the
 * update path cannot drift apart.
 */

/** `key:` followed by one indented line per value, or nothing when empty. */
export function yamlListBlock(key: string, values: string[]): string {
    if (values.length === 0) {
        return "";
    }

    const lines = values
        .map((value) => `  - "${value.replace(/"/g, '\\"')}"`)
        .join("\n");
    return `${key}:\n${lines}\n`;
}

/** Matches the whole list a note holds for `key`, its items included. */
export function frontmatterListPattern(key: string): RegExp {
    return new RegExp(`^${key}:\\n(?:\\s+- .*\\n?)*`, "m");
}
