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


// src/upgrade/utils/multi-operation-progress-modal.ts
import { Modal, App } from "obsidian";
import { t } from '../../i18n';

export interface OperationStatus {
    id: string;
    name: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    progress?: number; // 0-100
    currentDetail?: string; // Current file being processed, etc.
    error?: string; // Error message if failed
}

export class MultiOperationProgressModal extends Modal {
    private title: string;
    private operations: OperationStatus[];
    private canClose: boolean = false;
    
    private modalTitleEl!: HTMLElement;
    private operationsContainer!: HTMLElement;
    private overallProgressEl!: HTMLElement;
    private closeButtonEl?: HTMLElement;

    constructor(app: App, title: string, operations: OperationStatus[]) {
        super(app);
        this.title = title;
        this.operations = [...operations]; // Copy array
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.addClass("nexus-ai-chat-importer-modal");
        contentEl.addClass("multi-operation-progress-modal");

        // Title
        this.modalTitleEl = contentEl.createEl("h2", { 
            text: this.title, 
            cls: "modal-title" 
        });

        const contentContainer = contentEl.createDiv({ cls: "modal-content" });
        
        // Operations container
        this.operationsContainer = contentContainer.createDiv({ cls: "operations-container" });
        this.operationsContainer.style.cssText = `
            margin: 20px 0;
            max-height: 300px;
            overflow-y: auto;
        `;

        // Overall progress
        this.overallProgressEl = contentContainer.createDiv({ cls: "overall-progress" });
        this.overallProgressEl.style.cssText = `
            margin-top: 20px;
            padding: 15px;
            background: var(--background-secondary);
            border-radius: 8px;
            border: 1px solid var(--background-modifier-border);
            text-align: center;
            font-weight: 500;
        `;

        // Initial render
        this.renderOperations();
        this.updateOverallProgress();

        // Override close behavior
        this.modalEl.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !this.canClose) {
                e.preventDefault();
                e.stopPropagation();
            }
        });
    }

    /**
     * Update operation status
     */
    updateOperation(operationId: string, updates: Partial<OperationStatus>) {
        const operation = this.operations.find(op => op.id === operationId);
        if (operation) {
            Object.assign(operation, updates);
            this.renderOperations();
            this.updateOverallProgress();
        }
    }

    /**
     * Mark all operations as complete and allow closing
     */
    markComplete(message: string = t('upgrade.multi_operation_modal.mark_complete_default')) {
        this.canClose = true;
        this.overallProgressEl.textContent = message;
        this.overallProgressEl.style.color = "var(--text-success)";

        // Add close button
        if (!this.closeButtonEl) {
            const buttonContainer = this.contentEl.createDiv({ cls: "modal-button-container" });
            this.closeButtonEl = buttonContainer.createEl("button", {
                text: t('upgrade.multi_operation_modal.buttons.complete'),
                cls: "mod-cta"
            });
            this.closeButtonEl.addEventListener("click", () => this.close());
        }
    }

    /**
     * Show error state
     */
    showError(message: string) {
        this.canClose = true;
        this.overallProgressEl.textContent = message;
        this.overallProgressEl.style.color = "var(--text-error)";
        
        // Add close button
        if (!this.closeButtonEl) {
            const buttonContainer = this.contentEl.createDiv({ cls: "modal-button-container" });
            this.closeButtonEl = buttonContainer.createEl("button", {
                text: t('upgrade.multi_operation_modal.buttons.close'),
                cls: "mod-warning"
            });
            this.closeButtonEl.addEventListener("click", () => this.close());
        }
    }

    /**
     * Render all operations
     */
    private renderOperations() {
        this.operationsContainer.empty();

        for (const operation of this.operations) {
            const operationEl = this.operationsContainer.createDiv({ cls: "operation-item" });
            operationEl.style.cssText = `
                display: flex;
                align-items: center;
                margin: 10px 0;
                padding: 10px;
                background: var(--background-primary);
                border-radius: 6px;
                border: 1px solid var(--background-modifier-border);
            `;

            // Status icon
            const iconEl = operationEl.createDiv({ cls: "operation-icon" });
            iconEl.style.cssText = `
                width: 20px;
                height: 20px;
                margin-right: 12px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 14px;
            `;

            switch (operation.status) {
                case 'pending':
                    iconEl.textContent = '○';
                    iconEl.style.color = 'var(--text-muted)';
                    break;
                case 'running':
                    iconEl.textContent = '⚠';
                    iconEl.style.color = 'var(--text-accent)';
                    break;
                case 'completed':
                    iconEl.textContent = '✓';
                    iconEl.style.color = 'var(--text-success)';
                    break;
                case 'failed':
                    iconEl.textContent = '✗';
                    iconEl.style.color = 'var(--text-error)';
                    break;
            }

            // Content container
            const contentEl = operationEl.createDiv({ cls: "operation-content" });
            contentEl.style.cssText = `flex: 1; min-width: 0;`;

            // Operation name
            const nameEl = contentEl.createDiv({ cls: "operation-name" });
            nameEl.textContent = operation.name;
            nameEl.style.cssText = `
                font-weight: 500;
                margin-bottom: 5px;
                color: var(--text-normal);
            `;

            // Progress bar (if operation is running or has progress)
            if (operation.status === 'running' || (operation.progress !== undefined && operation.progress > 0)) {
                const progressContainer = contentEl.createDiv({ cls: "progress-container" });
                progressContainer.style.cssText = `
                    background: var(--background-secondary);
                    border-radius: 4px;
                    height: 8px;
                    margin: 5px 0;
                    overflow: hidden;
                `;

                const progressBar = progressContainer.createDiv({ cls: "progress-bar" });
                const progress = operation.progress || 0;
                progressBar.style.cssText = `
                    background: var(--interactive-accent);
                    height: 100%;
                    width: ${progress}%;
                    transition: width 0.3s ease;
                `;
            }

            // Current detail (if provided)
            if (operation.currentDetail) {
                const detailEl = contentEl.createDiv({ cls: "operation-detail" });
                detailEl.textContent = this.truncateDetail(operation.currentDetail);
                detailEl.style.cssText = `
                    font-size: 0.9em;
                    color: var(--text-muted);
                    font-style: italic;
                    margin-top: 3px;
                `;
            }

            // Error message (if failed)
            if (operation.status === 'failed' && operation.error) {
                const errorEl = contentEl.createDiv({ cls: "operation-error" });
                errorEl.textContent = operation.error;
                errorEl.style.cssText = `
                    font-size: 0.9em;
                    color: var(--text-error);
                    margin-top: 3px;
                `;
            }
        }
    }

    /**
     * Update overall progress display
     */
    private updateOverallProgress() {
        const completed = this.operations.filter(op => op.status === 'completed').length;
        const failed = this.operations.filter(op => op.status === 'failed').length;
        const total = this.operations.length;

        if (failed > 0) {
            this.overallProgressEl.textContent = t('upgrade.multi_operation_modal.progress_with_failures', { completed: String(completed), total: String(total), failed: String(failed) });
            this.overallProgressEl.style.color = "var(--text-error)";
        } else if (completed === total) {
            this.overallProgressEl.textContent = t('upgrade.multi_operation_modal.all_completed', { total: String(total) });
            this.overallProgressEl.style.color = "var(--text-success)";
        } else {
            this.overallProgressEl.textContent = t('upgrade.multi_operation_modal.progress_label', { completed: String(completed), total: String(total) });
            this.overallProgressEl.style.color = "var(--text-normal)";
        }
    }

    /**
     * Truncate detail text to fit in modal
     */
    private truncateDetail(detail: string): string {
        const maxLength = 50;
        if (detail.length <= maxLength) return detail;
        return '...' + detail.slice(-maxLength + 3);
    }

    /**
     * Override close to respect canClose flag
     */
    close() {
        if (this.canClose) {
            super.close();
        }
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}