// src/ui/settings-tab.ts
import { App, PluginSettingTab, Setting } from "obsidian";
import type NexusAiChatImporterPlugin from "../main";

export class NexusAiChatImporterPluginSettingTab extends PluginSettingTab {
    plugin: NexusAiChatImporterPlugin;

    constructor(app: App, plugin: NexusAiChatImporterPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        new Setting(containerEl)
            .setName("Conversations folder")
            .setDesc("Choose a folder to store ChatGPT conversations and import reports")
            .addText((text) =>
                text
                    .setPlaceholder("Enter folder name")
                    .setValue(this.plugin.settings.archiveFolder)
                    .onChange(async (value) => {
                        this.plugin.settings.archiveFolder = value;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("Add date prefix to filenames")
            .setDesc("Add creation date as a prefix to conversation filenames")
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.addDatePrefix)
                    .onChange(async (value) => {
                        this.plugin.settings.addDatePrefix = value;
                        await this.plugin.saveSettings();
                        this.display();
                    })
            );

        if (this.plugin.settings.addDatePrefix) {
            new Setting(containerEl)
                .setName("Date format")
                .setDesc("Choose the format for the date prefix")
                .addDropdown((dropdown) =>
                    dropdown
                        .addOption("YYYY-MM-DD", "YYYY-MM-DD")
                        .addOption("YYYYMMDD", "YYYYMMDD")
                        .setValue(this.plugin.settings.dateFormat)
                        .onChange(async (value: string) => {
                            if (value === "YYYY-MM-DD" || value === "YYYYMMDD") {
                                this.plugin.settings.dateFormat = value as "YYYY-MM-DD" | "YYYYMMDD";
                                await this.plugin.saveSettings();
                            }
                        })
                );
        }

        // Attachment settings section
        containerEl.createEl("h3", { text: "Attachment Settings" });

        new Setting(containerEl)
            .setName("Import attachments")
            .setDesc("Save attachment files to disk and link them in conversations")
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.importAttachments)
                    .onChange(async (value) => {
                        this.plugin.settings.importAttachments = value;
                        await this.plugin.saveSettings();
                        this.display();
                    })
            );

        if (this.plugin.settings.importAttachments) {
            new Setting(containerEl)
                .setName("Attachment folder")
                .setDesc("Choose a folder to store attachment files (recommended: exclude from sync for large files)")
                .addText((text) =>
                    text
                        .setPlaceholder("Enter attachment folder path")
                        .setValue(this.plugin.settings.attachmentFolder)
                        .onChange(async (value) => {
                            this.plugin.settings.attachmentFolder = value;
                            await this.plugin.saveSettings();
                        })
                );
            
            // Add helpful note about sync exclusion
            const noteEl = containerEl.createDiv({ cls: "setting-item-description" });
            noteEl.createEl("strong", { text: "💡 Tip: " });
            noteEl.appendText("Consider excluding the attachment folder from sync to avoid uploading large files.");
            noteEl.createEl("br");
            noteEl.createEl("strong", { text: "🎯 Organization: " });
            noteEl.appendText("Attachments will be organized by providers automatically.");
            noteEl.style.marginTop = "10px";
            noteEl.style.padding = "10px";
            noteEl.style.backgroundColor = "var(--background-secondary)";
            noteEl.style.borderRadius = "4px";
        }
    }
}