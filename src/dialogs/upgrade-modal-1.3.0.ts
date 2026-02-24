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
import { createSupportBox } from "../ui/components/support-box";
import { t } from '../i18n';

/**
 * Upgrade modal for v1.3.0 with support section
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
        titleEl.setText(t('upgrade.modal_130.title', { version: this.version }));
        this.modalEl.querySelector('.modal-close-button')?.remove();

        this.createForm();
    }

    onClose(): void {
        // If user closed dialog without clicking button, resolve with "cancel"
        if (!this.hasResolved) {
            this.resolve("cancel");
        }
        this.contentEl.empty();
    }

    async createForm() {
        // Add support section FIRST (at the top) - using reusable component
        createSupportBox(this.contentEl);

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



    private addMigrationSection() {
        const migrationSection = this.contentEl.createDiv({ cls: "nexus-migration-section" });

        // Header
        const header = migrationSection.createDiv({ cls: "nexus-migration-header" });
        header.innerHTML = `
            <div class="nexus-migration-title">
                ${t('upgrade.modal_130.migration_section.title')}
            </div>
        `;

        // Message
        const message = migrationSection.createDiv({ cls: "nexus-migration-message" });
        message.innerHTML = `
            <p>${t('upgrade.modal_130.migration_section.message')}</p>
        `;

        // Task list
        const taskList = migrationSection.createDiv({ cls: "nexus-migration-tasks" });
        taskList.innerHTML = `
            <ul>
                <li>${t('upgrade.modal_130.migration_section.tasks.folder_settings')}</li>
                <li>${t('upgrade.modal_130.migration_section.tasks.timestamps')}</li>
                <li>${t('upgrade.modal_130.migration_section.tasks.aliases')}</li>
                <li>${t('upgrade.modal_130.migration_section.tasks.reports')}</li>
                <li>${t('upgrade.modal_130.migration_section.tasks.artifacts')}</li>
            </ul>
        `;

        // Estimated time
        const estimate = migrationSection.createDiv({ cls: "nexus-migration-estimate" });
        estimate.innerHTML = `
            <p><em>${t('upgrade.modal_130.migration_section.estimate')}</em></p>
        `;
    }

    private addMigrationButton() {
        const buttonContainer = this.contentEl.createDiv({ cls: "nexus-migration-button-container" });

        const migrationButton = buttonContainer.createEl("button", {
            text: t('upgrade.modal_130.buttons.run_migration'),
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

