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
 * Universal template for new version announcements
 * Shows Ko-fi + What's New + Close button
 */
export class NewVersionModal extends Modal {
    private plugin: NexusAiChatImporterPlugin;
    private version: string;
    private fallbackMessage: string;
    private githubTag: string;

    constructor(
        app: App, 
        plugin: NexusAiChatImporterPlugin, 
        version: string, 
        fallbackMessage: string,
        githubTag?: string
    ) {
        super(app);
        this.plugin = plugin;
        this.version = version;
        this.fallbackMessage = fallbackMessage;
        this.githubTag = githubTag || version; // Default to version if not specified
    }

    onOpen(): void {
        const { titleEl, modalEl } = this;

        // Add custom CSS class to modal element
        modalEl.classList.add('nexus-new-version-modal');

        // Set title
        titleEl.setText(`🎉 Nexus AI Chat Importer ${this.version}`);

        this.createForm();
    }

    onClose(): void {
        this.contentEl.empty();
    }

    async createForm() {
        // Add Ko-fi support section FIRST (at the top) - using reusable component
        createKofiSupportBox(this.contentEl);

        let message = this.fallbackMessage;

        try {
            // Try to fetch release notes from GitHub
            const response = await fetch(`https://api.github.com/repos/Superkikim/nexus-ai-chat-importer/releases/tags/${this.githubTag}`);
            if (response.ok) {
                const release = await response.json();
                if (release.body) {
                    message = release.body;
                }
            }
        } catch (error) {
            // Use fallback message if GitHub fetch fails
        }

        // Render markdown content
        const contentDiv = this.contentEl.createDiv({ cls: "nexus-upgrade-content" });
        await MarkdownRenderer.render(
            this.app,
            message,
            contentDiv,
            "",
            this.plugin,
        );

        // Add close button (centered and prominent)
        this.addCloseButton();

        // Add custom styles
        this.addStyles();
    }

    private addCloseButton() {
        const buttonContainer = this.contentEl.createDiv({ cls: "nexus-close-button-container" });

        const closeButton = buttonContainer.createEl("button", {
            text: "Got it!",
            cls: "mod-cta nexus-close-button"
        });

        closeButton.onclick = () => {
            this.close();
        };
    }

    private addStyles() {
        const styleEl = document.createElement("style");
        styleEl.textContent = `
            .modal.nexus-new-version-modal {
                max-width: 1050px !important;
                width: 1050px !important;
            }

            .nexus-upgrade-content {
                margin-bottom: 20px;
                line-height: 1.6;
            }

            /* Close Button Styles */
            .nexus-close-button-container {
                text-align: center;
                margin: 32px 0;
            }

            .nexus-close-button {
                padding: 16px 48px !important;
                font-size: 1.2em !important;
                font-weight: 700 !important;
                border-radius: 8px !important;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
                transition: all 0.2s ease !important;
            }

            .nexus-close-button:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2) !important;
            }
        `;
        document.head.appendChild(styleEl);
    }
}

