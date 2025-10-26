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


// src/dialogs/configure-folder-locations-dialog.ts
import { Modal, Setting, TFolder, Notice } from "obsidian";
import type NexusAiChatImporterPlugin from "../main";
import { FolderMigrationDialog } from "./folder-migration-dialog";
import { EnhancedFolderMigrationDialog } from "./enhanced-folder-migration-dialog";
import { FolderTreeBrowserModal } from "./folder-tree-browser-modal";
import { validateFolderNesting } from "../utils/folder-validation";
import { moveAndMergeFolders, type FolderMergeResult } from "../utils";

export interface FolderConfigurationResult {
    conversationFolder: {
        changed: boolean;
        oldPath: string;
        newPath: string;
        filesMoved?: number;
    };
    reportFolder: {
        changed: boolean;
        oldPath: string;
        newPath: string;
        filesMoved?: number;
    };
    attachmentFolder: {
        changed: boolean;
        oldPath: string;
        newPath: string;
        filesMoved?: number;
    };
}

/**
 * Dialog to configure Report folder location during v1.3.0 upgrade
 * This is a BLOCKING dialog - it waits for user to save before continuing
 */
export class ConfigureFolderLocationsDialog extends Modal {
    private reportFolderInput: HTMLInputElement | null = null;

    private originalReportFolder: string;

    private onComplete: (result: FolderConfigurationResult) => void;
    private completed: boolean = false; // Track if onComplete was already called

    constructor(
        private plugin: NexusAiChatImporterPlugin,
        onComplete: (result: FolderConfigurationResult) => void
    ) {
        super(plugin.app);
        this.onComplete = onComplete;

        // Store original value
        this.originalReportFolder = plugin.settings.reportFolder || "Nexus Reports";
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        // Title
        contentEl.createEl("h2", {
            text: "🎉 Nexus AI Chat Importer v1.3.0",
            cls: "nexus-upgrade-title"
        });

        // Main message - SIMPLIFIED
        const messageContainer = contentEl.createDiv({ cls: "nexus-upgrade-message" });

        messageContainer.createEl("h3", { text: "✨ New: Report Folder Setting" });

        const descriptionEl = messageContainer.createDiv({ cls: "nexus-upgrade-description" });
        descriptionEl.createEl("p", {
            text: `In version 1.3.0, you can specify a folder for Reports. We will move existing reports to ${this.originalReportFolder}, or you can select your preferred folder below.`
        });
        descriptionEl.createEl("p", {
            text: "Note: The folder cannot be inside Conversations or Attachments.",
            cls: "nexus-upgrade-note"
        });

        // Folder inputs section
        const folderSection = contentEl.createDiv({ cls: "nexus-upgrade-folder-section" });

        // Report Folder
        new Setting(folderSection)
            .setName("📊 Report Folder")
            .setDesc("Where import and upgrade reports are stored")
            .addText(text => {
                this.reportFolderInput = text.inputEl;

                text
                    .setPlaceholder("Nexus Reports")
                    .setValue(this.originalReportFolder)
                    .inputEl.addClass("nexus-upgrade-folder-input");

                // Make input read-only - only Browse button can change the value
                text.inputEl.readOnly = true;
                text.inputEl.style.cursor = "default";
            })
            .addButton(button => {
                button
                    .setButtonText("Browse")
                    .setTooltip("Browse folders or create a new one")
                    .onClick(() => {
                        const modal = new FolderTreeBrowserModal(
                            this.plugin.app,
                            (path: string) => {
                                // User selected or created a folder
                                if (this.reportFolderInput) {
                                    this.reportFolderInput.value = path;
                                }
                            },
                            this.originalReportFolder
                        );
                        modal.open();
                    });
            });

        // Buttons - BIG CENTERED PROCEED BUTTON
        const buttonContainer = contentEl.createDiv({ cls: "nexus-upgrade-button-container-centered" });

        const proceedButton = buttonContainer.createEl("button", {
            text: "Proceed",
            cls: "mod-cta nexus-upgrade-proceed-button"
        });
        proceedButton.addEventListener("click", async () => {
            await this.handleSave();
        });

        // Add styles
        this.addStyles();
    }

