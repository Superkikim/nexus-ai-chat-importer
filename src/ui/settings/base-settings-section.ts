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

// src/ui/settings/base-settings-section.ts
import { Setting } from "obsidian";
import type { SettingDefinitionRender } from "obsidian";
import type NexusAiChatImporterPlugin from "../../main";
import { setFullWidthDescription } from "./full-width-description";

/**
 * One row of a settings section, described once and used two ways: rendered
 * imperatively on Obsidian before 1.13, and handed to Obsidian 1.13+ as a
 * setting definition, which is what puts it in the settings search.
 */
export interface SectionRow {
    name: string;
    desc?: string | DocumentFragment;
    /** Extra search terms, besides the name and description. */
    aliases?: string[];
    /** `false` keeps a row that is not a real setting out of the search. */
    searchable?: boolean;
    /** Hidden while it returns false; re-evaluated on every refresh. */
    visible?: () => boolean;
    /** Class added to the row element. */
    cls?: string;
    /** Put the description on a full-width row under the controls. */
    fullWidthDesc?: boolean;
    /** Add the row's controls. Name and description are already set. */
    render(setting: Setting): void;
}

function renderRow(setting: Setting, row: SectionRow): void {
    if (row.cls) setting.settingEl.addClass(row.cls);
    if (row.fullWidthDesc) setFullWidthDescription(setting);
    row.render(setting);
}

export abstract class BaseSettingsSection {
    constructor(protected plugin: NexusAiChatImporterPlugin) {}

    /** The section's rows. Sections that build their own DOM override render(). */
    protected rows(): SectionRow[] {
        return [];
    }

    /** Render this section's settings (Obsidian before 1.13). */
    render(containerEl: HTMLElement): Promise<void> | void {
        for (const row of this.rows()) {
            if (row.visible && !row.visible()) continue;
            const setting = new Setting(containerEl).setName(row.name);
            if (row.desc !== undefined) setting.setDesc(row.desc);
            renderRow(setting, row);
        }
    }

    /** The same rows as setting definitions (Obsidian 1.13+). */
    getDefinitions(): SettingDefinitionRender[] {
        return this.rows().map((row) => ({
            name: row.name,
            desc: row.desc,
            aliases: row.aliases,
            searchable: row.searchable,
            visible: row.visible,
            render: (setting: Setting) => renderRow(setting, row),
        }));
    }

    /**
     * Section title (optional). A section without one continues the previous
     * section's group.
     */
    abstract readonly title?: string;

    /**
     * Section order (lower = higher up)
     */
    readonly order: number = 100;

    /**
     * Called when the settings tab closes, for a section holding input that
     * is committed on blur: closing the tab removes the field without one.
     */
    onHide(): void {}

    /**
     * Callback to apply a change of state that shows or hides rows
     */
    protected redrawCallback?: () => void;

    /**
     * Set redraw callback from main settings tab
     */
    setRedrawCallback(callback: () => void): void {
        this.redrawCallback = callback;
    }

    /**
     * Show or hide rows after a change of state: the tab re-renders on
     * Obsidian before 1.13, and re-evaluates `visible` in place on 1.13+.
     */
    protected redraw(): void {
        if (this.redrawCallback) {
            this.redrawCallback();
        }
    }
}
