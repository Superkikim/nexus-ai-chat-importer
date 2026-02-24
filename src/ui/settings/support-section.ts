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


// src/ui/settings/support-section.ts
import { Setting } from "obsidian";
import { BaseSettingsSection } from "./base-settings-section";
import { createKofiSupportBox } from "../components/kofi-support-box";
import { t } from '../../i18n';

export class SupportSection extends BaseSettingsSection {
    get title() { return t('settings.support.section_title'); }
    readonly order = 5;

    render(containerEl: HTMLElement): void {
        const supportContainer = containerEl.createDiv({ cls: "nexus-support-section" });

        // Use reusable Ko-fi support box component
        createKofiSupportBox(supportContainer);

        // Resources section - ONE Setting with multiple buttons
        new Setting(supportContainer)
            .setName(t('settings.support.resources.name'))
            .setDesc(t('settings.support.resources.desc'))
            .addButton((button) =>
                button
                    .setButtonText(t('settings.support.resources.readme'))
                    .onClick(() => {
                        window.open("https://github.com/superkikim/nexus-ai-chat-importer/blob/1.3.0/README.md", "_blank");
                    })
            )
            .addButton((button) =>
                button
                    .setButtonText(t('settings.support.resources.changelog'))
                    .onClick(() => {
                        window.open("https://github.com/superkikim/nexus-ai-chat-importer/blob/1.3.0/RELEASE_NOTES.md", "_blank");
                    })
            )
            .addButton((button) =>
                button
                    .setButtonText(t('settings.support.resources.issues'))
                    .onClick(() => {
                        window.open("https://github.com/superkikim/nexus-ai-chat-importer/issues", "_blank");
                    })
            )
            .addButton((button) =>
                button
                    .setButtonText(t('settings.support.resources.forum'))
                    .onClick(() => {
                        window.open("https://forum.obsidian.md/t/plugin-nexus-ai-chat-importer-import-chatgpt-and-claude-conversations-to-your-vault/71664", "_blank");
                    })
            );
    }
}

