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

// src/dialogs/import-completion-dialog.ts
import { App, Modal, TFile } from "obsidian";
import { createSupportBox } from "../ui/components/support-box";
import { Logger } from "../logger";
import { t } from "../i18n";

const logger = new Logger();

export interface ImportCompletionStats {
    totalFiles: number;
    totalConversations: number;
    duplicates: number;
    created: number;
    updated: number;
    skipped: number;
    /** Offered in the selection dialog and left unchecked; null on a full import. */
    notSelected: number | null;
    emptyConversations: number;
    failed: number;
    attachmentsFound: number;
    attachmentsTotal: number;
    attachmentsMissing: number;
    attachmentsFailed: number;
}

export class ImportCompletionDialog extends Modal {
    private reportFilePath: string;
    private stats: ImportCompletionStats;
    private onCloseCallback?: () => void;

    constructor(
        app: App,
        stats: ImportCompletionStats,
        reportFilePath: string,
        onClose?: () => void
    ) {
        super(app);
        this.stats = stats;
        this.reportFilePath = reportFilePath;
        this.onCloseCallback = onClose;
    }

    onOpen() {
        const { contentEl, modalEl, titleEl } = this;
        contentEl.empty();

        // Add class to modal
        modalEl.addClass("nexus-import-completion-dialog");
        contentEl.addClass("nexus-import-completion-dialog");

        // Set title
        titleEl.setText(t("import_completion.title"));

        // Success message
        const successMsg = contentEl.createDiv("success-message");
        successMsg.addClass("nexus-success-message");
        successMsg.setText(t("import_completion.success_message"));

        // Statistics section with cartouches
        this.createStatsSection(contentEl);

        // Attachments summary (if any)
        if (this.stats.attachmentsTotal > 0) {
            this.createAttachmentsSection(contentEl);
        }

        // Report link section
        this.createReportSection(contentEl);

        // Support section (using reusable component)
        createSupportBox(contentEl);

        // Action buttons
        this.createActionButtons(contentEl);
    }

    private createStatsSection(container: HTMLElement) {
        const section = container.createDiv(
            "stats-section nexus-stats-grid nexus-dialog-section"
        );

        // Files cartouche
        this.createStatCartouche(
            section,
            "📁",
            this.stats.totalFiles.toString(),
            t("import_completion.stats.zip_files_processed")
        );

        // Total conversations cartouche (unique UUIDs in ZIPs)
        this.createStatCartouche(
            section,
            "💬",
            this.stats.totalConversations.toString(),
            t("import_completion.stats.unique_conversations")
        );

        // Duplicates cartouche (always shown to explain difference between total and created)
        this.createStatCartouche(
            section,
            "🔁",
            this.stats.duplicates.toString(),
            t("import_completion.stats.duplicates"),
            "var(--text-muted)"
        );

        // Created cartouche
        this.createStatCartouche(
            section,
            "✨",
            this.stats.created.toString(),
            t("import_completion.stats.new"),
            "var(--color-green)"
        );

        // Updated cartouche
        this.createStatCartouche(
            section,
            "🔄",
            this.stats.updated.toString(),
            t("import_completion.stats.updated"),
            "var(--color-orange)"
        );

        // Unchanged cartouche. The suffix used to be hardcoded English.
        const skippedLabel =
            this.stats.emptyConversations > 0
                ? `${t("import_completion.stats.skipped")} (${t(
                      "import_completion.stats.empty_suffix",
                      { count: String(this.stats.emptyConversations) }
                  )})`
                : t("import_completion.stats.skipped");
        this.createStatCartouche(
            section,
            "⏭️",
            this.stats.skipped.toString(),
            skippedLabel,
            "var(--text-muted)"
        );

        // Only a selective import has a declined population to report.
        if (this.stats.notSelected !== null && this.stats.notSelected > 0) {
            this.createStatCartouche(
                section,
                "☐",
                this.stats.notSelected.toString(),
                t("import_completion.stats.not_selected"),
                "var(--text-muted)"
            );
        }

        // Failed cartouche (only if > 0)
        if (this.stats.failed > 0) {
            this.createStatCartouche(
                section,
                "❌",
                this.stats.failed.toString(),
                t("import_completion.stats.failed"),
                "var(--color-red)"
            );
        }
    }

