// src/services/storage-service.ts
import { ConversationCatalogEntry } from "../types/plugin";
import { DEFAULT_SETTINGS } from "../config/constants";
import type NexusAiChatImporterPlugin from "../main";

export class StorageService {
    private importedArchives: Record<string, { fileName: string; date: string }> = {};
    private conversationCatalog: Record<string, ConversationCatalogEntry> = {};
    private conversationsByPath: Map<string, string> = new Map(); // path -> conversationId index
    private isDirty = false; // Track if data needs saving
    private saveTimeout: number | null = null;

    constructor(private plugin: NexusAiChatImporterPlugin) {}

    loadCatalogs(data: any) {
        this.importedArchives = data?.importedArchives || {};
        this.conversationCatalog = data?.conversationCatalog || {};
        this.rebuildIndex();
        this.isDirty = false;
    }

    private rebuildIndex() {
        // Build path index for faster lookups
        this.conversationsByPath.clear();
        for (const [id, entry] of Object.entries(this.conversationCatalog)) {
            this.conversationsByPath.set(entry.path, id);
        }
    }

    async saveData(data: any) {
        try {
            await this.plugin.saveData(data);
            this.isDirty = false;
        } catch (error) {
            this.plugin.logger.error("Error saving settings", error);
        }
    }

    // Batch save to avoid frequent disk writes
    private debouncedSave() {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }
        
        this.saveTimeout = window.setTimeout(async () => {
            if (this.isDirty) {
                await this.plugin.saveSettings();
            }
        }, 1000); // Save after 1 second of inactivity
    }

    getImportedArchives() {
        return this.importedArchives;
    }

    getConversationCatalog() {
        return this.conversationCatalog;
    }

    // Fast lookup by path
    getConversationByPath(path: string): ConversationCatalogEntry | undefined {
        const id = this.conversationsByPath.get(path);
        return id ? this.conversationCatalog[id] : undefined;
    }

    // Get all conversations for a specific provider
    getConversationsByProvider(provider: string): ConversationCatalogEntry[] {
        return Object.values(this.conversationCatalog).filter(entry => entry.provider === provider);
    }

    isArchiveImported(fileHash: string): boolean {
        return !!this.importedArchives[fileHash];
    }

    addImportedArchive(fileHash: string, fileName: string) {
        this.importedArchives[fileHash] = {
            fileName,
            date: new Date().toISOString()
        };
        this.isDirty = true;
        this.debouncedSave();
    }

    updateConversationCatalog(id: string, entry: ConversationCatalogEntry) {
        // Remove old path index if updating existing entry
        const oldEntry = this.conversationCatalog[id];
        if (oldEntry && oldEntry.path !== entry.path) {
            this.conversationsByPath.delete(oldEntry.path);
        }

        this.conversationCatalog[id] = entry;
        this.conversationsByPath.set(entry.path, id);
        this.isDirty = true;
        this.debouncedSave();
    }

    deleteFromConversationCatalog(id: string) {
        const entry = this.conversationCatalog[id];
        if (entry) {
            this.conversationsByPath.delete(entry.path);
            delete this.conversationCatalog[id];
            this.isDirty = true;
            this.debouncedSave();
        }
    }

    // Bulk operations for better performance during imports
    batchUpdateConversations(updates: Array<{id: string, entry: ConversationCatalogEntry}>) {
        for (const {id, entry} of updates) {
            const oldEntry = this.conversationCatalog[id];
            if (oldEntry && oldEntry.path !== entry.path) {
                this.conversationsByPath.delete(oldEntry.path);
            }
            this.conversationCatalog[id] = entry;
            this.conversationsByPath.set(entry.path, id);
        }
        this.isDirty = true;
        this.debouncedSave();
    }

    async resetCatalogs() {
        this.importedArchives = {};
        this.conversationCatalog = {};
        this.conversationsByPath.clear();
        this.isDirty = false;
        
        // Clear any pending saves
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
            this.saveTimeout = null;
        }
        
        await this.plugin.saveData({});
    }

    // Statistics for debugging performance
    getStats() {
        return {
            totalArchives: Object.keys(this.importedArchives).length,
            totalConversations: Object.keys(this.conversationCatalog).length,
            indexSize: this.conversationsByPath.size,
            isDirty: this.isDirty
        };
    }

    // Force immediate save (use sparingly)
    async forceSave() {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
            this.saveTimeout = null;
        }
        if (this.isDirty) {
            await this.plugin.saveSettings();
        }
    }
}