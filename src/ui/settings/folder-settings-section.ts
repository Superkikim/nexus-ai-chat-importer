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


// src/ui/settings/folder-settings-section.ts
import { Setting, TFolder, TextComponent, Notice, Modal } from "obsidian";
import { BaseSettingsSection } from "./base-settings-section";
import { FolderMigrationDialog } from "../../dialogs/folder-migration-dialog";
import { FolderSuggest } from "../folder-suggest";
import { FolderBrowserModal } from "../../dialogs/folder-browser-modal";
import { validateFolderNesting } from "../../utils/folder-validation";
import { moveAndMergeFolders, type FolderMergeResult } from "../../utils";

export class FolderSettingsSection extends BaseSettingsSection {
    readonly title = "📁 Folder Structure";
    readonly order = 10;

    render(containerEl: HTMLElement): void {
        // Conversation Folder
        new Setting(containerEl)
            .setName("Conversation folder")
            .setDesc("Where imported conversations are stored")
            .addText((text) => {
                // Add folder autocomplete
                new FolderSuggest(this.plugin.app, text.inputEl);

                text
                    .setPlaceholder("Nexus/Conversations")
                    .setValue(this.plugin.settings.conversationFolder);

                text.inputEl.addClass("nexus-folder-path-input");
                text.inputEl.addClass("nexus-conversation-folder-input"); // Unique class for this input

                // Detect change when user leaves the field (not on every keystroke)
                text.inputEl.addEventListener('blur', async () => {
                    const newValue = text.getValue();
                    await this.handleFolderChange('conversationFolder', newValue, 'conversations', text);
                });
            })
            .addButton((button) => {
                button
                    .setButtonText("Browse")
                    .setTooltip("Browse folders or create a new one")
                    .onClick(() => {
                        const textComponent = containerEl.querySelector('.nexus-conversation-folder-input') as HTMLInputElement;
                        const modal = new FolderBrowserModal(
                            this.plugin.app,
                            (path) => {
                                // User selected or created a folder
                                if (textComponent) {
                                    textComponent.value = path;
                                    textComponent.dispatchEvent(new Event('blur'));
                                }
                            }
                        );
                        modal.open();
                    });
            });

        // Report Folder
        new Setting(containerEl)
            .setName("Reports folder")
            .setDesc("Where import reports are stored")
            .addText((text) => {
                // Add folder autocomplete
                new FolderSuggest(this.plugin.app, text.inputEl);

                text
                    .setPlaceholder("Nexus Reports")
                    .setValue(this.plugin.settings.reportFolder);

                text.inputEl.addClass("nexus-folder-path-input");
                text.inputEl.addClass("nexus-report-folder-input"); // Unique class for this input

                // Detect change when user leaves the field (not on every keystroke)
                text.inputEl.addEventListener('blur', async () => {
                    const newValue = text.getValue();
                    await this.handleFolderChange('reportFolder', newValue, 'reports', text);
                });
            })
            .addButton((button) => {
                button
                    .setButtonText("Browse")
                    .setTooltip("Browse folders or create a new one")
                    .onClick(() => {
                        const textComponent = containerEl.querySelector('.nexus-report-folder-input') as HTMLInputElement;
                        const modal = new FolderBrowserModal(
                            this.plugin.app,
                            (path) => {
                                // User selected or created a folder
                                if (textComponent) {
                                    textComponent.value = path;
                                    textComponent.dispatchEvent(new Event('blur'));
                                }
                            }
                        );
                        modal.open();
                    });
            });

        // Attachment Folder
        new Setting(containerEl)
            .setName("Attachment folder")
            .setDesc("Where attachments are stored (⚠️ Exclude from sync to save space)")
            .addText((text) => {
                // Add folder autocomplete
                new FolderSuggest(this.plugin.app, text.inputEl);

                text
                    .setPlaceholder("Nexus/Attachments")
                    .setValue(this.plugin.settings.attachmentFolder);

                text.inputEl.addClass("nexus-folder-path-input");
                text.inputEl.addClass("nexus-attachment-folder-input"); // Unique class for this input

                // Detect change when user leaves the field (not on every keystroke)
                text.inputEl.addEventListener('blur', async () => {
                    const newValue = text.getValue();
                    await this.handleFolderChange('attachmentFolder', newValue, 'attachments', text);
                });
            })
            .addButton((button) => {
                button
                    .setButtonText("Browse")
                    .setTooltip("Browse folders or create a new one")
                    .onClick(() => {
                        const textComponent = containerEl.querySelector('.nexus-attachment-folder-input') as HTMLInputElement;
                        const modal = new FolderBrowserModal(
                            this.plugin.app,
                            (path) => {
                                // User selected or created a folder
                                if (textComponent) {
                                    textComponent.value = path;
                                    textComponent.dispatchEvent(new Event('blur'));
                                }
                            }
                        );
                        modal.open();
                    });
            });
    }

