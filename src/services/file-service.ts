// src/services/file-service.ts
import { TFile, TFolder } from "obsidian";
import type NexusAiChatImporterPlugin from "../main";

export class FileService {
    constructor(private plugin: NexusAiChatImporterPlugin) {}

    async writeToFile(filePath: string, content: string): Promise<void> {
        try {
            const file = this.plugin.app.vault.getAbstractFileByPath(filePath);

            if (file instanceof TFile) {
                await this.plugin.app.vault.modify(file, content);
            } else if (file instanceof TFolder) {
                throw new Error(`Cannot write to '${filePath}'; it is a folder.`);
            } else {
                await this.plugin.app.vault.create(filePath, content);
            }
        } catch (error: any) {
            this.plugin.logger.error(`Error creating or modifying file '${filePath}'`, error.message);
            throw error;
        }
    }
}