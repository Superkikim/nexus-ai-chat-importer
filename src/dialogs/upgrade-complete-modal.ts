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

import { App, Component, Modal, MarkdownRenderer, requestUrl } from "obsidian";
import type NexusAiChatImporterPlugin from "../main";
import { createSupportBox } from "../ui/components/support-box";
import { t } from "../i18n";

/**
 * Upgrade complete modal - shown AFTER migrations are done
 * Displays support section + What's New + Improvements + Bug Fixes
 */
export class UpgradeCompleteModal extends Modal {
    private plugin: NexusAiChatImporterPlugin;
    private version: string;

    constructor(app: App, plugin: NexusAiChatImporterPlugin, version: string) {
        super(app);
        this.plugin = plugin;
        this.version = version;
    }

    onOpen(): void {
        const { contentEl, titleEl, modalEl } = this;

        // Add custom CSS classes (width is set in styles.css)
        modalEl.classList.add("nexus-upgrade-complete-modal");
        contentEl.classList.add("nexus-ai-chat-importer-modal");

        // Set title
        titleEl.setText(
            t("upgrade.complete_modal.title", { version: this.version })
        );

        void this.createContent();
    }

    onClose(): void {
        this.contentEl.empty();
    }

    async createContent() {
        const { contentEl } = this;

        // Support section (using reusable component)
        createSupportBox(contentEl);

        // Release notes content
        await this.addReleaseNotes();

        // Close button (centered and prominent)
        this.addCloseButton();
    }

    private async addReleaseNotes() {
        // Localized fallback content used when README fetch is unavailable
        let content = t("upgrade.complete_modal.fallback_content", {
            version: this.version,
        });

        try {
            // Try to fetch What's New section from README
            const response = await requestUrl({
                url: `https://raw.githubusercontent.com/Superkikim/nexus-ai-chat-importer/${this.version}/README.md`,
                method: "GET",
            });
            if (response.status >= 200 && response.status < 300) {
                const whatsNewMatch = response.text.match(
                    /## ✨ What's New\s+([\s\S]*?)(?=\n## |\n# |$)/
                );
                if (whatsNewMatch && whatsNewMatch[1]) {
                    content = whatsNewMatch[1].trim();
                }
            }
        } catch {
            // Use fallback content
        }

        // Render markdown
        const contentDiv = this.contentEl.createDiv({
            cls: "nexus-upgrade-notes",
        });
        const renderComponent = new Component();
        renderComponent.load();
        await MarkdownRenderer.render(
            this.app,
            content,
            contentDiv,
            "",
            renderComponent
        );
    }

    private addCloseButton() {
        const buttonContainer = this.contentEl.createDiv({
            cls: "nexus-upgrade-button-container nexus-dialog-actions",
        });
        const button = buttonContainer.createEl("button", {
            text: t("upgrade.complete_modal.buttons.got_it"),
            cls: "mod-cta nexus-upgrade-button",
        });

        button.addEventListener("click", () => {
            this.close();
        });
    }
}
