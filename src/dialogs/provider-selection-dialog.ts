// src/dialogs/provider-selection-dialog.ts
import { App, Modal, Setting } from "obsidian";
import { ProviderRegistry } from "../providers/provider-adapter";

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
                name: "ChatGPT",
                description: "OpenAI ChatGPT conversation exports",
                fileFormats: ["conversations.json only"]
            });
        }
        
        // Claude
        if (registry.getAdapter("claude")) {
            providers.push({
                id: "claude",
                name: "Claude",
                description: "Anthropic Claude conversation exports",
                fileFormats: ["conversations.json + users.json", "projects.json (optional)"]
            });
        }
        
        return providers;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        // Title
        contentEl.createEl("h2", { text: "Select AI Provider" });
        
        // Description
        const description = contentEl.createEl("p");
        description.innerHTML = `
            Choose the AI provider that generated your conversation export file(s).<br>
            This ensures proper processing and organization of your conversations.
        `;
        description.style.marginBottom = "20px";
        description.style.color = "var(--text-muted)";

        // Provider selection
        this.providers.forEach(provider => {
            new Setting(contentEl)
                .setName(provider.name)
                .setDesc(this.createProviderDescription(provider))
                .addButton(button => {
                    button
                        .setButtonText("Select")
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
        
        const cancelButton = buttonContainer.createEl("button", { text: "Cancel" });
        cancelButton.style.marginRight = "10px";
        cancelButton.onclick = () => this.close();
    }

    private createProviderDescription(provider: ProviderInfo): string {
        const formats = provider.fileFormats.join(", ");
        return `${provider.description}\n\nExpected files: ${formats}`;
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
