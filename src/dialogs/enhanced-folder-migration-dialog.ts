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


// src/dialogs/enhanced-folder-migration-dialog.ts
import { Modal, Notice, TFolder } from "obsidian";
import type NexusAiChatImporterPlugin from "../main";

/**
 * Enhanced dialog for folder migration with link update capabilities
 */
export class EnhancedFolderMigrationDialog extends Modal {
    private plugin: NexusAiChatImporterPlugin;
    private onComplete: (action: 'move' | 'keep' | 'cancel') => Promise<void>;
    private oldPath: string;
    private newPath: string;
    private folderType: string;
    private estimatedTime: number = 0;
    private fileCount: number = 0;

    constructor(
        plugin: NexusAiChatImporterPlugin,
        oldPath: string,
        newPath: string,
        folderType: string,
        onComplete: (action: 'move' | 'keep' | 'cancel') => Promise<void>
    ) {
        super(plugin.app);
        this.plugin = plugin;
        this.oldPath = oldPath;
        this.newPath = newPath;
        this.folderType = folderType;
        this.onComplete = onComplete;
    }

    async onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        // Get estimates for link updates
        await this.loadEstimates();

        // Title
        contentEl.createEl("h2", { 
            text: "Move Existing Files?",
            cls: "nexus-migration-title"
        });

        // Message
        const messageContainer = contentEl.createDiv({ cls: "nexus-migration-message" });
        
        messageContainer.createEl("p", { 
            text: `You are changing the ${this.folderType} folder location:` 
        });

        const pathContainer = messageContainer.createDiv({ cls: "nexus-migration-paths" });
        pathContainer.createEl("div", { 
            text: `From: ${this.oldPath}`,
            cls: "nexus-migration-path-old"
        });
        pathContainer.createEl("div", { 
            text: `To: ${this.newPath}`,
            cls: "nexus-migration-path-new"
        });

        messageContainer.createEl("p", { 
            text: "Do you want to move existing files to the new location?" 
        });

        // Link update information (only for attachment and conversation folders)
        if (this.shouldShowLinkUpdateInfo()) {
            this.createLinkUpdateInfo(contentEl);
        }

        // Warning box
        const warningBox = contentEl.createDiv({ cls: "nexus-migration-warning" });
        warningBox.createEl("strong", { text: "⚠️ Important:" });
        warningBox.createEl("p", { 
            text: "If you choose 'No', existing files will remain in the old location and will not be impacted by future updates." 
        });

        // Buttons (3 options: Cancel, Keep, Move)
        this.createButtons(contentEl);

