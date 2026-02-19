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
import { t } from '../../i18n';

export class MessageDateFormatSection extends BaseSettingsSection {
    get title() { return t('settings.timestamps.section_title'); }
    readonly order = 21;

    render(containerEl: HTMLElement): void {
        // Add custom styling for better readability
        const sectionContainer = containerEl.createDiv({ cls: "nexus-message-date-section" });

        // Custom Message Timestamp Format
        new Setting(sectionContainer)
            .setName(t('settings.timestamps.custom_format.name'))
            .setDesc(t('settings.timestamps.custom_format.desc'))
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
            new Setting(sectionContainer)
                .setName(t('settings.timestamps.timestamp_format.name'))
                .setDesc(t('settings.timestamps.timestamp_format.desc'))
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

            // Preview container AFTER the dropdown setting
            const previewContainer = sectionContainer.createDiv({ cls: "nexus-timestamp-preview" });

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

        // Create preview with better styling
        const previewLine = container.createDiv({ cls: "nexus-preview-line" });
        previewLine.createEl("strong", { text: t('settings.timestamps.preview_label') });
        previewLine.createEl("code", { text: preview, cls: "nexus-preview-code" });

        // Add format description
        const config = MESSAGE_TIMESTAMP_FORMATS[format];
        if (config) {
            container.createEl("div", {
                text: config.description,
                cls: "nexus-format-description"
            });
        }
    }
}

