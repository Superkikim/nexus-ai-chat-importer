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

export class SupportSection extends BaseSettingsSection {
    readonly title = "💝 Support & Help";
    readonly order = 5;

    render(containerEl: HTMLElement): void {
        // Add custom styling for support section
        const supportContainer = containerEl.createDiv({ cls: "nexus-support-section" });
        
        // Ko-fi Support
        new Setting(supportContainer)
            .setName("☕ Support Development")
            .setDesc("I'm working on Nexus projects full-time while unemployed and dealing with health issues - over 1,000 users so far, but I've received just $10 in donations while paying $200/month out of pocket in expenses. If these plugins help you, even a small donation would mean the world and help keep them alive.")            .addButton((button) =>
                button
                    .setButtonText("Support on Ko-fi")
                    .setCta()
                    .onClick(() => {
                        window.open("https://ko-fi.com/nexusplugins", "_blank");
                    })
            );

        // GitHub Issues
        new Setting(supportContainer)
            .setName("🐛 Report Issues & Request Features")
            .setDesc("Found a bug or have a feature request? Open an issue on GitHub to help improve the plugin.")
            .addButton((button) =>
                button
                    .setButtonText("Open GitHub Issues")
                    .onClick(() => {
                        window.open("https://github.com/Superkikim/nexus-ai-chat-importer/issues", "_blank");
                    })
            );

        // Add separator
        supportContainer.createEl("hr", { cls: "nexus-section-separator" });
    }
}

