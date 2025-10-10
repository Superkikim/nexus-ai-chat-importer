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


// src/ui/settings/message-date-format-section.ts
import { Setting } from "obsidian";
import { BaseSettingsSection } from "./base-settings-section";
import { MESSAGE_TIMESTAMP_FORMATS } from "../../config/constants";
import { formatMessageTimestamp } from "../../utils";
import type { MessageTimestampFormat } from "../../types/plugin";

export class MessageDateFormatSection extends BaseSettingsSection {
    readonly title = "📅 Message Date Format";
    readonly order = 21;

    render(containerEl: HTMLElement): void {
        // Custom Message Timestamp Format
        new Setting(containerEl)
            .setName("Custom message timestamp format")
            .setDesc("Override the default locale-based timestamp format in message callouts. When disabled, timestamps follow Obsidian's language setting (English = US format).")
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.useCustomMessageTimestampFormat)
                    .onChange(async (value) => {
                        this.plugin.settings.useCustomMessageTimestampFormat = value;
                        await this.plugin.saveSettings();
                        this.redraw(); // Trigger redraw to show/hide format dropdown
                    })
            );

        // Message Timestamp Format Dropdown (only shown if custom format is enabled)
        if (this.plugin.settings.useCustomMessageTimestampFormat) {
            const previewContainer = containerEl.createDiv({ cls: "setting-item-description" });
            
            new Setting(containerEl)
                .setName("Timestamp format")
                .setDesc("Choose the format for message timestamps in conversation notes")
                .addDropdown((dropdown) => {
                    // Add all available formats
                    Object.entries(MESSAGE_TIMESTAMP_FORMATS).forEach(([key, config]) => {
                        dropdown.addOption(key, config.label);
                    });
                    
                    dropdown
                        .setValue(this.plugin.settings.messageTimestampFormat)
                        .onChange(async (value) => {
                            this.plugin.settings.messageTimestampFormat = value as MessageTimestampFormat;
                            await this.plugin.saveSettings();

                            // Update preview
                            this.updateTimestampPreview(previewContainer, value as MessageTimestampFormat);
                        });
                });

            // Initial preview
            this.updateTimestampPreview(previewContainer, this.plugin.settings.messageTimestampFormat);
        }
    }

    /**
     * Update timestamp format preview
     */
    private updateTimestampPreview(container: HTMLElement, format: MessageTimestampFormat): void {
        // Use the existing formatMessageTimestamp utility function
        const now = Date.now() / 1000;
        const preview = formatMessageTimestamp(now, format);

        container.empty();
        container.createEl("strong", { text: "Preview: " });
        container.createEl("code", { text: preview });

        // Add format description
        const config = MESSAGE_TIMESTAMP_FORMATS[format];
        if (config) {
            container.createEl("br");
            container.createEl("small", {
                text: config.description,
                cls: "setting-item-description"
            });
        }
    }
}

