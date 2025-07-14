// src/upgrade/versions/upgrade-1.1.0.ts
import { VersionUpgrade, UpgradeOperation, UpgradeContext, OperationResult } from "../upgrade-interface";
import { UpgradeProgressModal } from "../utils/progress-modal";
import { showDialog } from "../../dialogs";
import { TFile } from "obsidian";

/**
 * Delete old conversation catalog (automatic operation)
 */
class DeleteCatalogOperation extends UpgradeOperation {
    readonly id = "delete-catalog";
    readonly name = "Delete Old Catalog";
    readonly description = "Remove legacy conversation catalog data";
    readonly type = "automatic" as const;

    async canRun(context: UpgradeContext): Promise<boolean> {
        try {
            // Operation loads its own data - manager stays version-agnostic
            const data = await context.plugin.loadData();
            const catalog = data?.conversationCatalog;
            const hasData = catalog && typeof catalog === 'object' && Object.keys(catalog).length > 0;
            
            console.debug(`[NEXUS-DEBUG] DeleteCatalog.canRun: catalog exists=${!!catalog}, hasData=${hasData}`);
            if (catalog) {
                console.debug(`[NEXUS-DEBUG] DeleteCatalog.canRun: catalog size=${Object.keys(catalog).length}`);
            }
            return hasData;
        } catch (error) {
            console.error(`[NEXUS-DEBUG] DeleteCatalog.canRun failed:`, error);
            return false;
        }
    }

    async execute(context: UpgradeContext): Promise<OperationResult> {
        try {
            console.debug(`[NEXUS-DEBUG] DeleteCatalog.execute starting`);
            
            // Operation loads its own data - not relying on context.pluginData
            const data = await context.plugin.loadData();
            const catalog = data?.conversationCatalog || {};
            const catalogSize = Object.keys(catalog).length;

            if (catalogSize === 0) {
                console.debug(`[NEXUS-DEBUG] DeleteCatalog: No catalog to delete`);
                return {
                    success: true,
                    message: "No legacy catalog found to delete"
                };
            }

            // Create cleaned data without catalog
            const cleanedData = {
                settings: data.settings || context.plugin.settings,
                importedArchives: data.importedArchives || {},
                upgradeHistory: data.upgradeHistory || {
                    completedUpgrades: {},
                    completedOperations: {}
                },
                lastVersion: context.toVersion,
                // Remove conversationCatalog - key change
                catalogDeletionDate: new Date().toISOString(),
                catalogDeletionStats: { entriesDeleted: catalogSize }
            };

            // Save cleaned data
            await context.plugin.saveData(cleanedData);

            console.debug(`[NEXUS-DEBUG] DeleteCatalog: Deleted ${catalogSize} entries`);
            return {
                success: true,
                message: `Legacy catalog deleted: ${catalogSize} entries removed`,
                details: { entriesDeleted: catalogSize }
            };

        } catch (error) {
            console.error(`[NEXUS-DEBUG] DeleteCatalog.execute failed:`, error);
            return {
                success: false,
                message: `Failed to delete legacy catalog: ${error}`,
                details: { error: String(error) }
            };
        }
    }

    async verify(context: UpgradeContext): Promise<boolean> {
        try {
            const data = await context.plugin.loadData();
            const hasNoCatalog = !data?.conversationCatalog;
            console.debug(`[NEXUS-DEBUG] DeleteCatalog.verify: hasNoCatalog=${hasNoCatalog}`);
            return hasNoCatalog;
        } catch (error) {
            console.error(`[NEXUS-DEBUG] DeleteCatalog.verify failed:`, error);
            return false;
        }
    }
}

// src/upgrade/versions/upgrade-1.1.0.ts - CleanMetadataOperation only

/**
 * Clean metadata from conversation notes and add plugin_version (automatic operation)
 */
class CleanMetadataOperation extends UpgradeOperation {
    readonly id = "clean-metadata";
    readonly name = "Clean & Version Metadata";
    readonly description = "Remove unnecessary metadata and add plugin version to conversation notes";
    readonly type = "automatic" as const;

