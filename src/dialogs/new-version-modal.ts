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
import { GITHUB } from "../config/constants";
import { t } from "../i18n";

/**
 * Universal template for new version announcements
 * Shows support section + What's New + Close button
 */
export class NewVersionModal extends Modal {
    private plugin: NexusAiChatImporterPlugin;
    private version: string;
    private fallbackMessage: string;

    constructor(
        app: App,
        plugin: NexusAiChatImporterPlugin,
        version: string,
        fallbackMessage: string
    ) {
        super(app);
        this.plugin = plugin;
        this.version = version;
        this.fallbackMessage = fallbackMessage;
    }

    onOpen(): void {
        const { titleEl, modalEl } = this;

        // Add custom CSS class to modal element
        modalEl.classList.add("nexus-new-version-modal");

        // Set title
        titleEl.setText(
            t("upgrade.new_version_modal.title", { version: this.version })
        );

        void this.createForm();
    }

    onClose(): void {
        this.contentEl.empty();
    }

    async createForm() {
        const renderComponent = new Component();
        renderComponent.load();
        // Add support section FIRST (at the top) - using reusable component
        createSupportBox(this.contentEl);

        let message = this.fallbackMessage;

        try {
            // Try to fetch the README for the current version and extract the Overview section
            const response = await requestUrl({
                url: `${GITHUB.RAW_BASE}/${this.version}/README.md`,
                method: "GET",
            });
            if (response.status >= 200 && response.status < 300) {
                const overview = this.extractOverviewFromReadme(response.text);
                if (overview) {
                    message = overview;
                }
            }
        } catch {
            // Use fallback message if GitHub fetch fails
        }

        // Render markdown content
        const contentDiv = this.contentEl.createDiv({
            cls: "nexus-upgrade-content",
        });
        await MarkdownRenderer.render(
            this.app,
            message,
            contentDiv,
            "",
            renderComponent
        );

        // Add close button (centered and prominent)
        this.addCloseButton();
    }

    /**
     * Extract the "## Overview" section from README content.
     * Returns only the body under the heading (excluding the heading line itself).
     */
    private extractOverviewFromReadme(readmeText: string): string | null {
        const overviewRegex = /## Overview\s+([\s\S]*?)(?=^##\s|$)/m;
        const match = readmeText.match(overviewRegex);
        return match ? match[1].trim() : null;
    }

    private addCloseButton() {
        const buttonContainer = this.contentEl.createDiv({
            cls: "nexus-close-button-container nexus-dialog-actions",
        });

        const closeButton = buttonContainer.createEl("button", {
            text: t("upgrade.new_version_modal.buttons.got_it"),
            cls: "mod-cta nexus-close-button",
        });

        closeButton.onclick = () => {
            this.close();
        };
    }
}