        // Add styles
        this.addStyles();
    }

    private async loadEstimates(): Promise<void> {
        try {
            // Lazy import LinkUpdateService
            const { LinkUpdateService } = await import("../services/link-update-service");
            const linkUpdateService = new LinkUpdateService(this.plugin);

            if (this.folderType === 'attachments') {
                const estimate = await linkUpdateService.estimateUpdateTime('attachments');
                this.fileCount = estimate.fileCount;
                this.estimatedTime = estimate.estimatedSeconds;
            } else if (this.folderType === 'conversations') {
                const estimate = await linkUpdateService.estimateUpdateTime('conversations');
                this.fileCount = estimate.fileCount;
                this.estimatedTime = estimate.estimatedSeconds;
            }
        } catch (error) {
            this.plugin.logger.warn("Failed to load link update estimates:", error);
        }
    }

    private shouldShowLinkUpdateInfo(): boolean {
        return this.folderType === 'attachments' || this.folderType === 'conversations';
    }

    private createLinkUpdateInfo(contentEl: HTMLElement): void {
        const linkUpdateBox = contentEl.createDiv({ cls: "nexus-link-update-info" });
        linkUpdateBox.createEl("strong", { text: "🔗 Link Updates:" });
        
        const infoText = linkUpdateBox.createDiv();
        
        if (this.folderType === 'attachments') {
            infoText.createEl("p", {
                text: `Moving attachments will also update ${this.fileCount} conversation files to fix attachment links.`
            });
        } else if (this.folderType === 'conversations') {
            infoText.createEl("p", {
                text: `Moving conversations will also update ${this.fileCount} files (reports and attachments) to fix conversation links.`
            });
        }

        if (this.estimatedTime > 0) {
            const timeText = this.estimatedTime < 60 
                ? `~${this.estimatedTime} seconds`
                : `~${Math.ceil(this.estimatedTime / 60)} minute(s)`;
            
            infoText.createEl("p", {
                text: `Estimated time: ${timeText}`,
                cls: "nexus-time-estimate"
            });
        }
    }

    private createButtons(contentEl: HTMLElement): void {
        const buttonContainer = contentEl.createDiv({ cls: "nexus-migration-buttons" });

        // Cancel button (left)
        const cancelButton = buttonContainer.createEl("button", {
            text: "Cancel",
            cls: "nexus-migration-button-cancel"
        });
        cancelButton.addEventListener("click", async () => {
            this.close();
            try {
                await this.onComplete('cancel');
                new Notice(`Change cancelled. Folder setting reverted.`);
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                new Notice(`Failed to revert setting: ${errorMessage}`);
            }
        });

        // Keep button (middle)
        const keepButton = buttonContainer.createEl("button", {
            text: "No, keep files in old location",
            cls: "nexus-migration-button-keep"
        });
        keepButton.addEventListener("click", async () => {
            this.close();
            try {
                await this.onComplete('keep');
                new Notice(`Folder setting updated. Files remain in ${this.oldPath}`);
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                new Notice(`Failed to update setting: ${errorMessage}`);
            }
        });

        // Move button (right, primary action)
        const moveButton = buttonContainer.createEl("button", {
            text: this.shouldShowLinkUpdateInfo() ? "Yes, move files and update links" : "Yes, move files",
            cls: "mod-cta nexus-migration-button-move"
        });
        moveButton.addEventListener("click", async () => {
            this.close();
            
            if (this.shouldShowLinkUpdateInfo()) {
                await this.handleMoveWithLinkUpdates();
            } else {
                try {
                    await this.onComplete('move');
                    new Notice(`Files moved to ${this.newPath}`);
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    new Notice(`Failed to move files: ${errorMessage}`);
                }
            }
        });
    }

    private async handleMoveWithLinkUpdates(): Promise<void> {
        let progressModal: any = null;
        try {
            // Lazy import dependencies
            const [{ UpgradeProgressModal }, { LinkUpdateService }, { moveAndMergeFolders }] = await Promise.all([
                import("../upgrade/utils/progress-modal"),
                import("../services/link-update-service"),
                import("../utils")
            ]);

            // Show progress modal for the operation
            progressModal = new UpgradeProgressModal(
                this.app,
                `Moving ${this.folderType} and updating links`,
                100
            );
            progressModal.open();

            // Step 1: Move the files (0-30%)
            progressModal.updateProgress({
                title: "Moving files...",
                detail: `Moving from ${this.oldPath} to ${this.newPath}`,
                progress: 5
            });

            // Get the old folder
            const oldFolder = this.app.vault.getAbstractFileByPath(this.oldPath);
            if (!oldFolder || !(oldFolder instanceof TFolder)) {
                throw new Error(`Source folder not found: ${this.oldPath}`);
            }

            // Move files with progress tracking
            const moveResult = await moveAndMergeFolders(
                oldFolder,
                this.newPath,
                this.app.vault,
                (current, total) => {
                    // Map file move progress from 5% to 30%
                    const percentage = 5 + Math.round((current / total) * 25);
                    progressModal.updateProgress({
                        title: "Moving files...",
                        detail: `${current} / ${total} files processed`,
                        progress: percentage
                    });
                }
            );

            progressModal.updateProgress({
                title: "Files moved",
                detail: `${moveResult.moved} files moved, ${moveResult.skipped} skipped. Preparing to update links...`,
                progress: 30
            });

            const linkUpdateService = new LinkUpdateService(this.plugin);
            let stats;

            // Step 2: Update links (30-100%)
            if (this.folderType === 'attachments') {
                stats = await linkUpdateService.updateAttachmentLinks(
                    this.oldPath,
                    this.newPath,
                    (progress) => {
                        // Map link update progress from 30% to 100%
                        const percentage = 30 + Math.round((progress.current / progress.total) * 70);
                        progressModal.updateProgress({
                            title: "Updating attachment links...",
                            detail: progress.detail,
                            progress: percentage
                        });
                    }
                );
            } else if (this.folderType === 'conversations') {
                stats = await linkUpdateService.updateConversationLinks(
                    this.oldPath,
                    this.newPath,
                    (progress) => {
                        // Map link update progress from 30% to 100%
                        const percentage = 30 + Math.round((progress.current / progress.total) * 70);

                        // Provide more detailed progress messages
                        let title = "Updating conversation links...";
                        if (progress.phase === 'updating-conversations') {
                            title = "Updating links in reports...";
                        } else if (progress.phase === 'updating-artifacts') {
                            title = "Updating links in artifacts...";
                        }

                        progressModal.updateProgress({
                            title: title,
                            detail: progress.detail,
                            progress: percentage
                        });
                    }
                );
            }

            // Complete
            const linksUpdated = this.folderType === 'attachments'
                ? stats?.attachmentLinksUpdated || 0
                : stats?.conversationLinksUpdated || 0;

            progressModal.showComplete(
                `${moveResult.moved} files moved. ${linksUpdated} links updated successfully`
            );
            progressModal.closeAfterDelay(3000);

            new Notice(`✅ ${moveResult.moved} files moved to ${this.newPath}. ${linksUpdated} links updated`);

            // Save the setting change
            await this.onComplete('move');

        } catch (error) {
            if (progressModal) {
                progressModal.close();
            }
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.showErrorDialog("Migration Failed", `Failed to move files or update links: ${errorMessage}`);
        }
    }

    private addStyles() {
        const styleEl = document.createElement("style");
        styleEl.textContent = `
            .nexus-migration-title {
                margin-bottom: 1em;
                color: var(--text-normal);
            }

            .nexus-migration-message {
                margin-bottom: 1.5em;
                line-height: 1.6;
            }

            .nexus-migration-paths {
                background-color: var(--background-secondary);
                padding: 1em;
                margin: 1em 0;
                border-radius: 4px;
                font-family: var(--font-monospace);
                font-size: 0.9em;
            }

            .nexus-migration-path-old {
                color: var(--text-muted);
                margin-bottom: 0.5em;
            }

            .nexus-migration-path-new {
                color: var(--interactive-accent);
                font-weight: 500;
            }

            .nexus-link-update-info {
                background-color: var(--background-modifier-success-hover);
                border-left: 4px solid var(--text-success);
                padding: 1em;
                margin-bottom: 1em;
                border-radius: 4px;
            }

            .nexus-link-update-info strong {
                display: block;
                margin-bottom: 0.5em;
                color: var(--text-success);
            }

            .nexus-link-update-info p {
                margin: 0.3em 0;
                color: var(--text-normal);
            }

            .nexus-time-estimate {
                font-style: italic;
                color: var(--text-muted) !important;
                font-size: 0.9em;
            }

            .nexus-migration-warning {
                background-color: var(--background-modifier-error-hover);
                border-left: 4px solid var(--text-error);
                padding: 1em;
                margin-bottom: 1.5em;
                border-radius: 4px;
            }

            .nexus-migration-warning strong {
                display: block;
                margin-bottom: 0.5em;
                color: var(--text-error);
            }

            .nexus-migration-warning p {
                margin: 0;
                color: var(--text-normal);
            }

            .nexus-migration-buttons {
                display: flex;
                justify-content: space-between;
                gap: 10px;
            }

            .nexus-migration-buttons button {
                padding: 8px 16px;
                flex: 1;
            }

            .nexus-migration-button-cancel {
                background-color: var(--background-modifier-border);
                color: var(--text-muted);
            }

            .nexus-migration-button-keep {
                background-color: var(--background-modifier-border);
            }

            .nexus-migration-button-move {
                /* Uses mod-cta class for primary styling */
            }
        `;
        document.head.appendChild(styleEl);
    }

    private showErrorDialog(title: string, message: string): void {
        const modal = new Modal(this.app);
        modal.titleEl.setText(title);

        modal.contentEl.createEl("p", {
            text: message,
            cls: "nexus-error-message"
        });

        const buttonContainer = modal.contentEl.createDiv({ cls: "modal-button-container" });
        buttonContainer.style.display = "flex";
        buttonContainer.style.justifyContent = "flex-end";
        buttonContainer.style.marginTop = "1em";

        const okButton = buttonContainer.createEl("button", {
            text: "OK",
            cls: "mod-cta"
        });
        okButton.addEventListener("click", () => modal.close());

        modal.open();
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
