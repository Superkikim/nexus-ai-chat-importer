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
import { BaseSettingsSection } from "./base-settings-section";
import { t } from "../../i18n";
import { setFullWidthDescription } from "./full-width-description";

export class DisplaySettingsSection extends BaseSettingsSection {
    get title() {
        return t("settings.display.section_title");
    }
    readonly order = 10;

    render(containerEl: HTMLElement): void {
        // Add custom styling for better readability
        const sectionContainer = containerEl.createDiv({
            cls: "nexus-date-prefix-section",
        });

        // Name, switch and (when on) the format dropdown on the first row;
        // the description across the full width under them.
        const setting = new Setting(sectionContainer).setName(
            t("settings.display.add_date_prefix.name")
        );

        setting.addToggle((toggle) =>
            toggle
                .setValue(this.plugin.settings.addDatePrefix)
                .onChange(async (value) => {
                    this.plugin.settings.addDatePrefix = value;
                    await this.plugin.saveSettings();
                    this.redraw(); // Show or hide the format dropdown
                })
        );

        if (this.plugin.settings.addDatePrefix) {
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
                const group = setting.controlEl.createSpan({
                    cls: "nexus-control-group",
                });
                group.createSpan({
                    text: t(
                        "settings.display.add_date_prefix.format_label"
                    ).trim(),
                    cls: "nexus-control-label",
                });
                group.appendChild(dropdown.selectEl);
            });
        }

        setFullWidthDescription(
            setting,
            t("settings.display.add_date_prefix.desc")
        );
    }
}
