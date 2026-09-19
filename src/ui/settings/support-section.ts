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
import { BaseSettingsSection, type SectionRow } from "./base-settings-section";
import { createSupportBox } from "../components/support-box";
import { t } from "../../i18n";
import {
    getCommunityForumUrl,
    getIssuesUrl,
    getLocalizedDocsUrl,
    getReleaseNotesUrl,
} from "../../utils/support-links";

export class SupportSection extends BaseSettingsSection {
    get title() {
        return t("settings.support.section_title");
    }
    readonly order = 5;

    protected rows(): SectionRow[] {
        return [
            {
                // The support box is not a setting: it fills its row and
                // stays out of the settings search.
                name: t("settings.support.section_title"),
                searchable: false,
                cls: "nexus-support-banner",
                render: (setting) => {
                    setting.settingEl.empty();
                    createSupportBox(setting.settingEl);
                },
            },
            {
                name: t("settings.support.resources.name"),
                desc: t("settings.support.resources.desc"),
                aliases: ["help", "documentation", "issues", "forum", "docs"],
                cls: "nexus-support-resources",
                // ONE setting with multiple buttons
                render: (setting) => {
                    const links: Array<[string, () => string]> = [
                        [
                            t("settings.support.resources.documentation"),
                            getLocalizedDocsUrl,
                        ],
                        [
                            t("settings.support.resources.release_notes"),
                            getReleaseNotesUrl,
                        ],
                        [t("settings.support.resources.issues"), getIssuesUrl],
                        [
                            t("settings.support.resources.forum"),
                            getCommunityForumUrl,
                        ],
                    ];
                    for (const [label, url] of links) {
                        setting.addButton((button) =>
                            button.setButtonText(label).onClick(() => {
                                window.open(url(), "_blank");
                            })
                        );
                    }
                },
            },
        ];
    }
}
