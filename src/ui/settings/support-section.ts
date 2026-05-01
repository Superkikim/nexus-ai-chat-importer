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
import { createSupportBox } from "../components/support-box";
import { t } from '../../i18n';
import {
    getCommunityForumUrl,
    getIssuesUrl,
    getLocalizedDocsUrl,
    getReleaseNotesUrl,
} from "../../utils/support-links";

export class SupportSection extends BaseSettingsSection {
    get title() { return t('settings.support.section_title'); }
    readonly order = 5;

    render(containerEl: HTMLElement): void {
        const supportContainer = containerEl.createDiv({ cls: "nexus-support-section" });

        // Use reusable support box component
        createSupportBox(supportContainer);

        // Resources section - ONE Setting with multiple buttons
        new Setting(supportContainer)
            .setName(t('settings.support.resources.name'))
            .setDesc(t('settings.support.resources.desc'))
            .addButton((button) =>
                button
                    .setButtonText(t('settings.support.resources.documentation'))
                    .onClick(() => {
                        window.open(getLocalizedDocsUrl(), "_blank");
                    })
            )
            .addButton((button) =>
                button
                    .setButtonText(t('settings.support.resources.release_notes'))
                    .onClick(() => {
                        window.open(getReleaseNotesUrl(), "_blank");
                    })
            )
            .addButton((button) =>
                button
                    .setButtonText(t('settings.support.resources.issues'))
                    .onClick(() => {
                        window.open(getIssuesUrl(), "_blank");
                    })
            )
            .addButton((button) =>
                button
                    .setButtonText(t('settings.support.resources.forum'))
                    .onClick(() => {
                        window.open(getCommunityForumUrl(), "_blank");
                    })
            );
    }
}
