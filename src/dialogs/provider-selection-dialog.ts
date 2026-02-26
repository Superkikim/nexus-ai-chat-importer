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


// src/dialogs/provider-selection-dialog.ts
import { App, Modal, Setting } from "obsidian";
import { ProviderRegistry } from "../providers/provider-adapter";
import { t } from '../i18n';

export interface ProviderInfo {
    id: string;
    name: string;
    description: string;
    fileFormats: string[];
}

export class ProviderSelectionDialog extends Modal {
    private selectedProvider: string | null = null;
    private onProviderSelected: (provider: string) => void;
    private providers: ProviderInfo[];

    constructor(
        app: App, 
        providerRegistry: ProviderRegistry,
        onProviderSelected: (provider: string) => void
    ) {
        super(app);
        this.onProviderSelected = onProviderSelected;
        this.providers = this.getAvailableProviders(providerRegistry);
    }

    private getAvailableProviders(registry: ProviderRegistry): ProviderInfo[] {
        // Get available providers from registry
        const providers: ProviderInfo[] = [];
        
        // ChatGPT
        if (registry.getAdapter("chatgpt")) {
            providers.push({
                id: "chatgpt",
                name: t('provider_selection.providers.chatgpt.name'),
                description: t('provider_selection.providers.chatgpt.description'),
                fileFormats: [t('provider_selection.providers.chatgpt.file_formats_0')]
            });
        }

        // Claude
        if (registry.getAdapter("claude")) {
            providers.push({
                id: "claude",
                name: t('provider_selection.providers.claude.name'),
                description: t('provider_selection.providers.claude.description'),
                fileFormats: [
                    t('provider_selection.providers.claude.file_formats_0'),
                    t('provider_selection.providers.claude.file_formats_1')
                ]
            });
        }

        // Le Chat
        if (registry.getAdapter("lechat")) {
            providers.push({
                id: "lechat",
                name: t('provider_selection.providers.lechat.name'),
                description: t('provider_selection.providers.lechat.description'),
                fileFormats: [t('provider_selection.providers.lechat.file_formats_0')]
            });
        }

        // Gemini - Temporarily disabled for v1.4.0 (complex export format)
        // Will be re-enabled in future release after additional testing and validation
        // if (registry.getAdapter("gemini")) {
        //     providers.push({
        //         id: "gemini",
        //         name: "Gemini",
        //         description: "Google Gemini Apps (Takeout My Activity) exports",
        //         fileFormats: ["Takeout/.../Gemini.../My Activity.json"]
        //     });
        // }

        return providers;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        // Title
        contentEl.createEl("h2", { text: t('provider_selection.title') });

        // Provider selection
        this.providers.forEach(provider => {
            new Setting(contentEl)
                .setName(provider.name)
                .setDesc(this.createProviderDescription(provider))
                .addButton(button => {
                    button
                        .setButtonText(t('provider_selection.buttons.select'))
                        .setCta()
                        .onClick(() => {
                            this.selectedProvider = provider.id;
                            this.close();
                            this.onProviderSelected(provider.id);
                        });
                });
        });

        // Cancel button
        const buttonContainer = contentEl.createDiv();
        buttonContainer.style.textAlign = "center";
        buttonContainer.style.marginTop = "20px";

        const cancelButton = buttonContainer.createEl("button", { text: t('provider_selection.buttons.cancel') });
        cancelButton.style.marginRight = "10px";
        cancelButton.onclick = () => this.close();
    }

    private createProviderDescription(provider: ProviderInfo): string {
        return provider.description;
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
