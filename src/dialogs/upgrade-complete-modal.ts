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
        const { containerEl, titleEl, modalEl } = this;

        // Add custom CSS class
        modalEl.classList.add('nexus-upgrade-complete-modal');

        // Set modal width IMMEDIATELY (before content loads)
        modalEl.style.width = '800px';
        modalEl.style.maxWidth = '90vw';

        // Set title
        titleEl.setText(`✅ Upgrade Complete - v${this.version}`);

        this.createContent();
    }

    onClose(): void {
        this.contentEl.empty();
    }

    async createContent() {
        const { contentEl } = this;

        // Ko-fi section (top)
        this.addKofiSection();

        // Release notes content
        await this.addReleaseNotes();

        // Close button (centered and prominent)
        this.addCloseButton();

        // Add custom styles
        this.addStyles();
    }

    private addKofiSection() {
// Ko-fi support section (using reusable component)
        createKofiSupportBox(this.contentEl);
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
            // Try to fetch from GitHub release
            const response = await fetch(`https://api.github.com/repos/Superkikim/nexus-ai-chat-importer/releases/tags/v${this.version}`);
            if (response.ok) {
                const release = await response.json();
                if (release.body) {
                    content = release.body;
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
            /* Modal sizing - LARGE by default */
            .nexus-upgrade-complete-modal .modal {
                width: 800px !important;
                max-width: 90vw !important;
                max-height: 85vh;
            }

            .nexus-upgrade-complete-modal .modal-content {
                padding: 0;
                overflow-y: auto;
                max-height: calc(85vh - 100px);
            }

            /* Ko-fi section */
            .nexus-kofi-section {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 2em;
                border-radius: 8px;
                margin-bottom: 2em;
                text-align: center;
            }

            .nexus-kofi-header {
                margin-bottom: 1em;
            }

            .nexus-kofi-title {
                font-size: 1.5em;
                font-weight: bold;
            }

            .nexus-kofi-message {
                margin-bottom: 1.5em;
                line-height: 1.6;
            }

            .nexus-kofi-message p {
                margin: 0.5em 0;
            }

            .nexus-kofi-button-container {
                margin: 1.5em 0;
            }

            .nexus-kofi-link {
                display: inline-block;
                transition: transform 0.2s;
            }

            .nexus-kofi-link:hover {
                transform: scale(1.05);
            }

            .nexus-kofi-amounts {
                margin-top: 1em;
                font-size: 0.95em;
            }

            .nexus-kofi-amounts-title {
                margin-bottom: 0.5em;
                opacity: 0.9;
            }

            .nexus-kofi-amounts-list {
                display: flex;
                justify-content: center;
                gap: 1.5em;
                flex-wrap: wrap;
            }

            .nexus-kofi-amount {
                background: rgba(255, 255, 255, 0.2);
                padding: 0.5em 1em;
                border-radius: 20px;
                font-weight: 500;
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

