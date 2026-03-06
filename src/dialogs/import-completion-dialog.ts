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
import { createSupportBox } from "../ui/components/support-box";
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

        // Support section (using reusable component)
        createSupportBox(contentEl);

        // Action buttons
        this.createActionButtons(contentEl);

        // Add custom styles
        this.addCustomStyles();
    }

    private createStatsSection(container: HTMLElement) {
        const section = container.createDiv('stats-section nexus-stats-grid nexus-dialog-section');

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
        cartouche.addClass('nexus-stat-card');

        const iconEl = cartouche.createDiv({ cls: 'nexus-stat-card-icon' });
        iconEl.textContent = icon;

        const valueEl = cartouche.createDiv({ cls: 'nexus-stat-card-value' });
        valueEl.textContent = value;
        valueEl.style.color = color || "var(--text-accent)";

        const labelEl = cartouche.createDiv({ cls: 'nexus-stat-card-label' });
        labelEl.textContent = label;
    }

    private createAttachmentsSection(container: HTMLElement) {
        const section = container.createDiv('attachments-section nexus-dialog-section nexus-completion-panel nexus-completion-panel-center');

        const percentage = Math.round((this.stats.attachmentsFound / this.stats.attachmentsTotal) * 100);
        
        const icon = percentage === 100 ? "✅" : percentage > 50 ? "⚠️" : "❌";
        const color = percentage === 100 ? "var(--color-green)" : percentage > 50 ? "var(--color-orange)" : "var(--color-red)";

        const attachmentText = section.createDiv();
        attachmentText.innerHTML = `${icon} <strong>${t('import_completion.attachments.label')}</strong> ${t('import_completion.attachments.summary', { found: String(this.stats.attachmentsFound), total: String(this.stats.attachmentsTotal), percentage: String(percentage) })}`;
        attachmentText.style.color = color;

        if (this.stats.attachmentsMissing > 0 || this.stats.attachmentsFailed > 0) {
            const details = section.createDiv();
            details.addClass('nexus-completion-panel-detail');
            details.textContent = t('import_completion.attachments.missing_failed', { missing: String(this.stats.attachmentsMissing), failed: String(this.stats.attachmentsFailed) });
        }
    }

    private createReportSection(container: HTMLElement) {
        const section = container.createDiv('report-section nexus-dialog-section nexus-completion-panel');

        const label = section.createDiv({ cls: 'nexus-completion-panel-label' });
        label.textContent = t('import_completion.report.label');

        const link = section.createEl("a", { cls: 'nexus-completion-link' });
        link.textContent = this.reportFilePath;
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
        const buttonContainer = container.createDiv('action-buttons nexus-dialog-actions');

        // View Report button
        const viewReportBtn = buttonContainer.createEl("button", { text: t('import_completion.buttons.view_report') });
        viewReportBtn.addEventListener('click', () => {
            this.openReport();
            this.close();
        });

        // OK button
        const okBtn = buttonContainer.createEl("button", { text: t('import_completion.buttons.ok') });
        okBtn.classList.add('mod-cta');
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

            .nexus-import-completion-dialog .nexus-stats-grid {
                display: grid;
                grid-template-columns: repeat(3, minmax(0, 1fr));
                gap: 12px;
            }

            .nexus-import-completion-dialog .nexus-stat-card {
                text-align: center;
                padding: 12px;
                background-color: var(--background-primary);
                border-radius: 8px;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            }

            .nexus-import-completion-dialog .nexus-stat-card-icon {
                font-size: 1.5em;
                margin-bottom: 4px;
            }

            .nexus-import-completion-dialog .nexus-stat-card-value {
                font-weight: 600;
                font-size: 1.4em;
                margin-bottom: 4px;
            }

            .nexus-import-completion-dialog .nexus-stat-card-label {
                font-size: 0.85em;
                color: var(--text-muted);
            }

            .nexus-import-completion-dialog .nexus-completion-panel {
                padding: 12px;
                background-color: var(--background-secondary);
                border-radius: 6px;
            }

            .nexus-import-completion-dialog .nexus-completion-panel-center {
                text-align: center;
            }

            .nexus-import-completion-dialog .nexus-completion-panel-label {
                font-size: 0.9em;
                color: var(--text-muted);
                margin-bottom: 6px;
            }

            .nexus-import-completion-dialog .nexus-completion-panel-detail {
                font-size: 0.85em;
                color: var(--text-muted);
                margin-top: 4px;
            }

            .nexus-import-completion-dialog .nexus-completion-link {
                color: var(--text-accent);
                text-decoration: none;
                cursor: pointer;
                word-break: break-word;
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

            @media (max-width: 700px) {
                .modal.nexus-import-completion-dialog .modal-content {
                    padding: 14px 14px 18px 14px;
                }

                .nexus-import-completion-dialog .nexus-stats-grid {
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                }
            }

            @media (max-width: 480px) {
                .nexus-import-completion-dialog .nexus-stats-grid {
                    grid-template-columns: 1fr;
                }
            }
        `;
        document.head.appendChild(style);
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
