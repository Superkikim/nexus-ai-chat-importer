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
import { Modal, Setting, TFolder } from "obsidian";
import type NexusAiChatImporterPlugin from "../main";
import { FolderMigrationDialog } from "./folder-migration-dialog";
import { EnhancedFolderMigrationDialog } from "./enhanced-folder-migration-dialog";
import { FolderSuggest } from "../ui/folder-suggest";
import { FolderBrowserModal } from "./folder-browser-modal";

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
 * Dialog to configure folder locations during v1.3.0 upgrade
 * This is a BLOCKING dialog - it waits for user to save before continuing
 */
export class ConfigureFolderLocationsDialog extends Modal {
    private conversationFolderInput: HTMLInputElement | null = null;
    private reportFolderInput: HTMLInputElement | null = null;
    private attachmentFolderInput: HTMLInputElement | null = null;
    
    private originalConversationFolder: string;
    private originalReportFolder: string;
    private originalAttachmentFolder: string;
    
    private onComplete: (result: FolderConfigurationResult) => void;

    constructor(
        private plugin: NexusAiChatImporterPlugin,
        onComplete: (result: FolderConfigurationResult) => void
    ) {
        super(plugin.app);
        this.onComplete = onComplete;
        
        // Store original values
        this.originalConversationFolder = plugin.settings.conversationFolder || "Nexus/Conversations";
        this.originalReportFolder = plugin.settings.reportFolder || "Nexus Reports";
        this.originalAttachmentFolder = plugin.settings.attachmentFolder || "Nexus/Attachments";
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        // Title
        contentEl.createEl("h2", {
            text: "🎉 Nexus AI Chat Importer v1.3.0",
            cls: "nexus-upgrade-title"
        });

        // Main message
        const messageContainer = contentEl.createDiv({ cls: "nexus-upgrade-message" });

        messageContainer.createEl("h3", { text: "✨ New: Configurable Folder Locations" });

        messageContainer.createEl("p", {
            text: "You can now configure separate folder locations for conversations, reports, and attachments."
        });

        // Folder inputs section
        const folderSection = contentEl.createDiv({ cls: "nexus-upgrade-folder-section" });

        // Conversation Folder
        new Setting(folderSection)
            .setName("📁 Conversation Folder")
            .setDesc("Where imported conversations are stored")
            .addText(text => {
                this.conversationFolderInput = text.inputEl;
                text
                    .setPlaceholder("Nexus/Conversations")
                    .setValue(this.originalConversationFolder)
                    .inputEl.addClass("nexus-upgrade-folder-input");
            });

        // Report Folder
        new Setting(folderSection)
            .setName("📊 Report Folder")
            .setDesc("Where import reports are stored")
            .addText(text => {
                this.reportFolderInput = text.inputEl;

                // Add folder autocomplete
                new FolderSuggest(this.plugin.app, text.inputEl);

                text
                    .setPlaceholder("Nexus Reports")
                    .setValue(this.originalReportFolder)
                    .inputEl.addClass("nexus-upgrade-folder-input");
            })
            .addButton(button => {
                button
                    .setButtonText("Browse")
                    .setTooltip("Browse folders or create a new one")
                    .onClick(() => {
                        const modal = new FolderBrowserModal(
                            this.plugin.app,
                            (folder) => {
                                // User selected an existing folder
                                if (this.reportFolderInput) {
                                    this.reportFolderInput.value = folder.path;
                                }
                            },
                            (path) => {
                                // User created a new folder
                                if (this.reportFolderInput) {
                                    this.reportFolderInput.value = path;
                                }
                            }
                        );
                        modal.open();
                    });
            });

        // Attachment Folder
        new Setting(folderSection)
            .setName("📎 Attachment Folder")
            .setDesc("Where attachments are stored (⚠️ Exclude from sync to save space)")
            .addText(text => {
                this.attachmentFolderInput = text.inputEl;
                text
                    .setPlaceholder("Nexus/Attachments")
                    .setValue(this.originalAttachmentFolder)
                    .inputEl.addClass("nexus-upgrade-folder-input");
            });

        messageContainer.createEl("p", {
            text: "All folder locations can be changed at any time in the plugin settings.",
            cls: "nexus-upgrade-hint"
        });

        // Info box
        const infoBox = contentEl.createDiv({ cls: "nexus-upgrade-info" });
        infoBox.createEl("strong", { text: "ℹ️ Folder Migration:" });

        const infoText = infoBox.createDiv();
        infoText.createEl("p", {
            text: "When you change a folder path, you will be asked if you want to move existing files automatically."
        });
        infoText.createEl("p", {
            text: "If you choose to keep files in the old location, they will not be impacted by future updates."
        });

        // Buttons
        const buttonContainer = contentEl.createDiv({ cls: "nexus-upgrade-button-container" });

        const saveButton = buttonContainer.createEl("button", {
            text: "Save & Continue",
            cls: "mod-cta"
        });
        saveButton.addEventListener("click", async () => {
            await this.handleSave();
        });

        // Add styles
        this.addStyles();
    }

