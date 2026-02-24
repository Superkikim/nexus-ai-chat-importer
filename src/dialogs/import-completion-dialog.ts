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
import { App, Modal } from "obsidian";
import { createKofiSupportBox } from "../ui/components/kofi-support-box";
import { Logger } from "../logger";
import { t } from '../i18n';

const logger = new Logger();

export interface ImportCompletionStats {
    totalFiles: number;
    totalConversations: number;
    duplicates: number;
    created: number;
    updated: number;
    skipped: number;
    failed: number;
    attachmentsFound: number;
    attachmentsTotal: number;
    attachmentsMissing: number;
    attachmentsFailed: number;
}

export class ImportCompletionDialog extends Modal {
    private reportFilePath: string;
    private stats: ImportCompletionStats;

    constructor(
        app: App,
        stats: ImportCompletionStats,
        reportFilePath: string
    ) {
        super(app);
        this.stats = stats;
        this.reportFilePath = reportFilePath;
    }

    onOpen() {
        const { contentEl, modalEl, titleEl } = this;
        contentEl.empty();

        // Add class to modal
        modalEl.addClass('nexus-import-completion-dialog');
        contentEl.addClass('nexus-import-completion-dialog');

        // Set title
        titleEl.setText(t('import_completion.title'));

        // Success message
        const successMsg = contentEl.createDiv('success-message');
        successMsg.style.textAlign = "center";
        successMsg.style.marginBottom = "20px";
        successMsg.style.fontSize = "1.1em";
        successMsg.style.color = "var(--color-green)";
        successMsg.innerHTML = t('import_completion.success_message');

        // Statistics section with cartouches
        this.createStatsSection(contentEl);

        // Attachments summary (if any)
        if (this.stats.attachmentsTotal > 0) {
            this.createAttachmentsSection(contentEl);
        }

        // Report link section
        this.createReportSection(contentEl);

        // Ko-fi support section (using reusable component)
        createKofiSupportBox(contentEl);

        // Action buttons
        this.createActionButtons(contentEl);

        // Add custom styles
        this.addCustomStyles();
    }

    private createStatsSection(container: HTMLElement) {
        const section = container.createDiv('stats-section');
        section.style.marginBottom = "20px";
        section.style.display = "grid";
        section.style.gridTemplateColumns = "repeat(3, 1fr)";
        section.style.gap = "12px";

        // Files cartouche
        this.createStatCartouche(section, "📁", this.stats.totalFiles.toString(), t('import_completion.stats.zip_files_processed'));

        // Total conversations cartouche (unique UUIDs in ZIPs)
        this.createStatCartouche(section, "💬", this.stats.totalConversations.toString(), t('import_completion.stats.unique_conversations'));

        // Duplicates cartouche (always shown to explain difference between total and created)
        this.createStatCartouche(section, "🔁", this.stats.duplicates.toString(), t('import_completion.stats.duplicates'), "var(--text-muted)");

        // Created cartouche
        this.createStatCartouche(section, "✨", this.stats.created.toString(), t('import_completion.stats.new'), "var(--color-green)");

        // Updated cartouche
        this.createStatCartouche(section, "🔄", this.stats.updated.toString(), t('import_completion.stats.updated'), "var(--color-orange)");

        // Skipped cartouche
        this.createStatCartouche(section, "⏭️", this.stats.skipped.toString(), t('import_completion.stats.skipped'), "var(--text-muted)");

        // Failed cartouche (only if > 0)
        if (this.stats.failed > 0) {
            this.createStatCartouche(section, "❌", this.stats.failed.toString(), t('import_completion.stats.failed'), "var(--color-red)");
        }
    }

    private createStatCartouche(
        container: HTMLElement,
        icon: string,
        value: string,
        label: string,
        color?: string
    ) {
        const cartouche = container.createDiv('stat-cartouche');
        cartouche.style.textAlign = "center";
        cartouche.style.padding = "12px";
        cartouche.style.backgroundColor = "var(--background-primary)";
        cartouche.style.borderRadius = "8px";
        cartouche.style.boxShadow = "0 2px 4px rgba(0, 0, 0, 0.1)";

        const iconEl = cartouche.createDiv();
        iconEl.textContent = icon;
        iconEl.style.fontSize = "1.5em";
        iconEl.style.marginBottom = "4px";

        const valueEl = cartouche.createDiv();
        valueEl.textContent = value;
        valueEl.style.fontWeight = "600";
        valueEl.style.fontSize = "1.4em";
        valueEl.style.color = color || "var(--text-accent)";
        valueEl.style.marginBottom = "4px";

        const labelEl = cartouche.createDiv();
        labelEl.textContent = label;
        labelEl.style.fontSize = "0.85em";
        labelEl.style.color = "var(--text-muted)";
    }

