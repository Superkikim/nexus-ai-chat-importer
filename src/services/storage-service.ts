// src/services/storage-service.ts
import { ConversationCatalogEntry } from "../types";
import { DEFAULT_SETTINGS } from "../config/constants";
import type NexusAiChatImporterPlugin from "../main";

export class StorageService {
    private importedArchives: Record<string, { fileName: string; date: string }> = {};
    private conversationCatalog: Record<string, ConversationCatalogEntry> = {};

    constructor(private plugin: NexusAiChatImporterPlugin) {}

    loadCatalogs(data: any) {
        this.importedArchives = data?.importedArchives || {};
        this.conversationCatalog = data?.conversationCatalog || {};
    }

    async saveData(data: any) {
        try {
            await this.plugin.saveData(data);
        } catch (error) {
            this.plugin.logger.error("Error saving settings", error);
        }
    }

    getImportedArchives() {
        return this.importedArchives;
    }

    getConversationCatalog() {
        return this.conversationCatalog;
    }

    isArchiveImported(fileHash: string): boolean {
        return !!this.importedArchives[fileHash];
    }

    addImportedArchive(fileHash: string, fileName: string) {
        this.importedArchives[fileHash] = {
            fileName,
            date: new Date().toISOString()
        };
    }

    updateConversationCatalog(id: string, entry: ConversationCatalogEntry) {
        this.conversationCatalog[id] = entry;
    }

    deleteFromConversationCatalog(id: string) {
        delete this.conversationCatalog[id];
    }

    async resetCatalogs() {
        this.importedArchives = {};
        this.conversationCatalog = {};
        this.plugin.settings = Object.assign({}, DEFAULT_SETTINGS);
        await this.plugin.saveData({});
    }
}