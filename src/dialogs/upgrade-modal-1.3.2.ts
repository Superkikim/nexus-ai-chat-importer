/**
 * Upgrade modal for v1.3.2
 * Shows Ko-fi support + release notes
 */

import { App, Modal, MarkdownRenderer } from "obsidian";
import type NexusAiChatImporterPlugin from "../main";
import { createKofiSupportBox } from "../ui/components/kofi-support-box";

export class NexusUpgradeModal132 extends Modal {
    private plugin: NexusAiChatImporterPlugin;
    private version: string;

    constructor(app: App, plugin: NexusAiChatImporterPlugin, version: string) {
        super(app);
        this.plugin = plugin;
        this.version = version;
    }

    onOpen(): void {
        const { contentEl, titleEl, modalEl } = this;

        // Add custom CSS classes
        modalEl.classList.add('nexus-upgrade-complete-modal');
        contentEl.classList.add('nexus-ai-chat-importer-modal');

        // Set title
        titleEl.setText(`Upgrade to v${this.version}`);

        this.createContent();
    }

    onClose(): void {
        this.contentEl.empty();
    }

    async createContent() {
        const { contentEl } = this;

        // Ko-fi support section
        createKofiSupportBox(contentEl);

        // Release notes
        await this.addReleaseNotes();

        // Close button
        this.addCloseButton();

        // Add custom styles
        this.addStyles();
    }

    private async addReleaseNotes() {
        // Simple, user-friendly content
        const content = `## 🔄 What's New

**Claude changed their export format.** If you imported Claude conversations recently and noticed missing code files or strange links, v1.3.2 fixes this.

**To get your missing files back:**
1. Delete the affected conversations from your vault
2. Re-import the same ZIP file
3. Everything will be there now ✅

---

## 🐛 Fixes

- **Claude artifacts now work with the new export format**
- **Fixed crashes during import** (missing logger errors)
- **Fixed weird formatting** in conversations with multiple attachments
- **Better messages** when re-importing conversations

---

## 🙏 Questions?

If something doesn't work as expected, please report it on the [forum thread](https://forum.obsidian.md/t/plugin-nexus-ai-chat-importer-import-chatgpt-and-claude-conversations-to-your-vault/71664).`;

        // Render markdown
        const contentDiv = this.contentEl.createDiv({ cls: "nexus-upgrade-notes" });
        await MarkdownRenderer.render(
            this.app,
            content,
            contentDiv,
            "",
            this.plugin
        );
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
            .nexus-upgrade-notes {
                margin: 20px 0;
                line-height: 1.6;
            }

            .nexus-upgrade-button-container {
                display: flex;
                justify-content: center;
                margin-top: 30px;
                padding-bottom: 10px;
            }

            .nexus-upgrade-button {
                padding: 12px 32px;
                font-size: 16px;
                font-weight: 600;
            }
        `;
        this.contentEl.appendChild(style);
    }
}

