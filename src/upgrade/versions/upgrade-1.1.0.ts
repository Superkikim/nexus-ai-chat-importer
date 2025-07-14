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
            // Check if there are Nexus conversation files
            const files = context.plugin.app.vault.getMarkdownFiles();
            const nexusFiles = files.filter((file: TFile) => {
                try {
                    const frontmatter = context.plugin.app.metadataCache.getFileCache(file)?.frontmatter;
                    return frontmatter?.nexus === context.plugin.manifest.id;
                } catch (error) {
                    console.warn(`[NEXUS-DEBUG] Error checking file ${file.path}:`, error);
                    return false;
                }
            });

            const canRun = nexusFiles.length > 0;
            console.debug(`[NEXUS-DEBUG] CleanMetadata.canRun: found ${nexusFiles.length} files, canRun=${canRun}`);
            return canRun;
        } catch (error) {
            console.error(`[NEXUS-DEBUG] CleanMetadata.canRun failed:`, error);
            return false;
        }
    }

    async execute(context: UpgradeContext): Promise<OperationResult> {
        try {
            console.debug(`[NEXUS-DEBUG] CleanMetadata.execute starting`);
            
            const files = context.plugin.app.vault.getMarkdownFiles();
            const nexusFiles = files.filter((file: TFile) => {
                try {
                    const frontmatter = context.plugin.app.metadataCache.getFileCache(file)?.frontmatter;
                    return frontmatter?.nexus === context.plugin.manifest.id;
                } catch (error) {
                    return false;
                }
            });

            if (nexusFiles.length === 0) {
                console.debug(`[NEXUS-DEBUG] CleanMetadata: No files to clean`);
                return {
                    success: true,
                    message: "No Nexus conversation files found to clean",
                    details: { processed: 0, cleaned: 0, errors: 0 }
                };
            }

            console.debug(`[NEXUS-DEBUG] CleanMetadata: Processing ${nexusFiles.length} files`);

            let processed = 0;
            let cleaned = 0;
            let errors = 0;

            // Process files in smaller batches to avoid blocking
            const batchSize = 10;
            for (let i = 0; i < nexusFiles.length; i += batchSize) {
                const batch = nexusFiles.slice(i, i + batchSize);
                
                for (const file of batch) {
                    processed++;

                    try {
                        const content = await context.plugin.app.vault.read(file);
                        const cleanedContent = this.cleanFrontmatter(content, context.toVersion);

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
                if (i + batchSize < nexusFiles.length) {
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
     * Clean frontmatter to keep only essential fields AND add plugin_version
     */
    private cleanFrontmatter(content: string, pluginVersion: string): string {
        const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
        const match = content.match(frontmatterRegex);

        if (!match) return content;

        const frontmatterContent = match[1];
        const restOfContent = content.substring(match[0].length);

        // Parse existing frontmatter into key-value pairs
        const frontmatterLines = frontmatterContent.split('\n');
        const frontmatterData: Record<string, string> = {};
        
        for (const line of frontmatterLines) {
            const colonIndex = line.indexOf(':');
            if (colonIndex > 0) {
                const key = line.substring(0, colonIndex).trim();
                const value = line.substring(colonIndex + 1).trim();
                frontmatterData[key] = value;
            }
        }

        // Build new frontmatter in correct order
        const newFrontmatter: string[] = [];
        
        // Required fields in specific order
        if (frontmatterData.nexus) newFrontmatter.push(`nexus: ${frontmatterData.nexus}`);
        
        // Add plugin_version right after nexus
        newFrontmatter.push(`plugin_version: "${pluginVersion}"`);
        
        if (frontmatterData.provider) newFrontmatter.push(`provider: ${frontmatterData.provider}`);
        if (frontmatterData.aliases) newFrontmatter.push(`aliases: ${frontmatterData.aliases}`);
        if (frontmatterData.conversation_id) newFrontmatter.push(`conversation_id: ${frontmatterData.conversation_id}`);
        if (frontmatterData.create_time) newFrontmatter.push(`create_time: ${frontmatterData.create_time}`);
        if (frontmatterData.update_time) newFrontmatter.push(`update_time: ${frontmatterData.update_time}`);

        // Reconstruct content
        const cleanedFrontmatter = newFrontmatter.join('\n');
        return `---\n${cleanedFrontmatter}\n---${restOfContent}`;
    }

    async verify(context: UpgradeContext): Promise<boolean> {
        try {
            // Sample verification - check a few files
            const files = context.plugin.app.vault.getMarkdownFiles();
            const nexusFiles = files.filter((file: TFile) => {
                try {
                    const frontmatter = context.plugin.app.metadataCache.getFileCache(file)?.frontmatter;
                    return frontmatter?.nexus === context.plugin.manifest.id;
                } catch (error) {
                    return false;
                }
            }).slice(0, 5); // Check first 5 files

            for (const file of nexusFiles) {
                try {
                    const frontmatter = context.plugin.app.metadataCache.getFileCache(file)?.frontmatter;
                    if (!frontmatter) continue;

                    // Check if plugin_version was added
                    if (!frontmatter.plugin_version) {
                        console.debug(`[NEXUS-DEBUG] CleanMetadata.verify: Missing plugin_version in ${file.path}`);
                        return false;
                    }

                    // Check if forbidden metadata still exists
                    const forbiddenFields = [
                        'conversation_template_id', 'gizmo_id', 'gizmo_type',
                        'default_model_slug', 'is_archived', 'is_starred',
                        'current_node', 'memory_scope'
                    ];

                    const hasUnwantedFields = forbiddenFields.some(field => frontmatter.hasOwnProperty(field));
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