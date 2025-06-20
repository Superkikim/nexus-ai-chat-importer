// src/commands/command-registry.ts
import { Modal } from "obsidian";
import type NexusAiChatImporterPlugin from "../main";

export class CommandRegistry {
    constructor(private plugin: NexusAiChatImporterPlugin) {}

    registerCommands() {
        this.plugin.addCommand({
            id: "nexus-ai-chat-importer-select-zip",
            name: "Select ZIP file to process",
            callback: () => {
                this.plugin.getImportService().selectZipFile();
            },
        });

        this.plugin.addCommand({
            id: "reset-nexus-ai-chat-importer-catalogs",
            name: "Reset catalogs",
            callback: () => {
                this.showResetConfirmation();
            },
        });
    }

    private showResetConfirmation() {
        const modal = new Modal(this.plugin.app);
        modal.contentEl.createEl("p", {
            text: "This will reset all import catalogs. This action cannot be undone.",
        });
        
        const buttonDiv = modal.contentEl.createEl("div", {
            cls: "modal-button-container",
        });
        
        buttonDiv
            .createEl("button", { text: "Cancel" })
            .addEventListener("click", () => modal.close());
        
        buttonDiv
            .createEl("button", { text: "Reset", cls: "mod-warning" })
            .addEventListener("click", () => {
                this.plugin.resetCatalogs();
                modal.close();
            });
        
        modal.open();
    }
}