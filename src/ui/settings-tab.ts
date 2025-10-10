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


// src/ui/settings-tab.ts
import { App, PluginSettingTab } from "obsidian";
import type NexusAiChatImporterPlugin from "../main";
import { BaseSettingsSection } from "./settings/base-settings-section";
import { FolderSettingsSection } from "./settings/folder-settings-section";
import { DisplaySettingsSection } from "./settings/display-settings-section";

export class NexusAiChatImporterPluginSettingTab extends PluginSettingTab {
    private sections: BaseSettingsSection[] = [];

    constructor(app: App, private plugin: NexusAiChatImporterPlugin) {
        super(app, plugin);
        this.initializeSections();
    }

    private initializeSections(): void {
        this.sections = [
            new FolderSettingsSection(this.plugin),
            new DisplaySettingsSection(this.plugin)
        ].sort((a, b) => a.order - b.order);

        // Set redraw callback for each section
        this.sections.forEach(section => {
            section.setRedrawCallback(() => this.display());
        });
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        this.renderSections(containerEl);
    }

    private async renderSections(containerEl: HTMLElement): Promise<void> {
        for (const section of this.sections) {
            if (section.title) {
                containerEl.createEl("h2", { text: section.title });
            }

            await section.render(containerEl);
        }
    }
}