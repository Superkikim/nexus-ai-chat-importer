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

import { App, Modal, MarkdownRenderer } from "obsidian";
import type NexusAiChatImporterPlugin from "../main";
import { createKofiSupportBox } from "../ui/components/kofi-support-box";

/**
 * Upgrade complete modal - shown AFTER migrations are done
 * Displays Ko-fi + What's New + Improvements + Bug Fixes
 */
export class UpgradeCompleteModal extends Modal {
    private plugin: NexusAiChatImporterPlugin;
    private version: string;

    constructor(app: App, plugin: NexusAiChatImporterPlugin, version: string) {
        super(app);
        this.plugin = plugin;
        this.version = version;
    }

    onOpen(): void {
        const { contentEl, titleEl, modalEl } = this;

        // Add custom CSS classes (width is set in styles.css)
        modalEl.classList.add('nexus-upgrade-complete-modal');
        contentEl.classList.add('nexus-ai-chat-importer-modal');

        // Set title
        titleEl.setText(`✅ Upgrade Complete - v${this.version}`);

        this.createContent();
    }

    onClose(): void {
        this.contentEl.empty();
    }

    async createContent() {
        const { contentEl } = this;

        // Ko-fi support section (using reusable component)
        createKofiSupportBox(contentEl);

        // Release notes content
        await this.addReleaseNotes();

        // Close button (centered and prominent)
        this.addCloseButton();

        // Add custom styles
        this.addStyles();
    }

    private async addReleaseNotes() {
        // Fallback content for v1.3.0
        let content = `## ✨ What's New

- **🗂️ Separate Reports Folder** - Better organization, easier to exclude from sync
- **🌍 International Date Support** - Works in all languages, no more MM/DD confusion
- **🌳 Visual Folder Browser** - Tree-based navigation, create folders on the fly
- **🎯 Enhanced Selective Import** - Better preview, duplicate detection across ZIPs
- **📎 Improved Attachments** - DALL-E images with prompts, better formatting

## 🎨 Improvements

- Redesigned Settings page - easier to find what you need
- Faster imports - especially for large collections
- Better progress messages - know exactly what's happening
- More detailed reports - see exactly what was imported
- Clearer dialogs - less confusing text

## 🐛 Bug Fixes

- Fixed timestamp parsing for non-US locales
- Fixed folder deletion after migration
- Fixed link updates in Claude artifacts
- Fixed duplicate conversations in multi-ZIP imports
- Fixed special characters in conversation titles
- Fixed DALL-E images display
- Fixed progress modal accuracy
- Fixed UI elements overflow
- And many more...`;

        try {
            // Try to fetch Overview section from README
            const response = await fetch(`https://raw.githubusercontent.com/Superkikim/nexus-ai-chat-importer/${this.version}/README.md`);
            if (response.ok) {
                const readme = await response.text();

                // Extract Overview section (between ## Overview and next ##)
                const overviewMatch = readme.match(/## Overview\s+([\s\S]*?)(?=\n## |\n# |$)/);
                if (overviewMatch && overviewMatch[1]) {
                    content = overviewMatch[1].trim();
                }
            }
        } catch (error) {
            // Use fallback content
        }

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
        const style = document.createElement("style");
        style.textContent = `
            /* Modal sizing */
            .nexus-upgrade-complete-modal .modal {
                max-height: 85vh;
            }

            .nexus-upgrade-complete-modal .modal-content {
                padding: 20px 24px;
                overflow-y: auto;
                max-height: calc(85vh - 100px);
            }

            /* Release notes content */
            .nexus-upgrade-notes {
                padding: 0 1em;
                margin-bottom: 2em;
            }

            .nexus-upgrade-notes h2 {
                color: var(--text-accent);
                margin-top: 1.5em;
                margin-bottom: 0.8em;
                border-bottom: 2px solid var(--background-modifier-border);
                padding-bottom: 0.3em;
            }

            .nexus-upgrade-notes h2:first-child {
                margin-top: 0;
            }

            .nexus-upgrade-notes ul {
                margin-left: 1.5em;
                line-height: 1.8;
            }

            .nexus-upgrade-notes li {
                margin: 0.5em 0;
            }

            /* Close button */
            .nexus-upgrade-button-container {
                text-align: center;
                padding: 1.5em 0;
                border-top: 1px solid var(--background-modifier-border);
                margin-top: 1em;
            }

            .nexus-upgrade-button {
                padding: 0.8em 3em;
                font-size: 1.1em;
                font-weight: 600;
                border-radius: 8px;
            }
        `;
        document.head.appendChild(style);
    }
}