    private async handleFolderChange(
        settingKey: 'conversationFolder' | 'reportFolder' | 'attachmentFolder',
        newPath: string,
        folderType: string,
        textComponent: TextComponent
    ): Promise<void> {
        this.plugin.logger.debug(`[FolderSettings] Folder change detected: ${settingKey} = "${newPath}"`);

        const oldPath = this.plugin.settings[settingKey];

        // If path hasn't changed, do nothing
        if (oldPath === newPath) {
            this.plugin.logger.debug(`[FolderSettings] Path unchanged, skipping`);
            return;
        }

        this.plugin.logger.debug(`[FolderSettings] Old path: "${oldPath}" → New path: "${newPath}"`);

        // Validate folder nesting
        const validation = validateFolderNesting(
            settingKey,
            newPath,
            this.plugin.settings.conversationFolder,
            this.plugin.settings.reportFolder,
            this.plugin.settings.attachmentFolder
        );

        if (!validation.valid) {
            new Notice(`❌ ${validation.error}`);
            // Restore old value in the text field
            textComponent.setValue(oldPath);
            this.plugin.logger.debug(`[FolderSettings] Validation failed: ${validation.error}`);
            return;
        }

        // Check if old folder exists and has content
        const oldFolder = this.plugin.app.vault.getAbstractFileByPath(oldPath);

        if (!oldFolder || !(oldFolder instanceof TFolder)) {
            this.plugin.logger.debug(`[FolderSettings] Old folder doesn't exist, just updating setting`);
            this.plugin.settings[settingKey] = newPath;
            await this.plugin.saveSettings();
            return;
        }

        const hasContent = oldFolder.children.length > 0;
        this.plugin.logger.debug(`[FolderSettings] Old folder exists, has content: ${hasContent}`);

        if (!hasContent) {
            this.plugin.logger.debug(`[FolderSettings] Old folder is empty, just updating setting`);
            this.plugin.settings[settingKey] = newPath;
            await this.plugin.saveSettings();
            return;
        }

        // Show migration dialog - use enhanced dialog for attachment and conversation folders
        this.plugin.logger.debug(`[FolderSettings] Showing migration dialog`);

        const useEnhancedDialog = settingKey === 'attachmentFolder' || settingKey === 'conversationFolder';

        if (useEnhancedDialog) {
            // Lazy import to avoid loading issues during plugin initialization
            import("../../dialogs/enhanced-folder-migration-dialog").then(({ EnhancedFolderMigrationDialog }) => {
                const dialog = new EnhancedFolderMigrationDialog(
                    this.plugin,
                    oldPath,
                    newPath,
                    folderType,
                    async (action: 'move' | 'keep' | 'cancel') => {
                        await this.handleMigrationAction(action, oldPath, newPath, oldFolder, settingKey, textComponent);
                    }
                );
                dialog.open();
            }).catch(error => {
                this.plugin.logger.error("Failed to load enhanced dialog:", error);
                // Fallback to standard dialog
                const dialog = new FolderMigrationDialog(
                    this.plugin,
                    oldPath,
                    newPath,
                    folderType,
                    async (action: 'move' | 'keep' | 'cancel') => {
                        await this.handleMigrationAction(action, oldPath, newPath, oldFolder, settingKey, textComponent);
                    }
                );
                dialog.open();
            });
        } else {
            const dialog = new FolderMigrationDialog(
                this.plugin,
                oldPath,
                newPath,
                folderType,
                async (action: 'move' | 'keep' | 'cancel') => {
                    await this.handleMigrationAction(action, oldPath, newPath, oldFolder, settingKey, textComponent);
                }
            );
            dialog.open();
        }
    }

