// src/dialogs/folder-migration-dialog.ts
import { Modal, Notice } from "obsidian";
import type NexusAiChatImporterPlugin from "../main";

/**
 * Dialog to ask user if they want to migrate files when changing folder location
 */
export class FolderMigrationDialog extends Modal {
    private onComplete: (shouldMigrate: boolean) => Promise<void>;
    private oldPath: string;
    private newPath: string;
    private folderType: string;

    constructor(
        plugin: NexusAiChatImporterPlugin,
        oldPath: string,
        newPath: string,
        folderType: string,
        onComplete: (shouldMigrate: boolean) => Promise<void>
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

        // Buttons
        const buttonContainer = contentEl.createDiv({ cls: "nexus-migration-buttons" });
        
        const noButton = buttonContainer.createEl("button", { 
            text: "No, keep files in old location",
            cls: "nexus-migration-button-no"
        });
        noButton.addEventListener("click", async () => {
            this.close();
            try {
                await this.onComplete(false);
                new Notice(`Folder setting updated. Files remain in ${this.oldPath}`);
            } catch (error) {
                new Notice(`Failed to update setting: ${error.message}`);
            }
        });

        const yesButton = buttonContainer.createEl("button", { 
            text: "Yes, move files",
            cls: "mod-cta nexus-migration-button-yes"
        });
        yesButton.addEventListener("click", async () => {
            this.close();
            try {
                await this.onComplete(true);
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
                justify-content: flex-end;
                gap: 10px;
            }

            .nexus-migration-buttons button {
                padding: 8px 16px;
            }

            .nexus-migration-button-no {
                background-color: var(--background-modifier-border);
            }
        `;
        document.head.appendChild(styleEl);
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