    private async handleSave() {
        if (this.completed) return; // Prevent double execution

        if (!this.reportFolderInput) {
            this.completed = true;
            this.close();
            this.onComplete({
                conversationFolder: {
                    changed: false,
                    oldPath: this.plugin.settings.conversationFolder,
                    newPath: this.plugin.settings.conversationFolder
                },
                reportFolder: {
                    changed: false,
                    oldPath: this.originalReportFolder,
                    newPath: this.originalReportFolder
                },
                attachmentFolder: {
                    changed: false,
                    oldPath: this.plugin.settings.attachmentFolder,
                    newPath: this.plugin.settings.attachmentFolder
                }
            });
            return;
        }

        const newReportFolder = this.reportFolderInput.value.trim();

        // Validate that report folder is not inside conversations or attachments
        const validation = validateFolderNesting(
            'reportFolder',
            newReportFolder,
            this.plugin.settings.conversationFolder,
            this.originalReportFolder, // Use original to avoid self-check
            this.plugin.settings.attachmentFolder
        );

        if (!validation.valid) {
            this.showErrorDialog("Invalid Folder Location", validation.error);
            return; // Don't close dialog, let user fix the path
        }

        const result: FolderConfigurationResult = {
            conversationFolder: {
                changed: false,
                oldPath: this.plugin.settings.conversationFolder,
                newPath: this.plugin.settings.conversationFolder
            },
            reportFolder: {
                changed: newReportFolder !== this.originalReportFolder,
                oldPath: this.originalReportFolder,
                newPath: newReportFolder
            },
            attachmentFolder: {
                changed: false,
                oldPath: this.plugin.settings.attachmentFolder,
                newPath: this.plugin.settings.attachmentFolder
            }
        };

        // Mark as completed before closing
        this.completed = true;

        // Close this dialog first
        this.close();

        // Handle report folder change
        await this.handleFolderChange('reportFolder', result.reportFolder);

        // Call completion callback with results
        this.onComplete(result);
    }

    private async handleFolderChange(
        folderType: 'conversationFolder' | 'reportFolder' | 'attachmentFolder',
        folderInfo: { changed: boolean; oldPath: string; newPath: string; filesMoved?: number }
    ): Promise<void> {
        if (!folderInfo.changed) {
            return;
        }

        const oldPath = folderInfo.oldPath;
        const newPath = folderInfo.newPath;

        // Update setting first
        this.plugin.settings[folderType] = newPath;
        await this.plugin.saveSettings();

        // Check if old folder exists and has content
        const oldFolder = this.plugin.app.vault.getAbstractFileByPath(oldPath);

        if (!oldFolder || !(oldFolder instanceof TFolder) || oldFolder.children.length === 0) {
            // No migration needed
            return;
        }

        // Show migration dialog and wait for user choice
        // Use Enhanced dialog for ALL folder types (it handles link updates for conversations/attachments, simple move for reports)
        const folderTypeLabel = folderType === 'conversationFolder' ? 'conversations' :
                               folderType === 'reportFolder' ? 'reports' : 'attachments';

        await new Promise<void>((resolve) => {
            const handleMigrationAction = async (action: 'move' | 'keep' | 'cancel') => {
                if (action === 'move') {
                    try {
                        const result = await moveAndMergeFolders(oldFolder, newPath, this.plugin.app.vault);
                        folderInfo.filesMoved = result.moved;

                        // Show result to user
                        if (result.success && result.skipped === 0) {
                            // Perfect success - simple notice
                            new Notice(`✅ Files moved to ${newPath}`);
                        } else {
                            // Some files skipped or errors - show detailed dialog
                            this.showMergeResultDialog(result, oldPath, newPath);
                        }
                    } catch (error) {
                        this.plugin.logger.error(`Failed to move ${folderTypeLabel} folder:`, error);
                        this.showErrorDialog("Migration Failed", `Failed to move files: ${error.message}`);
                    }
                } else if (action === 'cancel') {
                    // Revert setting
                    this.plugin.settings[folderType] = oldPath;
                    await this.plugin.saveSettings();
                }
                resolve();
            };

            // Always use Enhanced dialog (it handles link updates when needed)
            const dialog = new EnhancedFolderMigrationDialog(
                this.plugin,
                oldPath,
                newPath,
                folderTypeLabel,
                handleMigrationAction
            );
            dialog.open();
        });
    }

