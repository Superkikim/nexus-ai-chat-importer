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
        this.plugin.logger.info("=== STORAGE SERVICE - LOAD CATALOGS START ===");

        try {
            this.importedArchives = data?.importedArchives || {};
            this.conversationCatalog = data?.conversationCatalog || {};
            this.isDirty = false;

            this.plugin.logger.info(`Imported archives: ${Object.keys(this.importedArchives).length}`);
            this.plugin.logger.info(`Conversation catalog: ${Object.keys(this.conversationCatalog).length}`);
            this.plugin.logger.info("=== STORAGE SERVICE - LOAD CATALOGS COMPLETED ===");
        } catch (error) {
            this.plugin.logger.error("loadCatalogs failed:", error);
            throw error;
        }
    }

    private rebuildIndex() {
        const rebuildStart = performance.now();
        this.plugin.logger.info("=== REBUILDING PATH INDEX ===");
        
        try {
            // Clear existing index
            const clearStart = performance.now();
            this.conversationsByPath.clear();
            const clearEnd = performance.now();
            this.plugin.logger.info(`Index cleared in ${clearEnd - clearStart}ms`);
            
            // Rebuild index
            const buildStart = performance.now();
            let processedCount = 0;
            const totalCount = Object.keys(this.conversationCatalog).length;
            
            for (const [id, entry] of Object.entries(this.conversationCatalog)) {
                this.conversationsByPath.set(entry.path, id);
                processedCount++;
                
                // Log progress every 1000 entries
                if (processedCount % 1000 === 0) {
                    this.plugin.logger.info(`Index rebuild progress: ${processedCount}/${totalCount} (${((processedCount/totalCount)*100).toFixed(1)}%)`);
                }
            }
            
            const buildEnd = performance.now();
            this.plugin.logger.info(`Index rebuilt with ${processedCount} entries in ${buildEnd - buildStart}ms`);
            
            const rebuildEnd = performance.now();
            this.plugin.logger.info(`=== INDEX REBUILD COMPLETED in ${rebuildEnd - rebuildStart}ms ===`);
            
        } catch (error) {
            const rebuildEnd = performance.now();
            this.plugin.logger.error(`rebuildIndex failed after ${rebuildEnd - rebuildStart}ms:`, error);
            throw error;
        }
    }

    async saveData(data: any) {
        const saveStart = performance.now();
        
        try {
            const stats = this.getStats();
            this.plugin.logger.info(`Saving data with stats:`, stats);
            
            await this.plugin.saveData(data);
            this.isDirty = false;
            
            const saveEnd = performance.now();
            this.plugin.logger.info(`Data saved in ${saveEnd - saveStart}ms`);
            
        } catch (error) {
            const saveEnd = performance.now();
            this.plugin.logger.error(`saveData failed after ${saveEnd - saveStart}ms:`, error);
        }
    }

    // Batch save to avoid frequent disk writes
    private debouncedSave() {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }
        
        this.saveTimeout = window.setTimeout(async () => {
            if (this.isDirty) {
                const saveStart = performance.now();
                await this.plugin.saveSettings();
                const saveEnd = performance.now();
                this.plugin.logger.info(`Debounced save completed in ${saveEnd - saveStart}ms`);
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
        const lookupStart = performance.now();
        const id = this.conversationsByPath.get(path);
        const result = id ? this.conversationCatalog[id] : undefined;
        const lookupEnd = performance.now();
        
        // Only log slow lookups
        if (lookupEnd - lookupStart > 1) {
            this.plugin.logger.info(`Slow path lookup took ${lookupEnd - lookupStart}ms for: ${path}`);
        }
        
        return result;
    }

    // Get all conversations for a specific provider
    getConversationsByProvider(provider: string): ConversationCatalogEntry[] {
        const filterStart = performance.now();
        const results = Object.values(this.conversationCatalog).filter(entry => entry.provider === provider);
        const filterEnd = performance.now();
        
        this.plugin.logger.info(`Provider filter (${provider}) took ${filterEnd - filterStart}ms, found ${results.length} conversations`);
        return results;
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
        const updateStart = performance.now();
        
        // Remove old path index if updating existing entry
        const oldEntry = this.conversationCatalog[id];
        if (oldEntry && oldEntry.path !== entry.path) {
            this.conversationsByPath.delete(oldEntry.path);
        }

        this.conversationCatalog[id] = entry;
        this.conversationsByPath.set(entry.path, id);
        this.isDirty = true;
        this.debouncedSave();
        
        const updateEnd = performance.now();
        if (updateEnd - updateStart > 1) {
            this.plugin.logger.info(`Slow catalog update took ${updateEnd - updateStart}ms for: ${id}`);
        }
    }

    deleteFromConversationCatalog(id: string) {
        const deleteStart = performance.now();
        
        const entry = this.conversationCatalog[id];
        if (entry) {
            this.conversationsByPath.delete(entry.path);
            delete this.conversationCatalog[id];
            this.isDirty = true;
            this.debouncedSave();
        }
        
        const deleteEnd = performance.now();
        if (deleteEnd - deleteStart > 1) {
            this.plugin.logger.info(`Slow catalog delete took ${deleteEnd - deleteStart}ms for: ${id}`);
        }
    }

    // Bulk operations for better performance during imports
    batchUpdateConversations(updates: Array<{id: string, entry: ConversationCatalogEntry}>) {
        const batchStart = performance.now();
        this.plugin.logger.info(`Starting batch update of ${updates.length} conversations`);
        
        let processedCount = 0;
        for (const {id, entry} of updates) {
            const oldEntry = this.conversationCatalog[id];
            if (oldEntry && oldEntry.path !== entry.path) {
                this.conversationsByPath.delete(oldEntry.path);
            }
            this.conversationCatalog[id] = entry;
            this.conversationsByPath.set(entry.path, id);
            
            processedCount++;
            if (processedCount % 100 === 0) {
                this.plugin.logger.info(`Batch update progress: ${processedCount}/${updates.length}`);
            }
        }
        
        this.isDirty = true;
        this.debouncedSave();
        
        const batchEnd = performance.now();
        this.plugin.logger.info(`Batch update completed in ${batchEnd - batchStart}ms`);
    }

    async resetCatalogs() {
        const resetStart = performance.now();
        this.plugin.logger.info("=== RESETTING CATALOGS ===");
        
        try {
            // Step 1: Clear data structures
            const clearStart = performance.now();
            this.importedArchives = {};
            this.conversationCatalog = {};
            this.conversationsByPath.clear();
            const clearEnd = performance.now();
            this.plugin.logger.info(`Data structures cleared in ${clearEnd - clearStart}ms`);
            
            // Step 2: Cancel pending saves
            this.isDirty = false;
            if (this.saveTimeout) {
                clearTimeout(this.saveTimeout);
                this.saveTimeout = null;
            }
            
            // Step 3: Save empty data
            const saveStart = performance.now();
            await this.plugin.saveData({
                settings: this.plugin.settings  // Keep settings, only clear catalogs
            });
            const saveEnd = performance.now();
            this.plugin.logger.info(`Empty data saved in ${saveEnd - saveStart}ms`);
            
            const resetEnd = performance.now();
            this.plugin.logger.info(`=== CATALOGS RESET COMPLETED in ${resetEnd - resetStart}ms ===`);
            
        } catch (error) {
            const resetEnd = performance.now();
            this.plugin.logger.error(`resetCatalogs failed after ${resetEnd - resetStart}ms:`, error);
        }
    }

    // Statistics for debugging performance
    getStats() {
        const stats = {
            totalArchives: Object.keys(this.importedArchives).length,
            totalConversations: Object.keys(this.conversationCatalog).length,
            indexSize: this.conversationsByPath.size,
            isDirty: this.isDirty,
            hasPendingSave: this.saveTimeout !== null
        };
        
        return stats;
    }

    // Force immediate save (use sparingly)
    async forceSave() {
        const forceStart = performance.now();
        
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
            this.saveTimeout = null;
        }
        if (this.isDirty) {
            await this.plugin.saveSettings();
        }
        
        const forceEnd = performance.now();
        this.plugin.logger.info(`Force save completed in ${forceEnd - forceStart}ms`);
    }
}