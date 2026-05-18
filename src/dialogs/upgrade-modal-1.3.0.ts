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
 * Upgrade modal for v1.3.0 with support section
 */
export class NexusUpgradeModal130 extends Modal {
    private plugin: NexusAiChatImporterPlugin;
    private version: string;
    private resolve: (value: string) => void;
    private hasResolved: boolean = false;

    constructor(
        app: App,
        plugin: NexusAiChatImporterPlugin,
        version: string,
        resolve: (value: string) => void
    ) {
        super(app);
        this.plugin = plugin;
        this.version = version;
        this.resolve = resolve;
    }

    onOpen(): void {
        const { titleEl, modalEl } = this;

        // Add custom CSS class to modal element
        modalEl.classList.add("nexus-upgrade-modal-130");

        // Set title
        titleEl.setText(
            t("upgrade.modal_130.title", { version: this.version })
        );
        this.modalEl.querySelector(".modal-close-button")?.remove();

        void this.createForm();
    }

    onClose(): void {
        // If user closed dialog without clicking button, resolve with "cancel"
        if (!this.hasResolved) {
            this.resolve("cancel");
        }
        this.contentEl.empty();
    }

    async createForm() {
        // Add support section FIRST (at the top) - using reusable component
        createSupportBox(this.contentEl);

        // Add migration info section
        this.addMigrationSection();

        // Add migration button (centered and prominent)
        this.addMigrationButton();

        // Fallback message if GitHub fetch fails
        let message = `## ✨ What's New in v1.3.0

- **🎯 Selective Conversation Import**: Interactive dialog to choose which conversations to import
- **📊 Enhanced Reports**: Per-file statistics with detailed breakdown
- **🗂️ Flexible Folders**: Separate settings for conversations, attachments, and reports
- **🌍 International Support**: ISO 8601 timestamps work with all locales
- **🐛 26 Bug Fixes**: Improved stability and reliability

---

### 💡 Tip

Try the new **selective import** feature on your next import - you'll love the control it gives you!`;

        try {
            // Try to fetch release notes from GitHub
            const response = await requestUrl({
                url: "https://api.github.com/repos/Superkikim/nexus-ai-chat-importer/releases/tags/v1.3.0",
                method: "GET",
            });
            if (response.status >= 200 && response.status < 300) {
                const release = response.json;
                if (release.body) {
                    message = release.body;
                }
            }
        } catch {
            // Use fallback message if GitHub fetch fails
        }

        // Render markdown content
        const contentDiv = this.contentEl.createDiv({
            cls: "nexus-upgrade-content",
        });
        const renderComponent = new Component();
        renderComponent.load();
        await MarkdownRenderer.render(
            this.app,
            message,
            contentDiv,
            "",
            renderComponent
        );
    }

    private addMigrationSection() {
        const migrationSection = this.contentEl.createDiv({
            cls: "nexus-migration-section",
        });

        // Header
        const header = migrationSection.createDiv({
            cls: "nexus-migration-header",
        });
        header.createDiv({
            cls: "nexus-migration-title",
            text: t("upgrade.modal_130.migration_section.title"),
        });

        // Message
        const message = migrationSection.createDiv({
            cls: "nexus-migration-message",
        });
        message.createEl("p", {
            text: t("upgrade.modal_130.migration_section.message"),
        });

        // Task list
        const taskList = migrationSection.createDiv({
            cls: "nexus-migration-tasks",
        });
        const ul = taskList.createEl("ul");
        ul.createEl("li", {
            text: t(
                "upgrade.modal_130.migration_section.tasks.folder_settings"
            ),
        });
        ul.createEl("li", {
            text: t("upgrade.modal_130.migration_section.tasks.timestamps"),
        });
        ul.createEl("li", {
            text: t("upgrade.modal_130.migration_section.tasks.aliases"),
        });
        ul.createEl("li", {
            text: t("upgrade.modal_130.migration_section.tasks.reports"),
        });
        ul.createEl("li", {
            text: t("upgrade.modal_130.migration_section.tasks.artifacts"),
        });

        // Estimated time
        const estimate = migrationSection.createDiv({
            cls: "nexus-migration-estimate",
        });
        estimate.createEl("p").createEl("em", {
            text: t("upgrade.modal_130.migration_section.estimate"),
        });
    }

    private addMigrationButton() {
        const buttonContainer = this.contentEl.createDiv({
            cls: "nexus-migration-button-container",
        });

        const migrationButton = buttonContainer.createEl("button", {
            text: t("upgrade.modal_130.buttons.run_migration"),
            cls: "mod-cta nexus-migration-button",
        });

        migrationButton.onclick = () => {
            this.hasResolved = true;
            this.resolve("ok");
            this.close();
        };
    }
}
