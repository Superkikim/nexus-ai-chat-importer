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
import { createKofiSupportBox } from "../components/kofi-support-box";

export class SupportSection extends BaseSettingsSection {
    readonly title = "💝 Support & Help";
    readonly order = 5;

    render(containerEl: HTMLElement): void {
        const supportContainer = containerEl.createDiv({ cls: "nexus-support-section" });

        // Use reusable Ko-fi support box component
        createKofiSupportBox(supportContainer);

        // Separator
        supportContainer.createEl("hr", { cls: "nexus-section-separator" });

        // Resources section
        const resourcesTitle = supportContainer.createEl("h3", { text: "📚 Resources" });
        resourcesTitle.style.cssText = `
            margin: 1.5em 0 1em 0;
            color: var(--text-normal);
            font-size: 1.1em;
        `;

        // Documentation
        new Setting(supportContainer)
            .setName("📖 Documentation")
            .setDesc("Learn how to use the plugin and explore all features")
            .addButton((button) =>
                button
                    .setButtonText("Open README")
                    .onClick(() => {
                        window.open("https://github.com/superkikim/nexus-ai-chat-importer/blob/master/README.md", "_blank");
                    })
            );

        // Release Notes
        new Setting(supportContainer)
            .setName("📝 Release Notes")
            .setDesc("What's new in this version and previous updates")
            .addButton((button) =>
                button
                    .setButtonText("View Changelog")
                    .onClick(() => {
                        window.open("https://github.com/superkikim/nexus-ai-chat-importer/blob/master/RELEASE_NOTES.md", "_blank");
                    })
            );

        // Report Issues
        new Setting(supportContainer)
            .setName("🐛 Report Issues")
            .setDesc("Found a bug? Let us know on GitHub")
            .addButton((button) =>
                button
                    .setButtonText("Open Issues")
                    .onClick(() => {
                        window.open("https://github.com/superkikim/nexus-ai-chat-importer/issues", "_blank");
                    })
            );

        // Community Forum
        new Setting(supportContainer)
            .setName("💬 Community Forum")
            .setDesc("Join the discussion and connect with other users")
            .addButton((button) =>
                button
                    .setButtonText("Open Forum")
                    .onClick(() => {
                        window.open("https://forum.obsidian.md/t/plugin-nexus-ai-chat-importer-import-chatgpt-and-claude-conversations-to-your-vault/71664", "_blank");
                    })
            );

        // Separator
        supportContainer.createEl("hr", { cls: "nexus-section-separator" });
    }
}