    private createStatCartouche(
        container: HTMLElement,
        icon: string,
        value: string,
        label: string,
        color?: string
    ) {
        const cartouche = container.createDiv("stat-cartouche");
        cartouche.addClass("nexus-stat-card");

        const iconEl = cartouche.createDiv({ cls: "nexus-stat-card-icon" });
        iconEl.textContent = icon;

        const valueEl = cartouche.createDiv({ cls: "nexus-stat-card-value" });
        valueEl.textContent = value;
        valueEl.style.color = color || "var(--text-accent)";

        const labelEl = cartouche.createDiv({ cls: "nexus-stat-card-label" });
        labelEl.textContent = label;
    }

    private createAttachmentsSection(container: HTMLElement) {
        const section = container.createDiv(
            "attachments-section nexus-dialog-section nexus-completion-panel nexus-completion-panel-center"
        );

        const percentage = Math.round(
            (this.stats.attachmentsFound / this.stats.attachmentsTotal) * 100
        );

        const icon = percentage === 100 ? "✅" : percentage > 50 ? "⚠️" : "❌";
        const color =
            percentage === 100
                ? "var(--color-green)"
                : percentage > 50
                ? "var(--color-orange)"
                : "var(--color-red)";

        const attachmentText = section.createDiv();
        attachmentText.appendText(`${icon} `);
        attachmentText.createEl("strong", {
            text: t("import_completion.attachments.label"),
        });
        attachmentText.appendText(
            ` ${t("import_completion.attachments.summary", {
                found: String(this.stats.attachmentsFound),
                total: String(this.stats.attachmentsTotal),
                percentage: String(percentage),
            })}`
        );
        attachmentText.style.color = color;

        if (
            this.stats.attachmentsMissing > 0 ||
            this.stats.attachmentsFailed > 0
        ) {
            const details = section.createDiv();
            details.addClass("nexus-completion-panel-detail");
            details.textContent = t(
                "import_completion.attachments.missing_failed",
                {
                    missing: String(this.stats.attachmentsMissing),
                    failed: String(this.stats.attachmentsFailed),
                }
            );
        }
    }

    private createReportSection(container: HTMLElement) {
        const section = container.createDiv(
            "report-section nexus-dialog-section nexus-completion-panel"
        );

        const label = section.createDiv({
            cls: "nexus-completion-panel-label",
        });
        label.textContent = t("import_completion.report.label");

        const link = section.createEl("a", { cls: "nexus-completion-link" });
        link.textContent = this.reportFilePath;
        link.addEventListener("click", (e) => {
            e.preventDefault();
            void this.openReport();
        });
        link.addEventListener("mouseenter", () => {
            link.addClass("nexus-link-hover");
        });
        link.addEventListener("mouseleave", () => {
            link.removeClass("nexus-link-hover");
        });
    }

    private createActionButtons(container: HTMLElement) {
        const buttonContainer = container.createDiv(
            "action-buttons nexus-dialog-actions"
        );

        // View Report button
        const viewReportBtn = buttonContainer.createEl("button", {
            text: t("import_completion.buttons.view_report"),
        });
        viewReportBtn.addEventListener("click", () => {
            void this.openReport();
            this.close();
        });

        // OK button
        const okBtn = buttonContainer.createEl("button", {
            text: t("import_completion.buttons.ok"),
        });
        okBtn.classList.add("mod-cta");
        okBtn.addEventListener("click", () => this.close());
    }

    private async openReport() {
        try {
            const file = this.app.vault.getAbstractFileByPath(
                this.reportFilePath
            );
            if (file instanceof TFile) {
                await this.app.workspace.getLeaf(false).openFile(file);
            }
        } catch (error) {
            logger.error("Failed to open report:", error);
        }
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
        this.onCloseCallback?.();
    }
}
