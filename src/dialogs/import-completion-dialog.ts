// src/dialogs/import-completion-dialog.ts
import { App, Modal } from "obsidian";

export interface ImportCompletionStats {
    totalFiles: number;
    totalConversations: number;
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
        titleEl.setText("Import Completed");

        // Success message
        const successMsg = contentEl.createDiv('success-message');
        successMsg.style.textAlign = "center";
        successMsg.style.marginBottom = "20px";
        successMsg.style.fontSize = "1.1em";
        successMsg.style.color = "var(--color-green)";
        successMsg.innerHTML = "✅ Successfully imported conversations";

        // Statistics section with cartouches
        this.createStatsSection(contentEl);

        // Attachments summary (if any)
        if (this.stats.attachmentsTotal > 0) {
            this.createAttachmentsSection(contentEl);
        }

        // Report link section
        this.createReportSection(contentEl);

        // Ko-fi support section (subtle but visible)
        this.createKofiSection(contentEl);

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
        this.createStatCartouche(section, "📁", this.stats.totalFiles.toString(), "Files with New/Updated Content");

        // Total conversations cartouche
        this.createStatCartouche(section, "💬", this.stats.totalConversations.toString(), "Total Conversations");

        // Created cartouche
        this.createStatCartouche(section, "✨", this.stats.created.toString(), "New", "var(--color-green)");

        // Updated cartouche
        this.createStatCartouche(section, "🔄", this.stats.updated.toString(), "Updated", "var(--color-orange)");

        // Skipped cartouche
        this.createStatCartouche(section, "⏭️", this.stats.skipped.toString(), "Skipped", "var(--text-muted)");

        // Failed cartouche (only if > 0)
        if (this.stats.failed > 0) {
            this.createStatCartouche(section, "❌", this.stats.failed.toString(), "Failed", "var(--color-red)");
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
        attachmentText.innerHTML = `${icon} <strong>Attachments:</strong> ${this.stats.attachmentsFound}/${this.stats.attachmentsTotal} extracted (${percentage}%)`;
        attachmentText.style.color = color;

        if (this.stats.attachmentsMissing > 0 || this.stats.attachmentsFailed > 0) {
            const details = section.createDiv();
            details.style.fontSize = "0.85em";
            details.style.color = "var(--text-muted)";
            details.style.marginTop = "4px";
            details.textContent = `${this.stats.attachmentsMissing} missing, ${this.stats.attachmentsFailed} failed`;
        }
    }

    private createReportSection(container: HTMLElement) {
        const section = container.createDiv('report-section');
        section.style.marginBottom = "20px";
        section.style.padding = "12px";
        section.style.backgroundColor = "var(--background-secondary)";
        section.style.borderRadius = "6px";

        const label = section.createDiv();
        label.textContent = "📄 Detailed report:";
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

    private createKofiSection(container: HTMLElement) {
        const section = container.createDiv('kofi-section');
        section.style.marginBottom = "20px";
        section.style.padding = "16px";
        section.style.background = "linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)";
        section.style.borderRadius = "8px";
        section.style.border = "1px solid rgba(102, 126, 234, 0.3)";
        section.style.textAlign = "center";

        const message = section.createDiv();
        message.innerHTML = `
            <div style="margin-bottom: 12px; font-size: 0.95em;">
                ☕ <strong>Enjoying this plugin?</strong> Support its development!
            </div>
        `;

        const buttonContainer = section.createDiv();
        buttonContainer.style.display = "flex";
        buttonContainer.style.justifyContent = "center";
        buttonContainer.style.alignItems = "center";
        buttonContainer.style.gap = "12px";

        const kofiLink = buttonContainer.createEl("a");
        kofiLink.href = "https://ko-fi.com/nexusplugins";
        kofiLink.target = "_blank";
        kofiLink.style.display = "inline-block";
        kofiLink.style.transition = "transform 0.2s ease";
        kofiLink.innerHTML = `<img src="https://storage.ko-fi.com/cdn/kofi6.png?v=6" alt="Buy Me a Coffee" height="36" style="border-radius: 4px;">`;
        kofiLink.addEventListener('mouseenter', () => {
            kofiLink.style.transform = "scale(1.05)";
        });
        kofiLink.addEventListener('mouseleave', () => {
            kofiLink.style.transform = "scale(1)";
        });

        const amounts = section.createDiv();
        amounts.style.marginTop = "10px";
        amounts.style.fontSize = "0.8em";
        amounts.style.color = "var(--text-muted)";
        amounts.innerHTML = `<em>$5 ☕ • $25 🤖 • $75 🚀</em>`;
    }

    private createActionButtons(container: HTMLElement) {
        const buttonContainer = container.createDiv('action-buttons');
        buttonContainer.style.display = "flex";
        buttonContainer.style.justifyContent = "flex-end";
        buttonContainer.style.gap = "10px";
        buttonContainer.style.marginTop = "20px";

        // View Report button
        const viewReportBtn = buttonContainer.createEl("button", { text: "View Report" });
        viewReportBtn.style.padding = "8px 16px";
        viewReportBtn.addEventListener('click', () => {
            this.openReport();
            this.close();
        });

        // OK button
        const okBtn = buttonContainer.createEl("button", { text: "OK" });
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
            console.error("Failed to open report:", error);
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

