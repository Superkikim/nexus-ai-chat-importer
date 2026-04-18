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
import { FolderTreeBrowserModal } from "../../dialogs/folder-tree-browser-modal";
import { validateFolderNesting } from "../../utils/folder-validation";
import { moveAndMergeFolders, type FolderMergeResult } from "../../utils";
import { t } from '../../i18n';

export class FolderSettingsSection extends BaseSettingsSection {
    get title() { return t('settings.folders.section_title'); }
    readonly order = 10;

    render(containerEl: HTMLElement): void {
        // Conversation Folder
        let conversationFolderTextComponent: any;
        new Setting(containerEl)
            .setName(t('settings.folders.conversation_folder.name'))
            .setDesc(t('settings.folders.conversation_folder.desc'))
            .addText((text) => {
                conversationFolderTextComponent = text;

                text
                    .setPlaceholder(t('settings.folders.conversation_folder.placeholder'))
                    .setValue(this.plugin.settings.conversationFolder);

                text.inputEl.addClass("nexus-folder-path-input");
                text.inputEl.addClass("nexus-conversation-folder-input");

                // Make input read-only - only Browse button can change the value
                text.inputEl.readOnly = true;
                text.inputEl.style.cursor = "default";
            })
            .addButton((button) => {
                button
                    .setButtonText(t('common.buttons.browse'))
                    .setTooltip(t('settings.folders.conversation_folder.browse_tooltip'))
                    .onClick(async () => {
                        const modal = new FolderTreeBrowserModal(
                            this.plugin.app,
                            async (path: string) => {
                                // User selected or created a folder - handle the change directly
                                if (conversationFolderTextComponent) {
                                    conversationFolderTextComponent.setValue(path);
                                    await this.handleFolderChange('conversationFolder', path, 'conversations', conversationFolderTextComponent);
                                }
                            },
                            this.plugin.settings.conversationFolder,
                            (path: string) => validateFolderNesting(
                                'conversationFolder',
                                path,
                                this.plugin.settings.conversationFolder,
                                this.plugin.settings.reportFolder,
                                this.plugin.settings.attachmentFolder
                            )
                        );
                        modal.open();
                    });
            });

        // Report Folder
        let reportFolderTextComponent: any;
        new Setting(containerEl)
            .setName(t('settings.folders.reports_folder.name'))
            .setDesc(t('settings.folders.reports_folder.desc'))
            .addText((text) => {
                reportFolderTextComponent = text;

                text
                    .setPlaceholder(t('settings.folders.reports_folder.placeholder'))
                    .setValue(this.plugin.settings.reportFolder);

                text.inputEl.addClass("nexus-folder-path-input");
                text.inputEl.addClass("nexus-report-folder-input");

                // Make input read-only - only Browse button can change the value
                text.inputEl.readOnly = true;
                text.inputEl.style.cursor = "default";
            })
            .addButton((button) => {
                button
                    .setButtonText(t('common.buttons.browse'))
                    .setTooltip(t('settings.folders.reports_folder.browse_tooltip'))
                    .onClick(async () => {
                        const modal = new FolderTreeBrowserModal(
                            this.plugin.app,
                            async (path: string) => {
                                // User selected or created a folder - handle the change directly
                                if (reportFolderTextComponent) {
                                    reportFolderTextComponent.setValue(path);
                                    await this.handleFolderChange('reportFolder', path, 'reports', reportFolderTextComponent);
                                }
                            },
                            this.plugin.settings.reportFolder,
                            (path: string) => validateFolderNesting(
                                'reportFolder',
                                path,
                                this.plugin.settings.conversationFolder,
                                this.plugin.settings.reportFolder,
                                this.plugin.settings.attachmentFolder
                            )
                        );
                        modal.open();
                    });
            });

        // Attachment Folder
        let attachmentFolderTextComponent: any;
        new Setting(containerEl)
            .setName(t('settings.folders.attachment_folder.name'))
            .setDesc(t('settings.folders.attachment_folder.desc'))
            .addText((text) => {
                attachmentFolderTextComponent = text;

                text
                    .setPlaceholder(t('settings.folders.attachment_folder.placeholder'))
                    .setValue(this.plugin.settings.attachmentFolder);

                text.inputEl.addClass("nexus-folder-path-input");
                text.inputEl.addClass("nexus-attachment-folder-input");

                // Make input read-only - only Browse button can change the value
                text.inputEl.readOnly = true;
                text.inputEl.style.cursor = "default";
            })
            .addButton((button) => {
                button
                    .setButtonText(t('common.buttons.browse'))
                    .setTooltip(t('settings.folders.attachment_folder.browse_tooltip'))
                    .onClick(async () => {
                        const modal = new FolderTreeBrowserModal(
                            this.plugin.app,
                            async (path: string) => {
                                // User selected or created a folder - handle the change directly
                                if (attachmentFolderTextComponent) {
                                    attachmentFolderTextComponent.setValue(path);
                                    await this.handleFolderChange('attachmentFolder', path, 'attachments', attachmentFolderTextComponent);
                                }
                            },
                            this.plugin.settings.attachmentFolder,
                            (path: string) => validateFolderNesting(
                                'attachmentFolder',
                                path,
                                this.plugin.settings.conversationFolder,
                                this.plugin.settings.reportFolder,
                                this.plugin.settings.attachmentFolder
                            )
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
        const oldPath = this.plugin.settings[settingKey];

        // If path hasn't changed, do nothing
        if (oldPath === newPath) {
            return;
        }

        // Validate folder nesting
        const validation = validateFolderNesting(
            settingKey,
            newPath,
            this.plugin.settings.conversationFolder,
            this.plugin.settings.reportFolder,
            this.plugin.settings.attachmentFolder
        );

        if (!validation.valid) {
            this.showErrorDialog(t('configure_folder_dialog.error_invalid_folder.title'), t('configure_folder_dialog.error_invalid_folder.message', { error: validation.error ?? "Invalid folder configuration" }));
            // Restore old value in the text field
            textComponent.setValue(oldPath);
            return;
        }

        // Check if old folder exists and has content
        const oldFolder = this.plugin.app.vault.getAbstractFileByPath(oldPath);

        if (!oldFolder || !(oldFolder instanceof TFolder)) {
            this.plugin.settings[settingKey] = newPath;
            await this.plugin.saveSettings();
            return;
        }

        const hasContent = oldFolder.children.length > 0;

        if (!hasContent) {
            this.plugin.settings[settingKey] = newPath;
            await this.plugin.saveSettings();
            return;
        }

        // Check if target folder exists and is not empty
        const newFolder = this.plugin.app.vault.getAbstractFileByPath(newPath);
        if (newFolder && newFolder instanceof TFolder && newFolder.children.length > 0) {
            this.showErrorDialog(
                t('folder_migration.error_target_not_empty.title'),
                t('folder_migration.error_target_not_empty.message', { path: newPath })
            );
            // Restore old value in the text field
            textComponent.setValue(oldPath);
            return;
        }

        // Show migration dialog - use enhanced dialog for attachment and conversation folders

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
        if (action === 'cancel') {
            // Restore old value in the text field
            textComponent.setValue(oldPath);
            return;
        }

        if (action === 'move') {
            // Migrate files using merge function
            try {
                const result = await moveAndMergeFolders(oldFolder, newPath, this.plugin.app.vault);

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
                this.showErrorDialog(t('folder_migration.error_migration_failed.title'), t('folder_migration.error_migration_failed.message_move', { error: error.message }));
                throw error;
            }
        }

        // Update setting (for both 'move' and 'keep')
        this.plugin.settings[settingKey] = newPath;
        await this.plugin.saveSettings();
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

            if (settingKey === 'conversationFolder') {
                // Update conversation links in reports AND artifacts
                await linkUpdateService.updateConversationLinks(oldPath, newPath);
            } else if (settingKey === 'attachmentFolder') {
                // Update attachment links in conversations
                await linkUpdateService.updateAttachmentLinks(oldPath, newPath);
            }
        } catch (error) {
            this.plugin.logger.error(`[FolderSettings] Failed to update links:`, error);
            new Notice(`⚠️ Files moved but some links may not have been updated`);
        }
    }

    /**
     * Show dialog with merge result details when files were skipped or errors occurred
     */
    private showMergeResultDialog(result: FolderMergeResult, _oldPath: string, _newPath: string): void {
        const modal = new Modal(this.plugin.app);
        modal.titleEl.setText(t('folder_migration.result_dialog.title'));

        const { contentEl } = modal;

        // Summary
        const summary = contentEl.createDiv({ cls: "nexus-merge-summary" });
        summary.createEl("h3", { text: t('folder_migration.result_dialog.summary_title') });

        const stats = summary.createDiv({ cls: "nexus-merge-stats" });
        stats.createEl("p", { text: t('folder_migration.result_dialog.moved', { count: String(result.moved) }) });

        if (result.skipped > 0) {
            stats.createEl("p", {
                text: t('folder_migration.result_dialog.skipped', { count: String(result.skipped) }),
                cls: "nexus-merge-warning"
            });
        }

        if (result.errors > 0) {
            stats.createEl("p", {
                text: t('folder_migration.result_dialog.errors', { count: String(result.errors) }),
                cls: "nexus-merge-error"
            });
        }

        // Explanation
        const explanation = contentEl.createDiv({ cls: "nexus-merge-explanation" });
        explanation.createEl("p", {
            text: t('folder_migration.result_dialog.explanation')
        });

        // Error details if any
        if (result.errorDetails && result.errorDetails.length > 0) {
            const errorSection = contentEl.createDiv({ cls: "nexus-merge-errors" });
            errorSection.createEl("h4", { text: t('folder_migration.result_dialog.error_details_title') });
            const errorList = errorSection.createEl("ul");
            for (const error of result.errorDetails) {
                errorList.createEl("li", { text: error });
            }
        }

        // Close button
        const buttonContainer = contentEl.createDiv({ cls: "modal-button-container" });
        const closeButton = buttonContainer.createEl("button", { text: t('common.buttons.ok'), cls: "mod-cta" });
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
            text: t('common.buttons.ok'),
            cls: "mod-cta"
        });
        okButton.addEventListener("click", () => modal.close());

        modal.open();
    }
}

