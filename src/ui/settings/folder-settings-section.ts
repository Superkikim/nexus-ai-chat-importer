// src/ui/settings/folder-settings-section.ts
import { Setting } from "obsidian";
import { BaseSettingsSection } from "./base-settings-section";

export class FolderSettingsSection extends BaseSettingsSection {
    readonly title = "📁 Folder Structure";
    readonly order = 10;

    render(containerEl: HTMLElement): void {
        // Conversation Folder
        new Setting(containerEl)
            .setName("Conversation folder")
            .setDesc("Where imported conversations are stored")
            .addText((text) =>
                text
                    .setPlaceholder("Nexus/Conversations")
                    .setValue(this.plugin.settings.conversationFolder)
                    .onChange(async (value) => {
                        this.plugin.settings.conversationFolder = value;
                        await this.plugin.saveSettings();
                    })
            );

        // Report Folder
        new Setting(containerEl)
            .setName("Report folder")
            .setDesc("Where import reports are stored")
            .addText((text) =>
                text
                    .setPlaceholder("Nexus/Reports")
                    .setValue(this.plugin.settings.reportFolder)
                    .onChange(async (value) => {
                        this.plugin.settings.reportFolder = value;
                        await this.plugin.saveSettings();
                    })
            );

        // Attachment Folder
        new Setting(containerEl)
            .setName("Attachment folder")
            .setDesc("Where attachments are stored (⚠️ Exclude from sync to save space)")
            .addText((text) =>
                text
                    .setPlaceholder("Nexus/Attachments")
                    .setValue(this.plugin.settings.attachmentFolder)
                    .onChange(async (value) => {
                        this.plugin.settings.attachmentFolder = value;
                        await this.plugin.saveSettings();
                    })
            );
    }
}