    async canRun(context: UpgradeContext): Promise<boolean> {
        try {
            const archiveFolder = context.plugin.settings.archiveFolder;
            const allFiles = context.plugin.app.vault.getMarkdownFiles();
            
            // Filter files in archive folder but EXCLUDE Reports and Attachments
            const conversationFiles = allFiles.filter(file => {
                // Must be in archive folder
                if (!file.path.startsWith(archiveFolder)) return false;
                
                // EXCLUDE Reports and Attachments folders
                const relativePath = file.path.substring(archiveFolder.length + 1);
                if (relativePath.startsWith('Reports/') || 
                    relativePath.startsWith('Attachments/') ||
                    relativePath.startsWith('reports/') ||
                    relativePath.startsWith('attachments/')) {
                    return false;
                }
                
                return true;
            });

            const canRun = conversationFiles.length > 0;
            console.debug(`[NEXUS-DEBUG] CleanMetadata.canRun: found ${conversationFiles.length} conversation files, canRun=${canRun}`);
            return canRun;
        } catch (error) {
            console.error(`[NEXUS-DEBUG] CleanMetadata.canRun failed:`, error);
            return false;
        }
    }

    async execute(context: UpgradeContext): Promise<OperationResult> {
        try {
            console.debug(`[NEXUS-DEBUG] CleanMetadata.execute starting`);
            
            const archiveFolder = context.plugin.settings.archiveFolder;
            const allFiles = context.plugin.app.vault.getMarkdownFiles();
            
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

            if (conversationFiles.length === 0) {
                console.debug(`[NEXUS-DEBUG] CleanMetadata: No conversation files to clean`);
                return {
                    success: true,
                    message: "No conversation files found to clean",
                    details: { processed: 0, cleaned: 0, errors: 0 }
                };
            }

            console.debug(`[NEXUS-DEBUG] CleanMetadata: Processing ${conversationFiles.length} conversation files`);

            let processed = 0;
            let cleaned = 0;
            let errors = 0;

            // Process files in smaller batches to avoid blocking
            const batchSize = 10;
            for (let i = 0; i < conversationFiles.length; i += batchSize) {
                const batch = conversationFiles.slice(i, i + batchSize);
                
                for (const file of batch) {
                    processed++;

                    try {
                        const content = await context.plugin.app.vault.read(file);
                        const cleanedContent = this.cleanFrontmatterRobust(content, context.toVersion, file.basename);

                        if (content !== cleanedContent) {
                            await context.plugin.app.vault.modify(file, cleanedContent);
                            cleaned++;
                        }

                    } catch (error) {
                        errors++;
                        console.error(`[NEXUS-DEBUG] Error cleaning metadata for ${file.path}:`, error);
                    }
                }

                // Small delay between batches to prevent blocking
                if (i + batchSize < conversationFiles.length) {
                    await new Promise(resolve => setTimeout(resolve, 10));
                }
            }

            console.debug(`[NEXUS-DEBUG] CleanMetadata: Completed - processed:${processed}, cleaned:${cleaned}, errors:${errors}`);

            return {
                success: errors === 0,
                message: `Metadata cleanup completed: ${cleaned} files cleaned, ${errors} errors`,
                details: { processed, cleaned, errors }
            };

        } catch (error) {
            console.error(`[NEXUS-DEBUG] CleanMetadata.execute failed:`, error);
            return {
                success: false,
                message: `Metadata cleanup failed: ${error}`,
                details: { error: String(error) }
            };
        }
    }