    private createAttachmentsSection(container: HTMLElement) {
        const section = container.createDiv('attachments-section');
        section.style.marginBottom = "20px";
        section.style.padding = "12px";
        section.style.backgroundColor = "var(--background-secondary)";
        section.style.borderRadius = "6px";
        section.style.textAlign = "center";

        const percentage = Math.round((this.stats.attachmentsFound / this.stats.attachmentsTotal) * 100);
        
        const icon = percentage === 100 ? "✅" : percentage > 50 ? "⚠️" : "❌";
        const color = percentage === 100 ? "var(--color-green)" : percentage > 50 ? "var(--color-orange)" : "var(--color-red)";

        const attachmentText = section.createDiv();
        attachmentText.innerHTML = `${icon} <strong>${t('import_completion.attachments.label')}</strong> ${t('import_completion.attachments.summary', { found: String(this.stats.attachmentsFound), total: String(this.stats.attachmentsTotal), percentage: String(percentage) })}`;
        attachmentText.style.color = color;

        if (this.stats.attachmentsMissing > 0 || this.stats.attachmentsFailed > 0) {
            const details = section.createDiv();
            details.style.fontSize = "0.85em";
            details.style.color = "var(--text-muted)";
            details.style.marginTop = "4px";
            details.textContent = t('import_completion.attachments.missing_failed', { missing: String(this.stats.attachmentsMissing), failed: String(this.stats.attachmentsFailed) });
        }
    }

    private createReportSection(container: HTMLElement) {
        const section = container.createDiv('report-section');
        section.style.marginBottom = "20px";
        section.style.padding = "12px";
        section.style.backgroundColor = "var(--background-secondary)";
        section.style.borderRadius = "6px";

        const label = section.createDiv();
        label.textContent = t('import_completion.report.label');
        label.style.fontSize = "0.9em";
        label.style.color = "var(--text-muted)";
        label.style.marginBottom = "6px";

        const link = section.createEl("a");
        link.textContent = this.reportFilePath;
        link.style.color = "var(--text-accent)";
        link.style.textDecoration = "none";
        link.style.cursor = "pointer";
        link.addEventListener('click', (e) => {
            e.preventDefault();
            this.openReport();
        });
        link.addEventListener('mouseenter', () => {
            link.style.textDecoration = "underline";
        });
        link.addEventListener('mouseleave', () => {
            link.style.textDecoration = "none";
        });
    }



    private createActionButtons(container: HTMLElement) {
        const buttonContainer = container.createDiv('action-buttons');
        buttonContainer.style.display = "flex";
        buttonContainer.style.justifyContent = "flex-end";
        buttonContainer.style.gap = "10px";
        buttonContainer.style.marginTop = "20px";

        // View Report button
        const viewReportBtn = buttonContainer.createEl("button", { text: t('import_completion.buttons.view_report') });
        viewReportBtn.style.padding = "8px 16px";
        viewReportBtn.addEventListener('click', () => {
            this.openReport();
            this.close();
        });

        // OK button
        const okBtn = buttonContainer.createEl("button", { text: t('import_completion.buttons.ok') });
        okBtn.classList.add('mod-cta');
        okBtn.style.padding = "8px 16px";
        okBtn.addEventListener('click', () => this.close());
    }

    private async openReport() {
        try {
            const file = this.app.vault.getAbstractFileByPath(this.reportFilePath);
            if (file) {
                await this.app.workspace.getLeaf(false).openFile(file as any);
            }
        } catch (error) {
            logger.error("Failed to open report:", error);
        }
    }

    private addCustomStyles() {
        const style = document.createElement('style');
        style.textContent = `
            /* Modal sizing */
            .modal.nexus-import-completion-dialog {
                max-width: min(700px, 90vw) !important;
                width: min(700px, 90vw) !important;
            }

            /* Modal title spacing */
            .modal.nexus-import-completion-dialog .modal-title {
                padding: 16px 24px !important;
                margin: 0 !important;
            }

            .modal.nexus-import-completion-dialog .modal-content {
                padding: 20px 24px 24px 24px;
            }

            /* Stat cartouches hover effect */
            .nexus-import-completion-dialog .stat-cartouche {
                transition: transform 0.2s, box-shadow 0.2s;
            }

            .nexus-import-completion-dialog .stat-cartouche:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
            }

            /* Button hover effects */
            .nexus-import-completion-dialog button {
                cursor: pointer;
                transition: all 0.2s ease;
            }

            .nexus-import-completion-dialog button:hover {
                transform: translateY(-1px);
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            }
        `;
        document.head.appendChild(style);
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

