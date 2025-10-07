// src/ui/settings/folder-settings-section.ts
import { Setting, TFolder, TextComponent } from "obsidian";
import { BaseSettingsSection } from "./base-settings-section";
import { FolderMigrationDialog } from "../../dialogs/folder-migration-dialog";

export class FolderSettingsSection extends BaseSettingsSection {
    readonly title = "📁 Folder Structure";
    readonly order = 10;

    render(containerEl: HTMLElement): void {
        // Conversation Folder
        new Setting(containerEl)
            .setName("Conversation folder")
            .setDesc("Where imported conversations are stored")
            .addText((text) => {
                text
                    .setPlaceholder("Nexus/Conversations")
                    .setValue(this.plugin.settings.conversationFolder);

                // Detect change when user leaves the field (not on every keystroke)
                text.inputEl.addEventListener('blur', async () => {
                    const newValue = text.getValue();
                    await this.handleFolderChange('conversationFolder', newValue, 'conversations', text);
                });
            });

        // Report Folder
        new Setting(containerEl)
            .setName("Report folder")
            .setDesc("Where import reports are stored")
            .addText((text) => {
                text
                    .setPlaceholder("Nexus/Reports")
                    .setValue(this.plugin.settings.reportFolder);

                // Detect change when user leaves the field (not on every keystroke)
                text.inputEl.addEventListener('blur', async () => {
                    const newValue = text.getValue();
                    await this.handleFolderChange('reportFolder', newValue, 'reports', text);
                });
            });

        // Attachment Folder
        new Setting(containerEl)
            .setName("Attachment folder")
            .setDesc("Where attachments are stored (⚠️ Exclude from sync to save space)")
            .addText((text) => {
                text
                    .setPlaceholder("Nexus/Attachments")
                    .setValue(this.plugin.settings.attachmentFolder);

                // Detect change when user leaves the field (not on every keystroke)
                text.inputEl.addEventListener('blur', async () => {
                    const newValue = text.getValue();
                    await this.handleFolderChange('attachmentFolder', newValue, 'attachments', text);
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

        // Show migration dialog
        this.plugin.logger.debug(`[FolderSettings] Showing migration dialog`);
        const dialog = new FolderMigrationDialog(
            this.plugin,
            oldPath,
            newPath,
            folderType,
            async (action: 'move' | 'keep' | 'cancel') => {
                this.plugin.logger.debug(`[FolderSettings] User choice: ${action}`);

                if (action === 'cancel') {
                    // Restore old value in the text field
                    this.plugin.logger.debug(`[FolderSettings] User cancelled, restoring old value: "${oldPath}"`);
                    textComponent.setValue(oldPath);
                    return;
                }

                if (action === 'move') {
                    // Migrate files
                    this.plugin.logger.debug(`[FolderSettings] Starting migration...`);
                    try {
                        await this.plugin.app.vault.rename(oldFolder, newPath);
                        this.plugin.logger.debug(`[FolderSettings] Migration successful`);
                    } catch (error) {
                        this.plugin.logger.error(`[FolderSettings] Migration failed:`, error);
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
        );
        dialog.open();
    }
}

