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
        const supportContainer = containerEl.createDiv({ cls: "nexus-support-section" });

        // Hero message container
        const heroContainer = supportContainer.createDiv({ cls: "nexus-support-hero" });

        heroContainer.createEl("h3", {
            text: "Support Nexus Projects",
            cls: "nexus-support-title"
        });

        const messageContainer = heroContainer.createDiv({ cls: "nexus-support-message-container" });

        const line1 = messageContainer.createEl("p", { cls: "nexus-support-line" });
        line1.setText("I'm working on Nexus projects full-time while unemployed and dealing with health issues.");

        const line2 = messageContainer.createEl("p", { cls: "nexus-support-line" });
        line2.setText("Over 1,000 users so far, but only $10 in donations while paying $200/month in expenses.");

        const line3 = messageContainer.createEl("p", { cls: "nexus-support-line nexus-support-cta-text" });
        line3.setText("A donation would mean the world and help keep these plugins alive.");

        // Support stats (visual impact)
        const statsContainer = heroContainer.createDiv({ cls: "nexus-support-stats" });

        const stat1 = statsContainer.createDiv({ cls: "nexus-stat" });
        stat1.createEl("div", { text: "1,000+", cls: "nexus-stat-number" });
        stat1.createEl("div", { text: "Users", cls: "nexus-stat-label" });

        const stat2 = statsContainer.createDiv({ cls: "nexus-stat" });
        stat2.createEl("div", { text: "$10", cls: "nexus-stat-number nexus-stat-negative" });
        stat2.createEl("div", { text: "Received", cls: "nexus-stat-label" });

        const stat3 = statsContainer.createDiv({ cls: "nexus-stat" });
        stat3.createEl("div", { text: "$200/mo", cls: "nexus-stat-number nexus-stat-negative" });
        stat3.createEl("div", { text: "Expenses", cls: "nexus-stat-label" });

        // CTA Button (centered)
        const ctaContainer = heroContainer.createDiv({ cls: "nexus-support-cta" });
        const kofiButton = ctaContainer.createEl("button", {
            text: "☕ Support on Ko-fi",
            cls: "mod-cta nexus-kofi-button"
        });
        kofiButton.onclick = () => {
            window.open("https://ko-fi.com/nexusplugins", "_blank");
        };

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

