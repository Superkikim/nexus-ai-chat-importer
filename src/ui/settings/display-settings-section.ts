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

// src/ui/settings/display-settings-section.ts
import { Setting } from "obsidian";
import { BaseSettingsSection, type SectionRow } from "./base-settings-section";
import { t } from "../../i18n";

export class DisplaySettingsSection extends BaseSettingsSection {
    get title() {
        return t("settings.display.section_title");
    }
    readonly order = 10;

    protected rows(): SectionRow[] {
        return [
            {
                name: t("settings.display.add_date_prefix.name"),
                desc: t("settings.display.add_date_prefix.desc"),
                aliases: ["filename", "file name", "prefix", "date"],
                fullWidthDesc: true,
                render: (setting) => this.renderDatePrefix(setting),
            },
        ];
    }

    /**
     * The switch, then the format label and dropdown, which stay in place
     * and are hidden while the switch is off: nothing needs to re-render.
     */
    private renderDatePrefix(setting: Setting): void {
        let formatGroup: HTMLElement | undefined;
        const showFormat = (enabled: boolean) => {
            formatGroup?.toggleClass("nexus-hidden", !enabled);
        };

        setting.addToggle((toggle) =>
            toggle
                .setValue(this.plugin.settings.addDatePrefix)
                .onChange(async (value) => {
                    this.plugin.settings.addDatePrefix = value;
                    await this.plugin.saveSettings();
                    showFormat(value);
                })
        );

        setting.addDropdown((dropdown) => {
            dropdown
                .addOption("YYYY-MM-DD", "YYYY-MM-DD")
                .addOption("YYYYMMDD", "YYYYMMDD")
                .setValue(this.plugin.settings.dateFormat)
                .onChange(async (value: string) => {
                    if (value === "YYYY-MM-DD" || value === "YYYYMMDD") {
                        this.plugin.settings.dateFormat = value;
                        await this.plugin.saveSettings();
                    }
                });

            // Label and dropdown wrap together.
            formatGroup = setting.controlEl.createSpan({
                cls: "nexus-control-group",
            });
            formatGroup.createSpan({
                text: t("settings.display.add_date_prefix.format_label").trim(),
                cls: "nexus-control-label",
            });
            formatGroup.appendChild(dropdown.selectEl);
        });

        showFormat(this.plugin.settings.addDatePrefix);
    }
}
