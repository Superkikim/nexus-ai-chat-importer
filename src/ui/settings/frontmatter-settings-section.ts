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

// src/ui/settings/frontmatter-settings-section.ts
import { Setting } from "obsidian";
import { BaseSettingsSection } from "./base-settings-section";
import { t } from "../../i18n";
import {
    DEFAULT_CONVERSATION_ID_FIELD,
    isValidConversationIdField,
} from "../../utils/conversation-id-field";

export class FrontmatterSettingsSection extends BaseSettingsSection {
    get title() {
        return t("settings.frontmatter.section_title");
    }
    readonly order = 25;

    render(containerEl: HTMLElement): void {
        const setting = new Setting(containerEl)
            .setName(t("settings.frontmatter.conversation_id_field.name"))
            .setDesc(t("settings.frontmatter.conversation_id_field.desc"));

        const warning = containerEl.createDiv({
            cls: "nexus-setting-warning",
        });
        warning.hide();

        setting.addText((text) =>
            text
                .setPlaceholder(DEFAULT_CONVERSATION_ID_FIELD)
                .setValue(this.plugin.settings.conversationIdField)
                // Commit on blur, not per keystroke. onChange fires on every
                // character, so typing "uid" over a valid key would persist
                // "u" then "ui" — and a user interrupted mid-word would leave
                // a one-letter key saved, writing `u: <id>` into every note.
                .onChange(() => {
                    warning.hide();
                })
                .inputEl.addEventListener("blur", (event) => {
                    const input = event.target as HTMLInputElement;
                    const value = input.value.trim();

                    // Empty means "use the default" rather than "no key".
                    if (!value) {
                        warning.hide();
                        input.value = DEFAULT_CONVERSATION_ID_FIELD;
                        this.plugin.settings.conversationIdField =
                            DEFAULT_CONVERSATION_ID_FIELD;
                        void this.plugin.saveSettings();
                        return;
                    }

                    // Reject rather than write frontmatter that will not parse,
                    // or a key the formatter already emits.
                    if (!isValidConversationIdField(value)) {
                        warning.setText(
                            t(
                                "settings.frontmatter.conversation_id_field.invalid",
                                {
                                    value,
                                }
                            )
                        );
                        warning.show();
                        // Show what is actually in effect, not the rejection.
                        input.value = this.plugin.settings.conversationIdField;
                        return;
                    }

                    warning.hide();
                    this.plugin.settings.conversationIdField = value;
                    void this.plugin.saveSettings();
                })
        );
    }
}
