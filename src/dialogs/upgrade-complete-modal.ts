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

import { App, Component, Modal, MarkdownRenderer, TFile } from "obsidian";
import type NexusAiChatImporterPlugin from "../main";
import { createSupportBox } from "../ui/components/support-box";
import { createResourceLinks } from "../ui/components/resource-links";
import { fetchWhatsNewSection } from "../utils/release-notes";
import { t } from "../i18n";

/**
 * Upgrade complete modal - shown AFTER migrations are done
 * Displays support section + What's New + Improvements + Bug Fixes
 */
export class UpgradeCompleteModal extends Modal {
    private plugin: NexusAiChatImporterPlugin;
    private version: string;
    private reportPath?: string;
    private repairSummary?: string;

    constructor(
        app: App,
        plugin: NexusAiChatImporterPlugin,
        version: string,
        reportPath?: string,
        repairSummary?: string
    ) {
        super(app);
        this.plugin = plugin;
        this.version = version;
        this.reportPath = reportPath;
        this.repairSummary = repairSummary;
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

        // What actually changed in your vault this run, if anything did
        this.addRepairSummary();

        // Release notes content
        await this.addReleaseNotes();

        // Close button (centered and prominent)
        this.addCloseButton();

        // Resource links grid
        createResourceLinks(contentEl);
    }

    private addRepairSummary(): void {
        if (!this.repairSummary) return;

        const summaryEl = this.contentEl.createDiv({
            cls: "nexus-upgrade-repair-summary",
        });
        summaryEl.createSpan({ text: this.repairSummary });

        if (this.reportPath) {
            summaryEl.appendText(" ");
            const link = summaryEl.createEl("a", {
                text: t("import_completion.buttons.view_report"),
                cls: "external-link",
                href: "#",
            });
            link.addEventListener("click", (event) => {
                event.preventDefault();
                void this.openReport();
            });
        }
    }

    /** Matches ImportCompletionDialog's own report-opening behaviour. */
    private async openReport(): Promise<void> {
        try {
            const file = this.app.vault.getAbstractFileByPath(
                this.reportPath as string
            );
            if (file instanceof TFile) {
                await this.app.workspace.getLeaf(false).openFile(file);
            }
        } finally {
            this.close();
        }
    }

    private async addReleaseNotes() {
        // Localized fallback, shown when the README fetch is unavailable
        // (offline, tag not yet published).
        const fetched = await fetchWhatsNewSection(this.version);
        const content =
            fetched ??
            t("upgrade.complete_modal.fallback_content", {
                version: this.version,
            });

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
