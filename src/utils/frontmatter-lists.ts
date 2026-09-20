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
 * Frontmatter fields that hold several values — `mode`, `models` — are written
 * as YAML lists. A provider may hand over one value or many, and notes written
 * before a field became a list still carry a single string.
 */
export function normalizeFrontmatterList(value: unknown): string[] {
    const values = Array.isArray(value) ? value : [value];

    const seen = new Set<string>();
    const list: string[] = [];
    for (const item of values) {
        if (typeof item !== "string") continue;
        const normalized = item.trim();
        if (!normalized || seen.has(normalized)) continue;
        seen.add(normalized);
        list.push(normalized);
    }

    return list;
}

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

/**
 * Matches the field in either shape: the list written now, or the single
 * `key: "value"` line notes carried before it became a list.
 */
export function frontmatterListPattern(key: string): RegExp {
    return new RegExp(`^${key}:(?:\\n(?:\\s+- .*\\n?)*|.*\\n?)`, "m");
}
