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
import { App, PluginSettingTab, Setting } from "obsidian";
import type { SettingDefinitionItem } from "obsidian";
import type NexusAiChatImporterPlugin from "../main";
import { BaseSettingsSection } from "./settings/base-settings-section";
import { SupportSection } from "./settings/support-section";
import { FolderSettingsSection } from "./settings/folder-settings-section";
import { DisplaySettingsSection } from "./settings/display-settings-section";
import { MessageDateFormatSection } from "./settings/message-date-format-section";
import { PropertiesSettingsSection } from "./settings/properties-settings-section";
import { buildSettingGroups } from "./settings/setting-groups";

export class NexusAiChatImporterPluginSettingTab extends PluginSettingTab {
    private sections: BaseSettingsSection[] = [];
    /** Bumped by every display(), so an older, still-running render stops. */
    private renderGeneration = 0;
    /** Scroll position to restore once a section-triggered redraw is done. */
    private pendingScrollTop?: number;

    constructor(app: App, private plugin: NexusAiChatImporterPlugin) {
        super(app, plugin);
        this.initializeSections();
    }

    private initializeSections(): void {
        this.sections = [
            new SupportSection(this.plugin),
            new FolderSettingsSection(this.plugin),
            new DisplaySettingsSection(this.plugin),
            new MessageDateFormatSection(this.plugin),
            new PropertiesSettingsSection(this.plugin),
        ].sort((a, b) => a.order - b.order);

        // Set redraw callback for each section
        this.sections.forEach((section) => {
            section.setRedrawCallback(() => this.applyStateChange());
        });
    }

    /**
     * Obsidian 1.13+ renders the tab from these definitions, which is also
     * what puts the settings in its settings search.
     */
    getSettingDefinitions(): SettingDefinitionItem[] {
        return buildSettingGroups(this.sections);
    }

    /**
     * The imperative renderer, kept for Obsidian before 1.13 (the plugin
     * supports 1.6.6 and up). Obsidian 1.13+ never calls it: the definitions
     * above take over.
     */
    display(): void {
        this.renderLegacy();
    }

    private renderLegacy(): void {
        const { containerEl } = this;
        containerEl.empty();

        void this.renderSections(containerEl, ++this.renderGeneration);
    }

    /**
     * A section changed state that shows or hides rows. Obsidian 1.13+
     * re-evaluates each row's `visible` in place; before that the tab is
     * re-rendered.
     */
    private applyStateChange(): void {
        // Feature-detected: refreshDomState() only exists on Obsidian 1.13+,
        // which the plugin supports but does not require.
        const tab = this as { refreshDomState?: () => void };
        if (typeof tab.refreshDomState === "function") {
            tab.refreshDomState();
        } else {
            this.redraw();
        }
    }

    /**
     * Re-render in place, for a section that shows or hides a control (the
     * date prefix format, the timestamp format). Emptying the tab sent the
     * view back to the top at every toggle, so the scroll position is kept.
     */
    private redraw(): void {
        this.pendingScrollTop = this.containerEl.scrollTop;
        this.renderLegacy();
    }

    hide(): void {
        for (const section of this.sections) {
            section.onHide();
        }
    }

    private async renderSections(
        containerEl: HTMLElement,
        generation: number
    ): Promise<void> {
        for (const section of this.sections) {
            // Opening Settings and selecting this tab each call display().
            // Sections render asynchronously, so without this check the first
            // render resumed after the second had emptied the container, and
            // every section after the first async one appeared twice.
            if (generation !== this.renderGeneration) return;
            // The heading carried an empty name, so every section title —
            // translated, and sitting in the locale files all along — rendered
            // as a blank separator instead.
            if (section.title) {
                new Setting(containerEl).setName(section.title).setHeading();
            }

            await section.render(containerEl);
        }

        if (
            generation === this.renderGeneration &&
            this.pendingScrollTop !== undefined
        ) {
            containerEl.scrollTop = this.pendingScrollTop;
            this.pendingScrollTop = undefined;
        }
    }
}
