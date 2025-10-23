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

/**
 * Beautiful upgrade modal for v1.3.0 with prominent Ko-fi support
 */
export class NexusUpgradeModal130 extends Modal {
    private plugin: NexusAiChatImporterPlugin;
    private version: string;
    private resolve: (value: string) => void;

    constructor(app: App, plugin: NexusAiChatImporterPlugin, version: string, resolve: (value: string) => void) {
        super(app);
        this.plugin = plugin;
        this.version = version;
        this.resolve = resolve;
    }

    onOpen(): void {
        const { containerEl, titleEl } = this;

        // Add custom CSS class
        containerEl.classList.add('nexus-upgrade-modal-130');

        // Set title
        titleEl.setText(`🎉 Nexus AI Chat Importer ${this.version}`);
        this.modalEl.querySelector('.modal-close-button')?.remove();
        
        this.createForm();
    }

    async onClose() {
        this.contentEl.empty();
    }

    async createForm() {
        // Fallback message if GitHub fetch fails
        let message = `## 🎯 Welcome to v1.3.0!

**Selective Import** is here! You can now choose exactly which conversations to import.

### ✨ What's New

- **🎯 Selective Conversation Import**: Interactive dialog to choose which conversations to import
- **📊 Enhanced Reports**: Per-file statistics with detailed breakdown
- **🗂️ Flexible Folders**: Separate settings for conversations, attachments, and reports
- **🌍 International Support**: ISO 8601 timestamps work with all locales
- **🐛 26 Bug Fixes**: Improved stability and reliability

### 🔄 Automatic Migrations

The plugin will automatically:
- Migrate folder settings to new structure
- Update timestamps to ISO 8601 format
- Fix frontmatter aliases
- Move Reports folder to proper location

**No action required** - everything happens automatically!

---

### 💡 Tip

Try the new **selective import** feature on your next import - you'll love the control it gives you!`;

        try {
            // Try to fetch release notes from GitHub
            const response = await fetch('https://api.github.com/repos/Superkikim/nexus-ai-chat-importer/releases/tags/v1.3.0');
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

        // Add Ko-fi support section with prominent styling
        this.addKofiSection();

        // Add confirmation button
        this.addButtons();

        // Add custom styles
        this.addStyles();
    }

    private addKofiSection() {
        const kofiSection = this.contentEl.createDiv({ cls: "nexus-kofi-section" });
        
        // Header with emoji
        const header = kofiSection.createDiv({ cls: "nexus-kofi-header" });
        header.innerHTML = `
            <div class="nexus-kofi-title">
                ☕ <strong>Love this plugin?</strong>
            </div>
        `;

        // Message
        const message = kofiSection.createDiv({ cls: "nexus-kofi-message" });
        message.innerHTML = `
            <p>I build this plugin in my free time, as a labor of love. Development takes hundreds of hours.</p>
            <p><strong>If you find it valuable, please consider supporting its development!</strong></p>
        `;

        // Ko-fi button (larger and more prominent)
        const buttonContainer = kofiSection.createDiv({ cls: "nexus-kofi-button-container" });
        buttonContainer.innerHTML = `
            <a href="https://ko-fi.com/nexusplugins" target="_blank" class="nexus-kofi-link">
                <img src="https://storage.ko-fi.com/cdn/kofi6.png?v=6" alt="Buy Me a Coffee at ko-fi.com" height="50">
            </a>
        `;

        // Suggested amounts
        const amounts = kofiSection.createDiv({ cls: "nexus-kofi-amounts" });
        amounts.innerHTML = `
            <div class="nexus-kofi-amounts-title">Suggested amounts:</div>
            <div class="nexus-kofi-amounts-list">
                <span class="nexus-kofi-amount">☕ $5 - Coffee</span>
                <span class="nexus-kofi-amount">🤖 $25 - AI Tools</span>
                <span class="nexus-kofi-amount">🚀 $75 - Dev Toolkit</span>
            </div>
        `;

        // Stats to encourage donations
        const stats = kofiSection.createDiv({ cls: "nexus-kofi-stats" });
        stats.innerHTML = `
            <p class="nexus-kofi-stats-text">
                <em>Your support helps me dedicate more time to adding features, fixing bugs, and keeping this plugin free for everyone.</em>
            </p>
        `;
    }

    private addButtons() {
        const buttonContainer = this.contentEl.createDiv({ cls: "nexus-upgrade-buttons" });
        
        const btnOk = buttonContainer.createEl("button", {
            text: "Let's Go! 🚀",
            cls: "mod-cta nexus-btn-primary"
        });
        
        btnOk.onclick = () => {
            this.close();
            this.resolve("ok");
        };
    }

    private addStyles() {
        const styleEl = document.createElement("style");
        styleEl.textContent = `
            .nexus-upgrade-modal-130 .modal {
                max-width: 1050px;
            }

            .nexus-upgrade-content {
                margin-bottom: 20px;
                line-height: 1.6;
            }

            /* Ko-fi Section Styles */
            .nexus-kofi-section {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                border-radius: 12px;
                padding: 24px;
                margin: 24px 0;
                color: white;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            }

            .nexus-kofi-header {
                margin-bottom: 16px;
            }

            .nexus-kofi-title {
                font-size: 1.3em;
                text-align: center;
                color: white;
            }

            .nexus-kofi-title strong {
                color: #FFD700;
            }

            .nexus-kofi-message {
                text-align: center;
                margin-bottom: 20px;
            }

            .nexus-kofi-message p {
                margin: 8px 0;
                color: rgba(255, 255, 255, 0.95);
            }

            .nexus-kofi-message strong {
                color: #FFD700;
                font-size: 1.05em;
            }

            .nexus-kofi-button-container {
                text-align: center;
                margin: 20px 0;
            }

            .nexus-kofi-link {
                display: inline-block;
                transition: transform 0.2s ease;
            }

            .nexus-kofi-link:hover {
                transform: scale(1.05);
            }

            .nexus-kofi-link img {
                border-radius: 8px;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
            }

            .nexus-kofi-amounts {
                margin-top: 16px;
                padding-top: 16px;
                border-top: 1px solid rgba(255, 255, 255, 0.3);
            }

            .nexus-kofi-amounts-title {
                text-align: center;
                font-size: 0.9em;
                margin-bottom: 12px;
                color: rgba(255, 255, 255, 0.9);
            }

            .nexus-kofi-amounts-list {
                display: flex;
                justify-content: center;
                gap: 16px;
                flex-wrap: wrap;
            }

            .nexus-kofi-amount {
                background: rgba(255, 255, 255, 0.2);
                padding: 8px 16px;
                border-radius: 20px;
                font-size: 0.9em;
                font-weight: 500;
                backdrop-filter: blur(10px);
            }

            .nexus-kofi-stats {
                margin-top: 16px;
                padding-top: 16px;
                border-top: 1px solid rgba(255, 255, 255, 0.3);
            }

            .nexus-kofi-stats-text {
                text-align: center;
                font-size: 0.9em;
                color: rgba(255, 255, 255, 0.85);
                margin: 0;
            }

            /* Button Styles */
            .nexus-upgrade-buttons {
                text-align: right;
                margin-top: 24px;
                padding-top: 20px;
                border-top: 1px solid var(--background-modifier-border);
            }

            .nexus-btn-primary {
                padding: 10px 28px;
                font-size: 1.05em;
                font-weight: 600;
            }
        `;
        document.head.appendChild(styleEl);
    }
}

