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


// src/ui/import-progress-modal.ts
import { Modal, App } from "obsidian";

export interface ImportProgressStep {
    phase: 'validation' | 'scanning' | 'processing' | 'writing' | 'complete' | 'error';
    title: string;
    detail?: string;
    current?: number;
    total?: number;
    percentage?: number;
}

export interface ImportProgressCallback {
    (step: ImportProgressStep): void;
}

export class ImportProgressModal extends Modal {
    private fileName: string;
    private totalConversations: number = 0;
    private currentConversation: number = 0;
    private isSelectiveImport: boolean = false;
    private selectedCount: number = 0;
    private totalAvailable: number = 0;

    private modalTitleEl: HTMLElement;
    private phaseEl: HTMLElement;
    private progressBarEl: HTMLElement;
    private statusEl: HTMLElement;
    private detailEl: HTMLElement;
    private conversationCountEl: HTMLElement;
    private importModeEl: HTMLElement;
    public isComplete: boolean = false;

    constructor(app: App, fileName: string) {
        super(app);
        this.fileName = fileName;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.addClass("nexus-import-progress-modal");

        // Title
        this.modalTitleEl = contentEl.createEl("h2", { 
            text: `Importing ${this.fileName}`, 
            cls: "modal-title" 
        });

        const contentContainer = contentEl.createDiv({ cls: "modal-content" });
        
        // Phase indicator
        this.phaseEl = contentContainer.createEl("div", { cls: "import-phase" });
        this.phaseEl.style.cssText = `
            text-align: center;
            margin: 10px 0;
            font-weight: 600;
            color: var(--text-accent);
            font-size: 1.1em;
        `;

        // Import mode indicator
        this.importModeEl = contentContainer.createEl("div", { cls: "import-mode" });
        this.importModeEl.style.cssText = `
            text-align: center;
            margin: 5px 0 10px 0;
            font-weight: 500;
            color: var(--text-accent);
            font-size: 0.85em;
            padding: 4px 8px;
            background: var(--background-secondary);
            border-radius: 4px;
            display: none;
        `;

        // Conversation counter
        this.conversationCountEl = contentContainer.createEl("div", { cls: "conversation-counter" });
        this.conversationCountEl.style.cssText = `
            text-align: center;
            margin: 5px 0 15px 0;
            font-weight: 500;
            color: var(--text-normal);
            font-size: 0.9em;
        `;

        // Progress bar container
        const progressContainer = contentContainer.createDiv({ cls: "progress-container" });
        progressContainer.style.cssText = `
            background: var(--background-secondary);
            border-radius: 8px;
            padding: 4px;
            margin: 20px 0;
            border: 1px solid var(--background-modifier-border);
        `;

        // Progress bar
        this.progressBarEl = progressContainer.createDiv({ cls: "progress-bar" });
        this.progressBarEl.style.cssText = `
            height: 20px;
            background: linear-gradient(90deg, var(--interactive-accent), var(--interactive-accent-hover));
            border-radius: 4px;
            width: 0%;
            transition: width 0.3s ease;
            position: relative;
        `;

        // Status text
        this.statusEl = contentContainer.createEl("div", { cls: "status-text" });
        this.statusEl.style.cssText = `
            text-align: center;
            margin: 10px 0;
            font-weight: 500;
            color: var(--text-normal);
        `;

        // Detail text
        this.detailEl = contentContainer.createEl("div", { cls: "detail-text" });
        this.detailEl.style.cssText = `
            text-align: center;
            margin: 5px 0;
            font-size: 0.85em;
            color: var(--text-muted);
            min-height: 1.2em;
        `;

        // Initial state
        this.updateProgress({
            phase: 'validation',
            title: 'Preparing import...',
            detail: 'Validating ZIP file structure'
        });
    }

    /**
     * Update progress with step information
     */
    updateProgress(step: ImportProgressStep) {
        // Update phase
        const phaseLabels = {
            'validation': '🔍 Validation',
            'scanning': '📋 Scanning',
            'processing': '⚙️ Processing',
            'writing': '💾 Writing',
            'complete': '✅ Complete',
            'error': '❌ Error'
        };
        
        this.phaseEl.textContent = phaseLabels[step.phase] || step.phase;

        // Update conversation count if provided
        if (step.total !== undefined) {
            this.totalConversations = step.total;
        }
        if (step.current !== undefined) {
            this.currentConversation = step.current;
        }

        // Update conversation counter display
        if (this.totalConversations > 0) {
            if (this.isSelectiveImport) {
                this.conversationCountEl.textContent = `${this.currentConversation}/${this.totalConversations} selected conversations`;
            } else {
                this.conversationCountEl.textContent = `${this.currentConversation}/${this.totalConversations} conversations`;
            }
        } else {
            this.conversationCountEl.textContent = '';
        }

        // Calculate and update progress bar
        let percentage = 0;
        if (step.percentage !== undefined) {
            percentage = step.percentage;
        } else if (this.totalConversations > 0 && step.phase === 'processing') {
            percentage = Math.round((this.currentConversation / this.totalConversations) * 100);
        } else {
            // Phase-based progress
            const phaseProgress = {
                'validation': 10,
                'scanning': 20,
                'processing': 80,
                'writing': 95,
                'complete': 100,
                'error': 0
            };
            percentage = phaseProgress[step.phase] || 0;
        }

        percentage = Math.min(100, Math.max(0, percentage));
        this.progressBarEl.style.width = `${percentage}%`;

        // Update status and detail
        this.statusEl.textContent = step.title;
        this.detailEl.textContent = step.detail || "";

        // Handle completion
        if (step.phase === 'complete') {
            this.showComplete(step.title);
        } else if (step.phase === 'error') {
            this.showError(step.title);
        }
    }

    /**
     * Show completion state
     */
    showComplete(message: string = "Import completed successfully") {
        this.isComplete = true;
        this.progressBarEl.style.width = "100%";
        this.progressBarEl.style.background = "var(--text-success)";
        this.statusEl.textContent = message;
        this.detailEl.textContent = "You can close this dialog";
        
        // Auto-close after delay
        this.closeAfterDelay(3000);
    }

    /**
     * Show error state
     */
    showError(message: string = "An error occurred during import") {
        this.progressBarEl.style.background = "var(--text-error)";
        this.statusEl.textContent = message;
        this.detailEl.textContent = "Check the console for more details";
    }

    /**
     * Close after delay
     */
    closeAfterDelay(delay: number = 2000) {
        setTimeout(() => {
            if (this.isComplete) {
                this.close();
            }
        }, delay);
    }

    /**
     * Set selective import mode
     */
    setSelectiveImportMode(selectedCount: number, totalAvailable: number) {
        this.isSelectiveImport = true;
        this.selectedCount = selectedCount;
        this.totalAvailable = totalAvailable;

        // Show import mode indicator
        this.importModeEl.style.display = 'block';
        this.importModeEl.textContent = `📋 Selective Import: ${selectedCount} of ${totalAvailable} conversations`;
    }

    /**
     * Get progress callback function
     */
    getProgressCallback(): ImportProgressCallback {
        return (step: ImportProgressStep) => {
            this.updateProgress(step);
        };
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