    /**
     * Show dialog with merge result details when files were skipped or errors occurred
     */
    private showMergeResultDialog(result: FolderMergeResult, oldPath: string, newPath: string): void {
        const modal = new Modal(this.plugin.app);
        modal.titleEl.setText("Folder Migration Result");

        const { contentEl } = modal;

        // Summary
        const summary = contentEl.createDiv({ cls: "nexus-merge-summary" });
        summary.createEl("h3", { text: "Migration Summary" });

        const stats = summary.createDiv({ cls: "nexus-merge-stats" });
        stats.createEl("p", { text: `✅ Successfully moved: ${result.moved} file(s)` });

        if (result.skipped > 0) {
            stats.createEl("p", {
                text: `⚠️ Skipped (already exist): ${result.skipped} file(s)`,
                cls: "nexus-merge-warning"
            });
        }

        if (result.errors > 0) {
            stats.createEl("p", {
                text: `❌ Errors: ${result.errors} file(s)`,
                cls: "nexus-merge-error"
            });
        }

        // Explanation
        const explanation = contentEl.createDiv({ cls: "nexus-merge-explanation" });
        explanation.createEl("p", {
            text: "Files that already existed in the destination were not overwritten to preserve your data."
        });

        // Error details if any
        if (result.errorDetails && result.errorDetails.length > 0) {
            const errorSection = contentEl.createDiv({ cls: "nexus-merge-errors" });
            errorSection.createEl("h4", { text: "Error Details:" });
            const errorList = errorSection.createEl("ul");
            for (const error of result.errorDetails) {
                errorList.createEl("li", { text: error });
            }
        }

        // Close button
        const buttonContainer = contentEl.createDiv({ cls: "modal-button-container" });
        const closeButton = buttonContainer.createEl("button", { text: "OK", cls: "mod-cta" });
        closeButton.addEventListener("click", () => modal.close());

        // Add styles
        const styleEl = document.createElement("style");
        styleEl.textContent = `
            .nexus-merge-summary {
                margin-bottom: 20px;
            }
            .nexus-merge-stats p {
                margin: 8px 0;
                font-size: 14px;
            }
            .nexus-merge-warning {
                color: var(--text-warning);
            }
            .nexus-merge-error {
                color: var(--text-error);
            }
            .nexus-merge-explanation {
                padding: 12px;
                background: var(--background-secondary);
                border-radius: 4px;
                margin: 16px 0;
            }
            .nexus-merge-errors {
                margin-top: 16px;
                padding: 12px;
                background: var(--background-modifier-error);
                border-radius: 4px;
            }
            .nexus-merge-errors ul {
                margin: 8px 0;
                padding-left: 20px;
            }
            .nexus-merge-errors li {
                margin: 4px 0;
                font-size: 12px;
                font-family: var(--font-monospace);
            }
        `;
        document.head.appendChild(styleEl);

        modal.open();
    }

    private addStyles() {
        const styleEl = document.createElement("style");
        styleEl.textContent = `
            .nexus-upgrade-title {
                margin-bottom: 1em;
                color: var(--text-normal);
                text-align: center;
            }

            .nexus-upgrade-message {
                margin-bottom: 1.5em;
                line-height: 1.6;
            }

            .nexus-upgrade-message h3 {
                margin-top: 0.5em;
                margin-bottom: 0.8em;
                color: var(--text-normal);
            }

            .nexus-upgrade-description {
                font-size: 1em;
                line-height: 1.6;
            }

            .nexus-upgrade-description p {
                margin: 0.8em 0;
            }

            .nexus-upgrade-note {
                font-size: 0.95em;
                color: var(--text-muted);
                font-style: italic;
            }

            .nexus-upgrade-folder-section {
                background-color: var(--background-secondary);
                padding: 1.2em;
                margin: 1.5em 0;
                border-radius: 6px;
            }

            .nexus-upgrade-folder-input {
                width: 100% !important;
                min-width: 400px !important;
            }

            .nexus-upgrade-button-container-centered {
                display: flex;
                justify-content: center;
                margin-top: 2em;
            }

            .nexus-upgrade-proceed-button {
                padding: 12px 48px !important;
                font-size: 16px !important;
                font-weight: 600 !important;
                min-width: 200px;
            }
        `;
        document.head.appendChild(styleEl);
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();

        // If dialog is closed without saving (e.g., clicking X), resolve with no changes
        // This prevents the upgrade process from hanging
        if (!this.completed && this.onComplete) {
            this.completed = true;
            this.onComplete({
                conversationFolder: {
                    changed: false,
                    oldPath: this.plugin.settings.conversationFolder,
                    newPath: this.plugin.settings.conversationFolder
                },
                reportFolder: {
                    changed: false,
                    oldPath: this.originalReportFolder,
                    newPath: this.originalReportFolder
                },
                attachmentFolder: {
                    changed: false,
                    oldPath: this.plugin.settings.attachmentFolder,
                    newPath: this.plugin.settings.attachmentFolder
                }
            });
        }
    }

    private showErrorDialog(title: string, message: string): void {
        const modal = new Modal(this.plugin.app);
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
}

