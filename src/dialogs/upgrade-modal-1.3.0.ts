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
    private hasResolved: boolean = false;

    constructor(app: App, plugin: NexusAiChatImporterPlugin, version: string, resolve: (value: string) => void) {
        super(app);
        this.plugin = plugin;
        this.version = version;
        this.resolve = resolve;
    }

    onOpen(): void {
        const { containerEl, titleEl, modalEl } = this;

        // Add custom CSS class to modal element
        modalEl.classList.add('nexus-upgrade-modal-130');

        // Set title
        titleEl.setText(`🎉 Nexus AI Chat Importer ${this.version}`);
        this.modalEl.querySelector('.modal-close-button')?.remove();

        this.createForm();
    }

    onClose(): void {
        // If user closed dialog without clicking button, resolve with "cancel"
        if (!this.hasResolved) {
            this.resolve("cancel");
        }
    }

    async onClose() {
        this.contentEl.empty();
    }

    async createForm() {
        // Add Ko-fi support section FIRST (at the top)
        this.addKofiSection();

        // Add migration info section
        this.addMigrationSection();

        // Add migration button (centered and prominent)
        this.addMigrationButton();

        // Fallback message if GitHub fetch fails
        let message = `## ✨ What's New in v1.3.0

- **🎯 Selective Conversation Import**: Interactive dialog to choose which conversations to import
- **📊 Enhanced Reports**: Per-file statistics with detailed breakdown
- **🗂️ Flexible Folders**: Separate settings for conversations, attachments, and reports
- **🌍 International Support**: ISO 8601 timestamps work with all locales
- **🐛 26 Bug Fixes**: Improved stability and reliability

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

        // Add custom styles
        this.addStyles();
    }

    private addKofiSection() {
        const kofiSection = this.contentEl.createDiv({ cls: "nexus-kofi-section" });

        // Header with emoji
        const header = kofiSection.createDiv({ cls: "nexus-kofi-header" });
        header.innerHTML = `
            <div class="nexus-kofi-title">
                ☕ <strong>Support This Plugin</strong>
            </div>
        `;

        // Message with reality check
        const message = kofiSection.createDiv({ cls: "nexus-kofi-message" });
        message.innerHTML = `
            <p>I'm working on Nexus projects full-time while unemployed and dealing with health issues.</p>
            <p><strong>Over 1,000 users so far, but I've received just $10 in donations while paying $200/month out of pocket in expenses.</strong></p>
            <p>If this plugin makes your life easier, a donation would mean the world and help keep it alive.</p>
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

        // Reality check
        const stats = kofiSection.createDiv({ cls: "nexus-kofi-stats" });
        stats.innerHTML = `
            <p class="nexus-kofi-stats-text">
                <em>Reality check: Thousands of downloads, but only 2 donations totaling $10. If you use it regularly, please consider contributing. Even $5 makes a difference! 🙏</em>
            </p>
        `;
    }

    private addMigrationSection() {
        const migrationSection = this.contentEl.createDiv({ cls: "nexus-migration-section" });

        // Header
        const header = migrationSection.createDiv({ cls: "nexus-migration-header" });
        header.innerHTML = `
            <div class="nexus-migration-title">
                🔄 <strong>Migration Required</strong>
            </div>
        `;

        // Message
        const message = migrationSection.createDiv({ cls: "nexus-migration-message" });
        message.innerHTML = `
            <p>The following tasks will run automatically to upgrade your data to v1.3.0:</p>
        `;

        // Task list
        const taskList = migrationSection.createDiv({ cls: "nexus-migration-tasks" });
        taskList.innerHTML = `
            <ul>
                <li>✓ Migrate folder settings to new structure</li>
                <li>✓ Update timestamps to ISO 8601 format</li>
                <li>✓ Fix frontmatter aliases</li>
                <li>✓ Move Reports folder to proper location</li>
                <li>✓ Update artifact metadata</li>
            </ul>
        `;

        // Estimated time
        const estimate = migrationSection.createDiv({ cls: "nexus-migration-estimate" });
        estimate.innerHTML = `
            <p><em>This will take a few seconds.</em></p>
        `;
    }

    private addMigrationButton() {
        const buttonContainer = this.contentEl.createDiv({ cls: "nexus-migration-button-container" });

        const migrationButton = buttonContainer.createEl("button", {
            text: "🚀 Run Migration Tasks",
            cls: "mod-cta nexus-migration-button"
        });

        migrationButton.onclick = () => {
            this.hasResolved = true;
            this.resolve("ok");
            this.close();
        };
    }

    private addStyles() {
        const styleEl = document.createElement("style");
        styleEl.textContent = `
            .modal.nexus-upgrade-modal-130 {
                max-width: 1050px !important;
                width: 1050px !important;
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

            /* Migration Section Styles */
            .nexus-migration-section {
                background: var(--background-secondary);
                border: 2px solid var(--interactive-accent);
                border-radius: 12px;
                padding: 24px;
                margin: 24px 0;
            }

            .nexus-migration-header {
                margin-bottom: 16px;
            }

            .nexus-migration-title {
                font-size: 1.3em;
                text-align: center;
                color: var(--text-normal);
            }

            .nexus-migration-title strong {
                color: var(--interactive-accent);
            }

            .nexus-migration-message {
                text-align: center;
                margin-bottom: 16px;
                color: var(--text-muted);
            }

            .nexus-migration-tasks {
                margin: 16px 0;
            }

            .nexus-migration-tasks ul {
                list-style: none;
                padding: 0;
                margin: 0;
            }

            .nexus-migration-tasks li {
                padding: 8px 0;
                font-size: 0.95em;
                color: var(--text-normal);
            }

            .nexus-migration-estimate {
                text-align: center;
                margin-top: 16px;
                color: var(--text-muted);
                font-size: 0.9em;
            }

            /* Migration Button Styles */
            .nexus-migration-button-container {
                text-align: center;
                margin: 32px 0;
            }

            .nexus-migration-button {
                padding: 16px 48px !important;
                font-size: 1.2em !important;
                font-weight: 700 !important;
                border-radius: 8px !important;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
                transition: all 0.2s ease !important;
            }

            .nexus-migration-button:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2) !important;
            }
        `;
        document.head.appendChild(styleEl);
    }
}