    /**
     * Handle migration action (extracted for reuse between dialog types)
     */
    private async handleMigrationAction(
        action: 'move' | 'keep' | 'cancel',
        oldPath: string,
        newPath: string,
        oldFolder: TFolder,
        settingKey: 'conversationFolder' | 'reportFolder' | 'attachmentFolder',
        textComponent: TextComponent
    ): Promise<void> {
        this.plugin.logger.debug(`[FolderSettings] User choice: ${action}`);

        if (action === 'cancel') {
            // Restore old value in the text field
            this.plugin.logger.debug(`[FolderSettings] User cancelled, restoring old value: "${oldPath}"`);
            textComponent.setValue(oldPath);
            return;
        }

        if (action === 'move') {
            // Migrate files using merge function
            this.plugin.logger.debug(`[FolderSettings] Starting migration...`);
            try {
                const result = await moveAndMergeFolders(oldFolder, newPath, this.plugin.app.vault);
                this.plugin.logger.debug(`[FolderSettings] Migration completed: ${result.moved} moved, ${result.skipped} skipped, ${result.errors} errors`);

                // Update links if needed (for conversations and attachments)
                if (settingKey === 'conversationFolder' || settingKey === 'attachmentFolder') {
                    await this.updateLinksAfterMove(settingKey, oldPath, newPath);
                }

                // Show result to user
                if (result.success && result.skipped === 0) {
                    // Perfect success - simple notice
                    new Notice(`✅ Files moved to ${newPath}`);
                } else {
                    // Some files skipped or errors - show detailed dialog
                    this.showMergeResultDialog(result, oldPath, newPath);
                }
            } catch (error: any) {
                this.plugin.logger.error(`[FolderSettings] Migration failed:`, error);
                new Notice(`❌ Failed to move files: ${error.message}`);
                throw error;
            }
        } else {
            // action === 'keep'
            this.plugin.logger.debug(`[FolderSettings] User chose not to migrate, just updating setting`);
        }

        // Update setting (for both 'move' and 'keep')
        this.plugin.settings[settingKey] = newPath;
        await this.plugin.saveSettings();
        this.plugin.logger.debug(`[FolderSettings] Setting updated and saved`);
    }

    /**
     * Update links after moving conversations or attachments
     */
    private async updateLinksAfterMove(
        settingKey: 'conversationFolder' | 'attachmentFolder',
        oldPath: string,
        newPath: string
    ): Promise<void> {
        try {
            // Lazy import LinkUpdateService
            const { LinkUpdateService } = await import("../../services/link-update-service");
            const linkUpdateService = new LinkUpdateService(this.plugin);

            this.plugin.logger.debug(`[FolderSettings] Updating links for ${settingKey}...`);

            if (settingKey === 'conversationFolder') {
                // Update conversation links in reports AND artifacts
                await linkUpdateService.updateConversationLinks(oldPath, newPath);
                this.plugin.logger.debug(`[FolderSettings] Conversation links updated`);
            } else if (settingKey === 'attachmentFolder') {
                // Update attachment links in conversations
                await linkUpdateService.updateAttachmentLinks(oldPath, newPath);
                this.plugin.logger.debug(`[FolderSettings] Attachment links updated`);
            }
        } catch (error) {
            this.plugin.logger.error(`[FolderSettings] Failed to update links:`, error);
            new Notice(`⚠️ Files moved but some links may not have been updated`);
        }
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
}

