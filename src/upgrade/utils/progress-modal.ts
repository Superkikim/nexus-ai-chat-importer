// src/upgrade/utils/progress-modal.ts
import { Modal, App } from "obsidian";

export interface ProgressStep {
    title: string;
    detail?: string;
    progress?: number; // 0-100
}

export class UpgradeProgressModal extends Modal {
    private title: string;
    private totalSteps: number;
    private currentStep: number = 0;
    
    private modalTitleEl: any;
    private stepEl: any;
    private progressBarEl: any;
    private statusEl: any;
    private detailEl: any;

    constructor(app: App, title: string, totalSteps: number = 100) {
        super(app);
        this.title = title;
        this.totalSteps = totalSteps;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.addClass("nexus-ai-chat-importer-modal");

        // Title
        this.modalTitleEl = contentEl.createEl("h2", { 
            text: this.title, 
            cls: "modal-title" 
        });

        const contentContainer = contentEl.createDiv({ cls: "modal-content" });
        
        // Step counter
        this.stepEl = contentContainer.createEl("div", { cls: "step-counter" });
        this.stepEl.style.cssText = `
            text-align: center;
            margin: 10px 0;
            font-weight: 500;
            color: var(--text-normal);
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

        this.progressBarEl = progressContainer.createDiv({ cls: "progress-bar" });
        this.progressBarEl.style.cssText = `
            background: var(--interactive-accent);
            height: 20px;
            border-radius: 4px;
            width: 0%;
            transition: width 0.3s ease;
        `;

        // Current status
        this.statusEl = contentContainer.createEl("div", { cls: "status-text" });
        this.statusEl.style.cssText = `
            text-align: center;
            margin: 15px 0;
            font-weight: 500;
            color: var(--text-normal);
        `;

        // Detail text
        this.detailEl = contentContainer.createEl("div", { cls: "detail-text" });
        this.detailEl.style.cssText = `
            text-align: center;
            color: var(--text-muted);
            font-size: 0.9em;
            min-height: 1.2em;
        `;

        this.updateProgress({ title: "Starting...", progress: 0 });
    }

    /**
     * Update progress with step information
     */
    updateProgress(step: ProgressStep) {
        if (step.progress !== undefined) {
            const percentage = Math.min(100, Math.max(0, step.progress));
            this.progressBarEl.style.width = `${percentage}%`;
            
            this.stepEl.textContent = `Progress: ${Math.round(percentage)}%`;
        } else {
            // Use step-based progress
            this.currentStep++;
            const percentage = Math.round((this.currentStep / this.totalSteps) * 100);
            this.progressBarEl.style.width = `${percentage}%`;
            
            this.stepEl.textContent = `Step ${this.currentStep}/${this.totalSteps}`;
        }

        this.statusEl.textContent = step.title;
        this.detailEl.textContent = step.detail || "";
    }

    /**
     * Update with specific step number
     */
    updateStep(stepNumber: number, step: ProgressStep) {
        this.currentStep = stepNumber;
        const percentage = Math.round((stepNumber / this.totalSteps) * 100);
        
        this.progressBarEl.style.width = `${percentage}%`;
        this.stepEl.textContent = `Step ${stepNumber}/${this.totalSteps}`;
        this.statusEl.textContent = step.title;
        this.detailEl.textContent = step.detail || "";
    }

    /**
     * Show completion state
     */
    showComplete(message: string = "Completed successfully") {
        this.progressBarEl.style.width = "100%";
        this.stepEl.textContent = "Complete";
        this.statusEl.textContent = message;
        this.detailEl.textContent = "";
        
        // Change color to success
        this.progressBarEl.style.background = "var(--text-success)";
    }

    /**
     * Show error state
     */
    showError(message: string = "An error occurred") {
        this.statusEl.textContent = message;
        this.detailEl.textContent = "";
        
        // Change color to error
        this.progressBarEl.style.background = "var(--text-error)";
    }

    /**
     * Close after delay
     */
    closeAfterDelay(delay: number = 2000) {
        setTimeout(() => this.close(), delay);
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

// Export both the interface and the renamed class
export { UpgradeProgressModal as ProgressModal };