// src/events/event-handlers.ts
import { TFile } from "obsidian";
import type NexusAiChatImporterPlugin from "../main";

export class EventHandlers {
    constructor(private plugin: NexusAiChatImporterPlugin) {}

    registerEvents() {
        // Handle file deletion - remove from conversation catalog
        this.plugin.registerEvent(
            this.plugin.app.vault.on("delete", async (file) => {
                if (file instanceof TFile) {
                    await this.plugin.getFileService().handleConversationFileDeletion(file);
                }
            })
        );
    }

    cleanup() {
        // No cleanup needed - Obsidian handles event unregistration
    }
}