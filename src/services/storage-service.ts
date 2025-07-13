// src/services/storage-service.ts
import { ConversationCatalogEntry } from "../types/plugin";
import type NexusAiChatImporterPlugin from "../main";

export class StorageService {
    private importedArchives: Record<string, { fileName: string; date: string }> = {};
    private isDirty = false;
    private saveTimeout: number | null = null;

    constructor(private plugin: NexusAiChatImporterPlugin) {}

    async loadData() {
        try {
            const data = await this.plugin.loadData();
            this.importedArchives = data?.importedArchives || {};
            this.isDirty = false;
            
            // Migration: If old catalog exists, we ignore it (migration handled in upgrade.ts)
            if (data?.conversationCatalog) {
                this.plugin.logger.info("Legacy conversation catalog detected - will be migrated in upgrade process");
            }
            
            this.plugin.logger.info("Storage data loaded successfully (archive hashes only)");
        } catch (error) {
            this.plugin.logger.error("loadData failed:", error);
            throw error;
        }
    }

    async saveData(data: any) {
        try {
            await this.plugin.saveData(data);
            this.isDirty = false;
        } catch (error) {
            this.plugin.logger.error("saveData failed:", error);
        }
    }

    private debouncedSave() {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }
        
        this.saveTimeout = window.setTimeout(async () => {
            if (this.isDirty) {
                await this.plugin.saveSettings();
            }
        }, 1000);
    }

    // ========================================
    // ARCHIVE HASH TRACKING (Keep - Small Data)
    // ========================================
    
    getImportedArchives() {
        return this.importedArchives;
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

    // ========================================
    // NEW: VAULT-BASED CONVERSATION DISCOVERY
    // ========================================

    /**
     * Scan vault for existing Nexus conversations using frontmatter
     * This replaces the persistent conversation catalog
     */
    async scanExistingConversations(): Promise<Map<string, ConversationCatalogEntry>> {
        const conversations = new Map<string, ConversationCatalogEntry>();
        const files = this.plugin.app.vault.getMarkdownFiles();
        
        for (const file of files) {
            const frontmatter = this.plugin.app.metadataCache.getFileCache(file)?.frontmatter;
            
            // Check if this is a Nexus conversation file
            if (frontmatter?.nexus === this.plugin.manifest.id && frontmatter?.conversation_id) {
                const entry: ConversationCatalogEntry = {
                    conversationId: frontmatter.conversation_id,
                    provider: frontmatter.provider || 'unknown',
                    path: file.path,
                    updateTime: this.parseUpdateTime(frontmatter.update_time),
                    create_time: this.parseCreateTime(frontmatter.create_time),
                    update_time: this.parseUpdateTime(frontmatter.update_time)
                };
                
                conversations.set(frontmatter.conversation_id, entry);
            }
        }
        
        this.plugin.logger.info(`Scanned vault: found ${conversations.size} existing Nexus conversations`);
        return conversations;
    }

    /**
     * Fast check if a specific conversation exists
     */
    async conversationExists(conversationId: string): Promise<boolean> {
        const files = this.plugin.app.vault.getMarkdownFiles();
        
        for (const file of files) {
            const frontmatter = this.plugin.app.metadataCache.getFileCache(file)?.frontmatter;
            if (frontmatter?.nexus === this.plugin.manifest.id && 
                frontmatter?.conversation_id === conversationId) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * Get conversation entry by ID (single lookup)
     */
    async getConversationById(conversationId: string): Promise<ConversationCatalogEntry | null> {
        const files = this.plugin.app.vault.getMarkdownFiles();
        
        for (const file of files) {
            const frontmatter = this.plugin.app.metadataCache.getFileCache(file)?.frontmatter;
            if (frontmatter?.nexus === this.plugin.manifest.id && 
                frontmatter?.conversation_id === conversationId) {
                
                return {
                    conversationId: frontmatter.conversation_id,
                    provider: frontmatter.provider || 'unknown',
                    path: file.path,
                    updateTime: this.parseUpdateTime(frontmatter.update_time),
                    create_time: this.parseCreateTime(frontmatter.create_time),
                    update_time: this.parseUpdateTime(frontmatter.update_time)
                };
            }
        }
        
        return null;
    }

    /**
     * Get conversations by provider (for reporting/stats)
     */
    async getConversationsByProvider(provider: string): Promise<ConversationCatalogEntry[]> {
        const allConversations = await this.scanExistingConversations();
        return Array.from(allConversations.values()).filter(entry => entry.provider === provider);
    }

    // ========================================
    // UTILITY METHODS
    // ========================================

    private parseUpdateTime(timeStr: string): number {
        if (!timeStr) return 0;
        
        // Handle different time formats from frontmatter
        // "2024-07-01 at 10:30 AM" -> parse to unix timestamp
        const date = new Date(timeStr.replace(' at ', ' '));
        return Math.floor(date.getTime() / 1000);
    }

    private parseCreateTime(timeStr: string): number {
        return this.parseUpdateTime(timeStr); // Same parsing logic
    }

    // ========================================
    // LEGACY SUPPORT & CLEANUP
    // ========================================

    async resetCatalogs() {
        try {
            this.importedArchives = {};
            this.isDirty = false;
            
            if (this.saveTimeout) {
                clearTimeout(this.saveTimeout);
                this.saveTimeout = null;
            }
            
            await this.plugin.saveData({
                settings: this.plugin.settings
                // Note: No conversation catalog to reset - it's now vault-based
            });
            
            this.plugin.logger.info("Reset archive catalog (conversation tracking is now vault-based)");
        } catch (error) {
            this.plugin.logger.error("resetCatalogs failed:", error);
        }
    }

    // Statistics for debugging
    getStats() {
        return {
            totalArchives: Object.keys(this.importedArchives).length,
            isDirty: this.isDirty,
            hasPendingSave: this.saveTimeout !== null,
            catalogMethod: 'vault-based' // Indicate new approach
        };
    }

    async forceSave() {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
            this.saveTimeout = null;
        }
        if (this.isDirty) {
            await this.plugin.saveSettings();
        }
    }

    // ========================================
    // DEPRECATED METHODS (For Compatibility)
    // ========================================

    /**
     * @deprecated Use scanExistingConversations() instead
     */
    getConversationCatalog(): Record<string, ConversationCatalogEntry> {
        this.plugin.logger.warn("getConversationCatalog() is deprecated - use scanExistingConversations()");
        return {}; // Return empty - forces use of new scan method
    }

    /**
     * @deprecated Conversations are now tracked via vault frontmatter
     */
    updateConversationCatalog(id: string, entry: ConversationCatalogEntry) {
        this.plugin.logger.warn("updateConversationCatalog() is deprecated - conversations tracked via frontmatter");
        // No-op - frontmatter is the source of truth now
    }

    /**
     * @deprecated Conversations are now tracked via vault frontmatter  
     */
    deleteFromConversationCatalog(id: string) {
        this.plugin.logger.warn("deleteFromConversationCatalog() is deprecated - files tracked via vault");
        // No-op - file deletion is handled by event handlers
    }
}