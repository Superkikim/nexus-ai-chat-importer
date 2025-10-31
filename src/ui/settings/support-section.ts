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
        const kofiBox = createKofiSupportBox({
            message: "I'm working on Nexus projects full-time while unemployed and dealing with health issues. Over 1,000 users so far, but only $10 in donations while paying $200/month in expenses. A donation would mean the world and help keep these plugins alive."
        });
        supportContainer.appendChild(kofiBox);

        // Separator
        supportContainer.createEl("hr", { cls: "nexus-section-separator" });

        // GitHub Issues (standard setting style)
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
    }
}

