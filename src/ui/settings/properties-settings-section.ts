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

// src/ui/settings/properties-settings-section.ts
import { Setting } from "obsidian";
import { BaseSettingsSection } from "./base-settings-section";
import { t } from "../../i18n";
import { CustomIdPropertyService } from "../../services/custom-id-property-service";
import { CustomIdPropertyDialogs } from "../../dialogs/custom-id-property-dialogs";
import { CustomIdPropertyController } from "./custom-id-property-controller";

/** A description with line breaks and `code` spans, built without HTML. */
function describe(text: string): DocumentFragment {
    const fragment = createFragment();
    text.split("\n").forEach((line, index) => {
        if (index > 0) fragment.createEl("br");
        for (const part of line.split(/(`[^`]+`)/)) {
            if (part.length > 2 && part.startsWith("`") && part.endsWith("`")) {
                fragment.createEl("code", { text: part.slice(1, -1) });
            } else if (part) {
                fragment.appendText(part);
            }
        }
    });
    return fragment;
}

export class PropertiesSettingsSection extends BaseSettingsSection {
    get title() {
        return t("settings.properties.section_title");
    }
    readonly order = 12;

    private committing = false;
    private pendingCommit?: () => void;

    render(containerEl: HTMLElement): void {
        const plugin = this.plugin;
        const service = new CustomIdPropertyService(
            plugin.app,
            plugin.manifest.id
        );
        const controller = new CustomIdPropertyController(
            {
                get name() {
                    return plugin.settings.customIdProperty;
                },
                get overwrite() {
                    return plugin.settings.customIdPropertyOverwrite;
                },
                save: async (name: string) => {
                    plugin.settings.customIdProperty = name;
                    await plugin.saveSettings();
                },
            },
            service,
            new CustomIdPropertyDialogs(plugin.app, service, plugin.logger)
        );

        // One setting: the name field, then the overwrite toggle with its
        // label, and both explained in a single description.
        const nameSetting = new Setting(containerEl)
            .setName(t("settings.properties.custom_id.name"))
            .setDesc(
                describe(
                    `${t("settings.properties.custom_id.desc")}\n${t(
                        "settings.properties.overwrite.desc"
                    )}`
                )
            );
        nameSetting.settingEl.addClass("nexus-custom-id-setting");

        const warning = containerEl.createDiv({
            cls: "nexus-setting-warning",
        });
        warning.hide();

        nameSetting.addText((text) => {
            text.setValue(plugin.settings.customIdProperty).onChange(() =>
                warning.hide()
            );
            // Committed on blur, not per keystroke: typing "uid" must not
            // rename the property to "u", then "ui", on thousands of notes.
            text.inputEl.addEventListener("blur", () => {
                void this.commit(controller, text.inputEl, warning);
            });
            this.pendingCommit = () =>
                void this.commit(controller, text.inputEl, warning);
            // Enter commits too, through the same path.
            text.inputEl.addEventListener("keydown", (event) => {
                if (event.key === "Enter") {
                    event.preventDefault();
                    void this.commit(controller, text.inputEl, warning);
                }
            });
        });

        nameSetting.addToggle((toggle) => {
            toggle
                .setValue(plugin.settings.customIdPropertyOverwrite)
                .onChange(async (value) => {
                    plugin.settings.customIdPropertyOverwrite = value;
                    await plugin.saveSettings();
                });
            const label = nameSetting.controlEl.createSpan({
                text: t("settings.properties.overwrite.name"),
                cls: "nexus-custom-id-overwrite-label",
            });
            label.addEventListener("click", () => toggle.toggleEl.click());
        });
    }

    /** A name typed just before the tab closed is committed, not dropped. */
    onHide(): void {
        this.pendingCommit?.();
        this.pendingCommit = undefined;
    }

    private async commit(
        controller: CustomIdPropertyController,
        input: HTMLInputElement,
        warning: HTMLElement
    ): Promise<void> {
        // The dialogs take focus away from the field, which fires blur again.
        if (this.committing) return;
        this.committing = true;
        input.disabled = true;

        const typed = input.value.trim();
        try {
            const result = await controller.commit(typed);
            input.value = result.value;
            if (result.warning) {
                warning.setText(
                    t(
                        result.warning === "format"
                            ? "settings.properties.custom_id.invalid_format"
                            : "settings.properties.custom_id.invalid_reserved",
                        { value: typed }
                    )
                );
                warning.show();
            } else {
                warning.hide();
            }
        } finally {
            input.disabled = false;
            this.committing = false;
        }
    }
}
