// src/dialogs/upgrade-notice-dialog.ts
import { Modal } from "obsidian";
import type NexusAiChatImporterPlugin from "../main";

/**
 * Dialog to inform users about new folder settings in v1.3.0
 */
export class UpgradeNoticeDialog extends Modal {
    constructor(private plugin: NexusAiChatImporterPlugin) {
        super(plugin.app);
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
        
        messageContainer.createEl("h3", { text: "✨ New: Configurable Folder Locations" });
        
        messageContainer.createEl("p", { 
            text: "You can now specify separate folder locations for:" 
        });

        const folderList = messageContainer.createEl("ul");
        folderList.createEl("li", { text: "Conversations" });
        folderList.createEl("li", { text: "Reports" });
        folderList.createEl("li", { text: "Attachments" });

        messageContainer.createEl("p", { 
            text: "All folder locations can be changed at any time in the plugin settings." 
        });

        // Info box
        const infoBox = contentEl.createDiv({ cls: "nexus-upgrade-info" });
        infoBox.createEl("strong", { text: "ℹ️ Note:" });
        infoBox.createEl("p", { 
            text: "Your existing files have NOT been moved. They remain in their current locations. You can manually move them if desired by changing the folder settings." 
        });

        // Button
        const buttonContainer = contentEl.createDiv({ cls: "nexus-upgrade-button-container" });
        const okButton = buttonContainer.createEl("button", { 
            text: "Got it!",
            cls: "mod-cta"
        });
        okButton.addEventListener("click", () => {
            this.close();
        });

        // Add styles
        this.addStyles();
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
            }

            .nexus-upgrade-button-container button {
                padding: 8px 24px;
            }
        `;
        document.head.appendChild(styleEl);
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