    /**
     * Clean frontmatter with robust parsing and safe alias generation
     */
    private cleanFrontmatterRobust(content: string, pluginVersion: string, fileName: string): string {
        // Try to extract frontmatter manually (more robust than metadataCache)
        const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
        
        if (!frontmatterMatch) {
            // No frontmatter found - check if this looks like a Nexus file
            if (content.includes('nexus:') || content.includes('conversation_id:')) {
                console.warn(`[NEXUS-DEBUG] File ${fileName} appears to be Nexus but has malformed frontmatter`);
            }
            return content;
        }

        const frontmatterContent = frontmatterMatch[1];
        const restOfContent = content.substring(frontmatterMatch[0].length);

        // Parse frontmatter lines manually (more robust than YAML parsing)
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
        const nexusId = 'nexus-ai-chat-importer'; // Hard-coded for safety
        if (frontmatterData.nexus !== nexusId) {
            // Not a Nexus file, skip
            return content;
        }

        // Generate safe alias from filename (more robust than title parsing)
        const safeAlias = this.generateSafeAlias(fileName);

        // Build new frontmatter in correct order with robust values
        const newFrontmatter: string[] = [];
        
        // Required fields in specific order
        newFrontmatter.push(`nexus: ${nexusId}`);
        newFrontmatter.push(`plugin_version: "${pluginVersion}"`);
        
        if (frontmatterData.provider) {
            newFrontmatter.push(`provider: ${frontmatterData.provider}`);
        }
        
        // Use safe alias instead of potentially problematic title
        newFrontmatter.push(`aliases: "${safeAlias}"`);
        
        if (frontmatterData.conversation_id) {
            newFrontmatter.push(`conversation_id: ${frontmatterData.conversation_id}`);
        }
        if (frontmatterData.create_time) {
            newFrontmatter.push(`create_time: ${frontmatterData.create_time}`);
        }
        if (frontmatterData.update_time) {
            newFrontmatter.push(`update_time: ${frontmatterData.update_time}`);
        }

        // Reconstruct content
        const cleanedFrontmatter = newFrontmatter.join('\n');
        return `---\n${cleanedFrontmatter}\n---${restOfContent}`;
    }

    /**
     * Generate safe alias from filename (reuse the robust filename logic)
     */
    private generateSafeAlias(fileName: string): string {
        // Remove date prefix if present (YYYYMMDD - or YYYY-MM-DD -)
        let cleanName = fileName.replace(/^\d{8}\s*-\s*/, '').replace(/^\d{4}-\d{2}-\d{2}\s*-\s*/, '');
        
        // Remove file extension
        cleanName = cleanName.replace(/\.md$/, '');
        
        // Apply same sanitization as generateFileName but preserve readability
        cleanName = cleanName
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
            .replace(/[<>:"\/\\|?*\n\r]+/g, "") // Remove invalid characters
            .trim();

        return cleanName || "Untitled";
    }

    async verify(context: UpgradeContext): Promise<boolean> {
        try {
            const archiveFolder = context.plugin.settings.archiveFolder;
            const allFiles = context.plugin.app.vault.getMarkdownFiles();
            
            // Check conversation files (sample verification)
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
            }).slice(0, 5); // Check first 5 files

            for (const file of conversationFiles) {
                try {
                    const content = await context.plugin.app.vault.read(file);
                    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
                    
                    if (!frontmatterMatch) continue;

                    // Check manually if plugin_version was added
                    const frontmatterContent = frontmatterMatch[1];
                    if (!frontmatterContent.includes('plugin_version:')) {
                        console.debug(`[NEXUS-DEBUG] CleanMetadata.verify: Missing plugin_version in ${file.path}`);
                        return false;
                    }

                    // Check if forbidden metadata still exists
                    const forbiddenFields = [
                        'conversation_template_id:', 'gizmo_id:', 'gizmo_type:',
                        'default_model_slug:', 'is_archived:', 'is_starred:',
                        'current_node:', 'memory_scope:'
                    ];

                    const hasUnwantedFields = forbiddenFields.some(field => 
                        frontmatterContent.includes(field)
                    );
                    if (hasUnwantedFields) {
                        console.debug(`[NEXUS-DEBUG] CleanMetadata.verify: Found unwanted fields in ${file.path}`);
                        return false;
                    }
                } catch (error) {
                    console.error(`[NEXUS-DEBUG] CleanMetadata.verify error for ${file.path}:`, error);
                    return false;
                }
            }

            console.debug(`[NEXUS-DEBUG] CleanMetadata.verify: Passed verification`);
            return true;
        } catch (error) {
            console.error(`[NEXUS-DEBUG] CleanMetadata.verify failed:`, error);
            return false;
        }
    }
}

/**
 * Version 1.1.0 Upgrade Definition
 */
export class Upgrade110 extends VersionUpgrade {
    readonly version = "1.1.0";
    
    readonly automaticOperations = [
        new DeleteCatalogOperation(),
        new CleanMetadataOperation()
    ];
    
    readonly manualOperations = [
        // No manual operations for 1.1.0 - all operations are automatic
        // Future versions can add manual operations here for truly optional tasks
    ];
}