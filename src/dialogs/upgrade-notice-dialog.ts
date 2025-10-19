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


// src/dialogs/upgrade-notice-dialog.ts
import { Modal, Setting, TFolder } from "obsidian";
import type NexusAiChatImporterPlugin from "../main";
import { FolderMigrationDialog } from "./folder-migration-dialog";

/**
 * Dialog to inform users about new folder settings in v1.3.0
 */
export class UpgradeNoticeDialog extends Modal {
    private reportFolderInput: HTMLInputElement | null = null;
    private originalReportFolder: string;

    constructor(private plugin: NexusAiChatImporterPlugin) {
        super(plugin.app);
        this.originalReportFolder = plugin.settings.reportFolder || "Nexus/Conversations/Reports";
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

        messageContainer.createEl("h3", { text: "✨ New: Report Folder Setting" });

        messageContainer.createEl("p", {
            text: "You can now configure the report folder location separately from conversations and attachments."
        });

        // Report folder input section
        const folderSection = contentEl.createDiv({ cls: "nexus-upgrade-folder-section" });

        new Setting(folderSection)
            .setName("📁 Report Folder Location")
            .setDesc("You can change this path now if you want to move your reports to a different location.")
            .addText(text => {
                this.reportFolderInput = text.inputEl;
                text
                    .setPlaceholder("Nexus/Reports")
                    .setValue(this.originalReportFolder)
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
            text: "If you choose to ignore, existing files will not be impacted by future updates."
        });

        // Buttons
        const buttonContainer = contentEl.createDiv({ cls: "nexus-upgrade-button-container" });

        const cancelButton = buttonContainer.createEl("button", {
            text: "Skip",
            cls: "nexus-upgrade-button-secondary"
        });
        cancelButton.addEventListener("click", () => {
            this.close();
        });

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
        if (!this.reportFolderInput) {
            this.close();
            return;
        }

        const newReportFolder = this.reportFolderInput.value.trim();

        // If no change, just close
        if (newReportFolder === this.originalReportFolder) {
            this.close();
            return;
        }

        // Validate folder path
        if (!newReportFolder) {
            this.close();
            return;
        }

        // Update settings
        const oldReportFolder = this.plugin.settings.reportFolder;
        this.plugin.settings.reportFolder = newReportFolder;
        await this.plugin.saveSettings();

        // Close the dialog first
        this.close();

        // Ask if user wants to move existing files
        if (oldReportFolder && oldReportFolder !== newReportFolder) {
            const oldFolder = this.plugin.app.vault.getAbstractFileByPath(oldReportFolder);

            // Only show dialog if old folder exists and has content
            if (oldFolder && oldFolder instanceof TFolder && oldFolder.children.length > 0) {
                const dialog = new FolderMigrationDialog(
                    this.plugin,
                    oldReportFolder,
                    newReportFolder,
                    "Reports",
                    async (action: 'move' | 'keep' | 'cancel') => {
                        if (action === 'move') {
                            // Move the folder
                            await this.plugin.app.vault.rename(oldFolder, newReportFolder);
                        }
                        // For 'keep' or 'cancel', settings are already updated
                    }
                );
                dialog.open();
            }
        }
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

            .nexus-upgrade-message ul {
                margin-left: 2em;
                margin-bottom: 1em;
            }

            .nexus-upgrade-message li {
                margin-bottom: 0.3em;
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
                width: 100% !important;
                min-width: 400px !important;
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
                color: var(--text-normal);
            }

            .nexus-upgrade-info p {
                margin: 0;
                color: var(--text-muted);
            }

            .nexus-upgrade-button-container {
                display: flex;
                justify-content: flex-end;
                gap: 0.5em;
            }

            .nexus-upgrade-button-container button {
                padding: 8px 24px;
            }

            .nexus-upgrade-button-secondary {
                background-color: var(--background-modifier-border);
                color: var(--text-normal);
                border: none;
                border-radius: 4px;
                cursor: pointer;
            }

            .nexus-upgrade-button-secondary:hover {
                background-color: var(--background-modifier-border-hover);
            }
        `;
        document.head.appendChild(styleEl);
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

