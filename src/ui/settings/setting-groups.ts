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

// src/ui/settings/setting-groups.ts
import type { SettingDefinitionGroup, SettingDefinitionRender } from "obsidian";

/** What the tab needs from a section to describe it. */
export interface DefinableSection {
    readonly title?: string;
    getDefinitions(): SettingDefinitionRender[];
}

/**
 * The tab's definitions: one group per titled section. A section without a
 * title continues the group above it, as its rows did under the previous
 * heading when the tab was rendered imperatively.
 */
export function buildSettingGroups(
    sections: DefinableSection[]
): SettingDefinitionGroup[] {
    const groups: SettingDefinitionGroup[] = [];

    for (const section of sections) {
        const items = section.getDefinitions();
        const previous = groups[groups.length - 1];

        if (section.title || !previous) {
            groups.push({ type: "group", heading: section.title, items });
        } else {
            previous.items?.push(...items);
        }
    }

    return groups;
}
