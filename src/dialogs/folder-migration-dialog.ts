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


// src/dialogs/folder-migration-dialog.ts
import { Modal, Notice } from "obsidian";
import type NexusAiChatImporterPlugin from "../main";

/**
 * Dialog to ask user if they want to migrate files when changing folder location
 */
export class FolderMigrationDialog extends Modal {
    private onComplete: (action: 'move' | 'keep' | 'cancel') => Promise<void>;
    private oldPath: string;
    private newPath: string;
    private folderType: string;

    constructor(
        plugin: NexusAiChatImporterPlugin,
        oldPath: string,
        newPath: string,
        folderType: string,
        onComplete: (action: 'move' | 'keep' | 'cancel') => Promise<void>
    ) {
        super(plugin.app);
        this.oldPath = oldPath;
        this.newPath = newPath;
        this.folderType = folderType;
        this.onComplete = onComplete;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        // Title
        contentEl.createEl("h2", { 
            text: "Move Existing Files?",
            cls: "nexus-migration-title"
        });

        // Message
        const messageContainer = contentEl.createDiv({ cls: "nexus-migration-message" });
        
        messageContainer.createEl("p", { 
            text: `You are changing the ${this.folderType} folder location:` 
        });

        const pathContainer = messageContainer.createDiv({ cls: "nexus-migration-paths" });
        pathContainer.createEl("div", { 
            text: `From: ${this.oldPath}`,
            cls: "nexus-migration-path-old"
        });
        pathContainer.createEl("div", { 
            text: `To: ${this.newPath}`,
            cls: "nexus-migration-path-new"
        });

        messageContainer.createEl("p", { 
            text: "Do you want to move existing files to the new location?" 
        });

        // Warning box
        const warningBox = contentEl.createDiv({ cls: "nexus-migration-warning" });
        warningBox.createEl("strong", { text: "⚠️ Important:" });
        warningBox.createEl("p", { 
            text: "If you choose 'No', existing files will remain in the old location and will not be impacted by future updates." 
        });

        // Buttons (3 options: Cancel, Keep, Move)
        const buttonContainer = contentEl.createDiv({ cls: "nexus-migration-buttons" });

        // Cancel button (left)
        const cancelButton = buttonContainer.createEl("button", {
            text: "Cancel",
            cls: "nexus-migration-button-cancel"
        });
        cancelButton.addEventListener("click", async () => {
            this.close();
            try {
                await this.onComplete('cancel');
                new Notice(`Change cancelled. Folder setting reverted.`);
            } catch (error) {
                new Notice(`Failed to revert setting: ${error.message}`);
            }
        });

        // Keep button (middle)
        const keepButton = buttonContainer.createEl("button", {
            text: "No, keep files in old location",
            cls: "nexus-migration-button-keep"
        });
        keepButton.addEventListener("click", async () => {
            this.close();
            try {
                await this.onComplete('keep');
                new Notice(`Folder setting updated. Files remain in ${this.oldPath}`);
            } catch (error) {
                new Notice(`Failed to update setting: ${error.message}`);
            }
        });

        // Move button (right, primary action)
        const moveButton = buttonContainer.createEl("button", {
            text: "Yes, move files",
            cls: "mod-cta nexus-migration-button-move"
        });
        moveButton.addEventListener("click", async () => {
            this.close();
            try {
                await this.onComplete('move');
                new Notice(`Files moved to ${this.newPath}`);
            } catch (error) {
                new Notice(`Failed to move files: ${error.message}`);
            }
        });

        // Add styles
        this.addStyles();
    }

    private addStyles() {
        const styleEl = document.createElement("style");
        styleEl.textContent = `
            .nexus-migration-title {
                margin-bottom: 1em;
                color: var(--text-normal);
            }

            .nexus-migration-message {
                margin-bottom: 1.5em;
                line-height: 1.6;
            }

            .nexus-migration-paths {
                background-color: var(--background-secondary);
                padding: 1em;
                margin: 1em 0;
                border-radius: 4px;
                font-family: var(--font-monospace);
                font-size: 0.9em;
            }

            .nexus-migration-path-old {
                color: var(--text-muted);
                margin-bottom: 0.5em;
            }

            .nexus-migration-path-new {
                color: var(--interactive-accent);
                font-weight: 500;
            }

            .nexus-migration-warning {
                background-color: var(--background-modifier-error-hover);
                border-left: 4px solid var(--text-error);
                padding: 1em;
                margin-bottom: 1.5em;
                border-radius: 4px;
            }

            .nexus-migration-warning strong {
                display: block;
                margin-bottom: 0.5em;
                color: var(--text-error);
            }

            .nexus-migration-warning p {
                margin: 0;
                color: var(--text-normal);
            }

            .nexus-migration-buttons {
                display: flex;
                justify-content: space-between;
                gap: 10px;
            }

            .nexus-migration-buttons button {
                padding: 8px 16px;
                flex: 1;
            }

            .nexus-migration-button-cancel {
                background-color: var(--background-modifier-border);
                color: var(--text-muted);
            }

            .nexus-migration-button-keep {
                background-color: var(--background-modifier-border);
            }

            .nexus-migration-button-move {
                /* Uses mod-cta class for primary styling */
            }
        `;
        document.head.appendChild(styleEl);
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