    private async handleSave() {
        if (!this.conversationFolderInput || !this.reportFolderInput || !this.attachmentFolderInput) {
            this.close();
            this.onComplete({
                conversationFolder: { changed: false, oldPath: this.originalConversationFolder, newPath: this.originalConversationFolder },
                reportFolder: { changed: false, oldPath: this.originalReportFolder, newPath: this.originalReportFolder },
                attachmentFolder: { changed: false, oldPath: this.originalAttachmentFolder, newPath: this.originalAttachmentFolder }
            });
            return;
        }

        const newConversationFolder = this.conversationFolderInput.value.trim();
        const newReportFolder = this.reportFolderInput.value.trim();
        const newAttachmentFolder = this.attachmentFolderInput.value.trim();

        const result: FolderConfigurationResult = {
            conversationFolder: {
                changed: newConversationFolder !== this.originalConversationFolder,
                oldPath: this.originalConversationFolder,
                newPath: newConversationFolder
            },
            reportFolder: {
                changed: newReportFolder !== this.originalReportFolder,
                oldPath: this.originalReportFolder,
                newPath: newReportFolder
            },
            attachmentFolder: {
                changed: newAttachmentFolder !== this.originalAttachmentFolder,
                oldPath: this.originalAttachmentFolder,
                newPath: newAttachmentFolder
            }
        };

        // Close this dialog first
        this.close();

        // Handle each folder change sequentially
        await this.handleFolderChange('conversationFolder', result.conversationFolder);
        await this.handleFolderChange('reportFolder', result.reportFolder);
        await this.handleFolderChange('attachmentFolder', result.attachmentFolder);

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
                        await this.plugin.app.vault.rename(oldFolder, newPath);
                        folderInfo.filesMoved = oldFolder.children.length;
                    } catch (error) {
                        this.plugin.logger.error(`Failed to move ${folderTypeLabel} folder:`, error);
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

    private addStyles() {
        const styleEl = document.createElement("style");
        styleEl.textContent = `
            .nexus-upgrade-title {
                margin-bottom: 1em;
                color: var(--text-normal);
            }

            .nexus-upgrade-message {
                margin-bottom: 1.5em;
                line-height: 1.6;
            }

            .nexus-upgrade-message h3 {
                margin-top: 0.5em;
                margin-bottom: 0.5em;
                color: var(--text-normal);
            }

            .nexus-upgrade-hint {
                font-size: 0.9em;
                color: var(--text-muted);
                margin-top: 0.5em;
            }

            .nexus-upgrade-folder-section {
                background-color: var(--background-secondary);
                padding: 1em;
                margin: 1em 0;
                border-radius: 4px;
            }

            .nexus-upgrade-folder-input {
                width: 100%;
            }

            .nexus-upgrade-info {
                background-color: var(--background-secondary);
                border-left: 4px solid var(--interactive-accent);
                padding: 1em;
                margin-bottom: 1.5em;
                border-radius: 4px;
            }

            .nexus-upgrade-info strong {
                display: block;
                margin-bottom: 0.5em;
                color: var(--interactive-accent);
            }

            .nexus-upgrade-info p {
                margin: 0.3em 0;
                color: var(--text-normal);
            }

            .nexus-upgrade-button-container {
                display: flex;
                justify-content: flex-end;
                gap: 10px;
            }

            .nexus-upgrade-button-container button {
                padding: 8px 16px;
            }
        `;
        document.head.appendChild(styleEl);
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

