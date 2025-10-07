// src/ui/settings/display-settings-section.ts
import { Setting } from "obsidian";
import { BaseSettingsSection } from "./base-settings-section";

export class DisplaySettingsSection extends BaseSettingsSection {
    readonly title = "🎨 Display Options";
    readonly order = 20;

    render(containerEl: HTMLElement): void {
        // Add Date Prefix
        new Setting(containerEl)
            .setName("Add date prefix to filenames")
            .setDesc("Add creation date as a prefix to conversation filenames")
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.addDatePrefix)
                    .onChange(async (value) => {
                        this.plugin.settings.addDatePrefix = value;
                        await this.plugin.saveSettings();
                        this.redraw(); // Trigger redraw to show/hide date format options
                    })
            );

        // Date Format (only shown if addDatePrefix is enabled)
        if (this.plugin.settings.addDatePrefix) {
            new Setting(containerEl)
                .setName("Date format")
                .setDesc("Choose the format for the date prefix")
                .addDropdown((dropdown) =>
                    dropdown
                        .addOption("YYYY-MM-DD", "YYYY-MM-DD")
                        .addOption("YYYYMMDD", "YYYYMMDD")
                        .setValue(this.plugin.settings.dateFormat)
                        .onChange(async (value: string) => {
                            if (value === "YYYY-MM-DD" || value === "YYYYMMDD") {
                                this.plugin.settings.dateFormat = value as "YYYY-MM-DD" | "YYYYMMDD";
                                await this.plugin.saveSettings();
                            }
                        })
                );
        }
    }
}

