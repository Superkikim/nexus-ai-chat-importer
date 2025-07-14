// src/ui/settings/attachment-settings-section.ts
import { Setting } from "obsidian";
import { BaseSettingsSection } from "./base-settings-section";

export class AttachmentSettingsSection extends BaseSettingsSection {
    readonly title = "Attachment Settings";
    readonly order = 20;

    render(containerEl: HTMLElement): void {
        new Setting(containerEl)
            .setName("Import attachments")
            .setDesc("Save attachment files to disk and link them in conversations (uses 'best effort' strategy)")
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.importAttachments)
                    .onChange(async (value) => {
                        this.plugin.settings.importAttachments = value;
                        await this.plugin.saveSettings();
                        this.redraw(); // Trigger redraw to show/hide attachment options
                    })
            );

        if (this.plugin.settings.importAttachments) {
            this.renderAttachmentOptions(containerEl);
            this.renderAttachmentInfo(containerEl);
        }
    }

    private renderAttachmentOptions(containerEl: HTMLElement): void {
        new Setting(containerEl)
            .setName("Attachment folder")
            .setDesc("Choose a folder to store attachment files")
            .addText((text) =>
                text
                    .setPlaceholder("Enter attachment folder path")
                    .setValue(this.plugin.settings.attachmentFolder)
                    .onChange(async (value) => {
                        this.plugin.settings.attachmentFolder = value;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("Handle missing attachments")
            .setDesc("When attachments are missing from exports, create informative notes instead of skipping them")
            .addToggle((toggle) =>
                toggle
                    .setValue(!this.plugin.settings.skipMissingAttachments)
                    .onChange(async (value) => {
                        this.plugin.settings.skipMissingAttachments = !value;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("Show attachment details in reports")
            .setDesc("Include detailed attachment processing statistics in import reports")
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.showAttachmentDetails)
                    .onChange(async (value) => {
                        this.plugin.settings.showAttachmentDetails = value;
                        await this.plugin.saveSettings();
                    })
            );
    }

    private renderAttachmentInfo(containerEl: HTMLElement): void {
        const noteEl = containerEl.createDiv({ cls: "setting-item-description" });
        noteEl.style.marginTop = "15px";
        noteEl.style.padding = "15px";
        noteEl.style.backgroundColor = "var(--background-secondary)";
        noteEl.style.borderRadius = "8px";
        noteEl.style.border = "1px solid var(--background-modifier-border)";
        
        noteEl.createEl("h4", { text: "📎 About Attachment Handling", cls: "setting-item-name" });
        
        const infoList = noteEl.createEl("ul");
        infoList.style.marginTop = "10px";
        infoList.style.paddingLeft = "20px";
        
        infoList.createEl("li").innerHTML = "<strong>Best Effort Strategy:</strong> Files found in exports are extracted and linked; missing files get informative notes.";
        infoList.createEl("li").innerHTML = "<strong>Platform Differences:</strong> ChatGPT exports may not include all attachments, especially from older conversations.";
        infoList.createEl("li").innerHTML = "<strong>Simple Organization:</strong> Files organized as <code>attachments/provider/category/</code> (e.g., <code>attachments/chatgpt/images/</code>).";
        infoList.createEl("li").innerHTML = "<strong>Sync Tip:</strong> Consider excluding the attachment folder from sync to avoid uploading large files.";
        
        const tipEl = noteEl.createDiv();
        tipEl.style.marginTop = "10px";
        tipEl.style.fontStyle = "italic";
        tipEl.innerHTML = "💡 <strong>Tip:</strong> Enable 'Show attachment details' to see exactly which files were found, missing, or failed during import.";
    }
}