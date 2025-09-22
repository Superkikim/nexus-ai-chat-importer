// src/ui/settings/conversation-selection-settings-section.ts
import { Setting } from "obsidian";
import { BaseSettingsSection } from "./base-settings-section";

export class ConversationSelectionSettingsSection extends BaseSettingsSection {
    readonly title = "Conversation Selection Settings";
    readonly order = 15; // Between conversation (10) and attachment (20) settings

    render(containerEl: HTMLElement): void {
        // Default import mode
        new Setting(containerEl)
            .setName("Default import mode")
            .setDesc("Choose the default behavior when importing conversations")
            .addDropdown((dropdown) =>
                dropdown
                    .addOption("all", "Import All Conversations")
                    .addOption("selective", "Select Specific Conversations")
                    .setValue(this.plugin.settings.defaultImportMode)
                    .onChange(async (value: string) => {
                        if (value === "all" || value === "selective") {
                            this.plugin.settings.defaultImportMode = value as "all" | "selective";
                            await this.plugin.saveSettings();
                        }
                    })
            );

        // Remember last choice
        new Setting(containerEl)
            .setName("Remember last import mode")
            .setDesc("Remember the last selected import mode and use it as default for future imports")
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.rememberLastImportMode)
                    .onChange(async (value) => {
                        this.plugin.settings.rememberLastImportMode = value;
                        await this.plugin.saveSettings();
                    })
            );

        // Page size for conversation selection
        new Setting(containerEl)
            .setName("Conversations per page")
            .setDesc("Number of conversations to display per page in the selection dialog")
            .addDropdown((dropdown) =>
                dropdown
                    .addOption("10", "10 conversations")
                    .addOption("20", "20 conversations")
                    .addOption("50", "50 conversations")
                    .addOption("100", "100 conversations")
                    .setValue(this.plugin.settings.conversationPageSize.toString())
                    .onChange(async (value: string) => {
                        const pageSize = parseInt(value);
                        if ([10, 20, 50, 100].includes(pageSize)) {
                            this.plugin.settings.conversationPageSize = pageSize;
                            await this.plugin.saveSettings();
                        }
                    })
            );

        // Auto-select all conversations
        new Setting(containerEl)
            .setName("Auto-select all conversations")
            .setDesc("Automatically select all conversations when opening the selection dialog")
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.autoSelectAllOnOpen)
                    .onChange(async (value) => {
                        this.plugin.settings.autoSelectAllOnOpen = value;
                        await this.plugin.saveSettings();
                    })
            );

        // Information section
        this.renderInfoSection(containerEl);
    }

    private renderInfoSection(containerEl: HTMLElement): void {
        const infoContainer = containerEl.createDiv({ cls: "setting-item-description" });
        infoContainer.style.marginTop = "20px";
        infoContainer.style.padding = "15px";
        infoContainer.style.backgroundColor = "var(--background-secondary)";
        infoContainer.style.borderRadius = "8px";
        infoContainer.style.border = "1px solid var(--background-modifier-border)";

        const infoTitle = infoContainer.createEl("h4", { text: "About Conversation Selection" });
        infoTitle.style.marginTop = "0";
        infoTitle.style.marginBottom = "10px";
        infoTitle.style.color = "var(--text-accent)";

        const infoText = infoContainer.createDiv();
        infoText.innerHTML = `
            <p style="margin: 0 0 10px 0; color: var(--text-normal);">
                The conversation selection feature allows you to preview and choose specific conversations 
                to import from your ChatGPT or Claude export files, rather than importing all conversations.
            </p>
            <p style="margin: 0 0 10px 0; color: var(--text-normal);">
                <strong>Import All:</strong> Imports all conversations from the ZIP file (faster, existing behavior).
            </p>
            <p style="margin: 0; color: var(--text-normal);">
                <strong>Select Specific:</strong> Shows a preview of all conversations with metadata 
                (title, dates, message count) and allows you to choose which ones to import.
            </p>
        `;
    }
}
