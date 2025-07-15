// src/services/storage-service.ts
import { ConversationCatalogEntry } from "../types/plugin";
import { TFile } from "obsidian";
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
                const catalogSize = Object.keys(data.conversationCatalog).length;
                this.plugin.logger.info("Legacy conversation catalog detected - will be migrated in upgrade process");
            }
            
            this.plugin.logger.info("Storage data loaded successfully");
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
    // ARCHIVE TRACKING - HYBRID DETECTION (1.0.x + 1.1.0)
    // ========================================
    
    getImportedArchives() {
        return this.importedArchives;
    }

    /**
     * HYBRID detection: Works with both 1.0.x (filename as key) and 1.1.0 (hash as key)
     * FIXED: Handle both old format (string values) and new format (object values)
     */
    isArchiveImported(key: string): boolean {
        // Method 1: Direct key lookup (works for both hash and filename keys)
        if (this.importedArchives[key]) {
            return true;
        }
        
        // Method 2: Search by filename in values (for 1.0.x → 1.1.0 migration)
        // CRITICAL FIX: Handle both old format (string) and new format (object)
        return Object.values(this.importedArchives).some(archive => {
            // New format 1.1.0: archive = {fileName: "file.zip", date: "2024-01-01"}
            if (typeof archive === 'object' && archive !== null && archive.fileName) {
                return archive.fileName === key;
            }
            
            // Old format 1.0.x: archive = "2024-01-01" (string date)
            // In this case, we can't match by filename since we don't have it
            // But the key might be the filename itself, which we already checked in Method 1
            return false;
        });
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
    // NEW: VAULT-BASED CONVERSATION DISCOVERY (HYBRID)
    // ========================================

    /**
     * Scan vault for existing Nexus conversations using HYBRID approach:
     * 1. Wait for cache to be clean (fast)
     * 2. Use metadataCache (optimal performance)  
     * 3. Fallback to manual parsing for problematic files
     */
    async scanExistingConversations(): Promise<Map<string, ConversationCatalogEntry>> {
        const startTime = Date.now();
        
        // Step 1: Wait for cache to be clean (with timeout)
        await this.waitForCacheClean(1000); // Max 1 second wait
        
        const conversations = new Map<string, ConversationCatalogEntry>();
        const archiveFolder = this.plugin.settings.archiveFolder;
        const allFiles = this.plugin.app.vault.getMarkdownFiles();
        
        // Filter conversation files (exclude Reports/Attachments)
        const conversationFiles = allFiles.filter(file => {
            if (!file.path.startsWith(archiveFolder)) return false;
            
            const relativePath = file.path.substring(archiveFolder.length + 1);
            if (relativePath.startsWith('Reports/') || 
                relativePath.startsWith('Attachments/') ||
                relativePath.startsWith('reports/') ||
                relativePath.startsWith('attachments/')) {
                return false;
            }
            
            return true;
        });
        
        let processed = 0;
        let foundViaCache = 0;
        let foundViaManual = 0;
        let errors = 0;
        
        // Process files in batches
        const batchSize = 100;
        for (let i = 0; i < conversationFiles.length; i += batchSize) {
            const batch = conversationFiles.slice(i, i + batchSize);
            
            for (const file of batch) {
                processed++;
                
                try {
                    // Try metadataCache first (fast)
                    let entry = await this.parseWithCache(file);
                    if (entry) {
                        conversations.set(entry.conversationId, entry);
                        foundViaCache++;
                        continue;
                    }
                    
                    // Fallback to manual parsing
                    entry = await this.parseConversationFileManually(file);
                    if (entry) {
                        conversations.set(entry.conversationId, entry);
                        foundViaManual++;
                    }
                    
                } catch (error) {
                    errors++;
                    console.warn(`Error parsing conversation file ${file.path}:`, error);
                }
            }
            
            // Small delay between large batches
            if (i + batchSize < conversationFiles.length) {
                await new Promise(resolve => setTimeout(resolve, 1));
            }
        }
        
        const duration = Date.now() - startTime;
        const total = foundViaCache + foundViaManual;
        
        this.plugin.logger.info(`Scanned vault: found ${total} conversations in ${duration}ms`);
        
        return conversations;
    }

    /**
     * Wait for metadata cache to be clean with timeout
     */
    private async waitForCacheClean(maxWaitMs: number = 1000): Promise<void> {
        const startTime = Date.now();
        
        // Type assertion for undocumented Obsidian API
        const metadataCache = this.plugin.app.metadataCache as any;
        
        while (!metadataCache.isCacheClean()) {
            if (Date.now() - startTime > maxWaitMs) {
                break;
            }
            await new Promise(resolve => setTimeout(resolve, 10));
        }
    }

    /**
     * Parse conversation using metadataCache (fast but potentially unreliable)
     */
    private async parseWithCache(file: TFile): Promise<ConversationCatalogEntry | null> {
        try {
            const frontmatter = this.plugin.app.metadataCache.getFileCache(file)?.frontmatter;
            
            if (!frontmatter?.nexus || frontmatter.nexus !== this.plugin.manifest.id) {
                return null;
            }
            
            if (!frontmatter.conversation_id) {
                return null;
            }
            
            const createTime = this.parseTimeString(frontmatter.create_time);
            const updateTime = this.parseTimeString(frontmatter.update_time);
            
            return {
                conversationId: frontmatter.conversation_id,
                provider: frontmatter.provider || 'unknown',
                path: file.path,
                updateTime: updateTime,
                create_time: createTime,
                update_time: updateTime
            };
            
        } catch (error) {
            // Silent fail - will try manual parsing
            return null;
        }
    }

    /**
     * Parse single conversation file manually (robust fallback)
     */
    private async parseConversationFileManually(file: TFile): Promise<ConversationCatalogEntry | null> {
        try {
            const content = await this.plugin.app.vault.read(file);
            
            // Extract frontmatter manually
            const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
            
            if (!frontmatterMatch) {
                return null;
            }

            const frontmatterContent = frontmatterMatch[1];
            
            // Parse frontmatter lines manually
            const frontmatterData: Record<string, string> = {};
            const lines = frontmatterContent.split('\n');
            
            for (const line of lines) {
                const colonIndex = line.indexOf(':');
                if (colonIndex > 0) {
                    const key = line.substring(0, colonIndex).trim();
                    let value = line.substring(colonIndex + 1).trim();
                    
                    // Remove quotes if present
                    if ((value.startsWith('"') && value.endsWith('"')) || 
                        (value.startsWith("'") && value.endsWith("'"))) {
                        value = value.slice(1, -1);
                    }
                    
                    frontmatterData[key] = value;
                }
            }

            // Check if this is a Nexus conversation file
            const nexusId = this.plugin.manifest.id;
            if (frontmatterData.nexus !== nexusId) {
                return null;
            }

            if (!frontmatterData.conversation_id) {
                return null;
            }

            const createTime = this.parseTimeString(frontmatterData.create_time);
            const updateTime = this.parseTimeString(frontmatterData.update_time);

            return {
                conversationId: frontmatterData.conversation_id,
                provider: frontmatterData.provider || 'unknown',
                path: file.path,
                updateTime: updateTime,
                create_time: createTime,
                update_time: updateTime
            };

        } catch (error) {
            console.error(`Error manually parsing ${file.path}:`, error);
            return null;
        }
    }

    /**
     * Parse time string from frontmatter (handle multiple formats)
     */
    private parseTimeString(timeStr: string): number {
        if (!timeStr) return 0;
        
        try {
            let dateStr = timeStr.replace(' at ', ' ');
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) {
                console.warn(`Could not parse date: ${timeStr}`);
                return 0;
            }
            
            return Math.floor(date.getTime() / 1000);
        } catch (error) {
            console.warn(`Date parsing error for "${timeStr}":`, error);
            return 0;
        }
    }

    /**
     * Fast check if a specific conversation exists
     */
    async conversationExists(conversationId: string): Promise<boolean> {
        const conversations = await this.scanExistingConversations();
        return conversations.has(conversationId);
    }

    /**
     * Get conversation entry by ID (single lookup)
     */
    async getConversationById(conversationId: string): Promise<ConversationCatalogEntry | null> {
        const conversations = await this.scanExistingConversations();
        return conversations.get(conversationId) || null;
    }

    /**
     * Get conversations by provider (for reporting/stats)
     */
    async getConversationsByProvider(provider: string): Promise<ConversationCatalogEntry[]> {
        const allConversations = await this.scanExistingConversations();
        return Array.from(allConversations.values()).filter(entry => entry.provider === provider);
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
            catalogMethod: 'vault-based-hybrid',
            trackingMethod: 'hybrid-hash-filename'
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