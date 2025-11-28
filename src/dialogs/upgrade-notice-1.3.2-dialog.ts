import { App, Modal } from "obsidian";
import type NexusAiChatImporterPlugin from "../main";
import { createKofiSupportBox } from "../ui/components/kofi-support-box";

/**
 * Upgrade notice dialog for v1.3.2
 * Shows users upgrading from 1.3.0 about Claude format changes
 */
export class UpgradeNotice132Dialog extends Modal {
    private plugin: NexusAiChatImporterPlugin;

    constructor(app: App, plugin: NexusAiChatImporterPlugin) {
        super(app);
        this.plugin = plugin;
    }

    onOpen(): void {
        const { contentEl, titleEl, modalEl } = this;

        // Add custom CSS classes
        modalEl.classList.add('nexus-upgrade-notice-modal');
        contentEl.classList.add('nexus-ai-chat-importer-modal');

        // Set title
        titleEl.setText(`🔄 Nexus v1.3.2 - Claude Format Update`);

        this.createContent();
    }

    onClose(): void {
        this.contentEl.empty();
    }

    private createContent() {
        const { contentEl } = this;

        // Ko-fi support section
        createKofiSupportBox(contentEl);

        // Main message section
        const messageSection = contentEl.createDiv({ cls: "nexus-upgrade-message-section" });

        // What's new
        const whatsNew = messageSection.createDiv({ cls: "nexus-upgrade-section" });
        whatsNew.createEl("h3", { text: "🔄 What Changed" });
        whatsNew.createEl("p", {
            text: "Claude changed their export format. If you imported Claude conversations recently and noticed missing code files or strange links, v1.3.2 fixes this."
        });

        // What to do
        const whatToDo = messageSection.createDiv({ cls: "nexus-upgrade-section" });
        whatToDo.createEl("h3", { text: "✅ What To Do" });
        
        const instructions = whatToDo.createEl("p");
        instructions.innerHTML = `
            <strong>If you have missing Claude artifacts:</strong><br>
            1. Delete the affected conversations from your vault<br>
            2. Re-import the same ZIP file<br>
            3. Everything will be there now ✅
        `;

        // Bug fixes
        const bugFixes = messageSection.createDiv({ cls: "nexus-upgrade-section" });
        bugFixes.createEl("h3", { text: "🐛 Other Fixes" });
        
        const fixList = bugFixes.createEl("ul");
        fixList.innerHTML = `
            <li>Fixed crashes during import (missing logger errors)</li>
            <li>Fixed weird formatting in conversations with multiple attachments</li>
            <li>Better messages when re-importing conversations</li>
        `;

        // Close button
        this.addCloseButton();

        // Add custom styles
        this.addStyles();
    }

    private addCloseButton() {
        const buttonContainer = this.contentEl.createDiv({ cls: "nexus-upgrade-button-container" });
        const button = buttonContainer.createEl("button", {
            text: "Got it!",
            cls: "mod-cta nexus-upgrade-button"
        });

        button.addEventListener("click", () => {
            this.close();
        });
    }

    private addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .nexus-upgrade-notice-modal .modal {
                max-width: 600px;
            }

            .nexus-upgrade-message-section {
                margin-top: 20px;
            }

            .nexus-upgrade-section {
                margin-bottom: 20px;
            }

            .nexus-upgrade-section h3 {
                margin-top: 0;
                margin-bottom: 10px;
                color: var(--text-normal);
            }

            .nexus-upgrade-section p,
            .nexus-upgrade-section ul {
                color: var(--text-muted);
                line-height: 1.6;
            }

            .nexus-upgrade-section ul {
                margin-left: 20px;
            }

            .nexus-upgrade-section ul li {
                margin-bottom: 8px;
            }

            .nexus-upgrade-button-container {
                display: flex;
                justify-content: center;
                margin-top: 30px;
                padding-top: 20px;
                border-top: 1px solid var(--background-modifier-border);
            }

            .nexus-upgrade-button {
                padding: 12px 32px;
                font-size: 16px;
                font-weight: 600;
            }
        `;
        document.head.appendChild(style);
    }
}

