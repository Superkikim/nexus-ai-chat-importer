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
import {
    DEFAULT_CONVERSATION_ID_FIELD,
    isValidConversationIdField,
} from "../../utils/conversation-id-field";

export class FrontmatterSettingsSection extends BaseSettingsSection {
    get title() {
        return "Frontmatter";
    }
    readonly order = 25;

    render(containerEl: HTMLElement): void {
        const setting = new Setting(containerEl)
            .setName("Conversation ID field")
            .setDesc(
                "Frontmatter key holding each conversation's id. Set this to your vault's own identifier — commonly 'uid' — so imported notes join that scheme. Notes already written under another key are still recognised, so changing this will not duplicate them."
            );

        const warning = containerEl.createDiv({
            cls: "nexus-setting-warning",
        });
        warning.hide();

        setting.addText((text) =>
            text
                .setPlaceholder(DEFAULT_CONVERSATION_ID_FIELD)
                .setValue(this.plugin.settings.conversationIdField)
                .onChange(async (raw: string) => {
                    const value = raw.trim();

                    // Empty means "use the default" rather than "no key".
                    if (!value) {
                        warning.hide();
                        this.plugin.settings.conversationIdField =
                            DEFAULT_CONVERSATION_ID_FIELD;
                        await this.plugin.saveSettings();
                        return;
                    }

                    // Reject rather than write frontmatter that will not parse.
                    if (!isValidConversationIdField(value)) {
                        warning.setText(
                            `"${value}" is not a usable frontmatter key — use letters, digits, underscore or hyphen, starting with a letter or underscore. Keeping the previous value.`
                        );
                        warning.show();
                        return;
                    }

                    warning.hide();
                    this.plugin.settings.conversationIdField = value;
                    await this.plugin.saveSettings();
                })
        );
    }
}
