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
        // Check if catalog exists
        const catalog = context.pluginData?.conversationCatalog;
        return catalog && Object.keys(catalog).length > 0;
    }

    async execute(context: UpgradeContext): Promise<OperationResult> {
        try {
            const catalog = context.pluginData.conversationCatalog || {};
            const catalogSize = Object.keys(catalog).length;

            if (catalogSize === 0) {
                return {
                    success: true,
                    message: "No legacy catalog found to delete"
                };
            }

            // Create cleaned data without catalog
            const cleanedData = {
                settings: context.pluginData.settings,
                importedArchives: context.pluginData.importedArchives || {},
                upgradeHistory: context.pluginData.upgradeHistory || {
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

            return {
                success: true,
                message: `Legacy catalog deleted: ${catalogSize} entries removed`,
                details: { entriesDeleted: catalogSize }
            };

        } catch (error) {
            return {
                success: false,
                message: `Failed to delete legacy catalog: ${error}`,
                details: { error: String(error) }
            };
        }
    }

    async verify(context: UpgradeContext): Promise<boolean> {
        const data = await context.plugin.loadData();
        return !data.conversationCatalog; // Verify catalog is gone
    }
}

/**
 * Clean metadata from conversation notes (automatic operation)
 */
class CleanMetadataOperation extends UpgradeOperation {
    readonly id = "clean-metadata";
    readonly name = "Clean Metadata";
    readonly description = "Remove unnecessary metadata from conversation notes";
    readonly type = "automatic" as const;

    async canRun(context: UpgradeContext): Promise<boolean> {
        // Check if there are Nexus conversation files
        const files = context.plugin.app.vault.getMarkdownFiles();
        const nexusFiles = files.filter((file: TFile) => {
            const frontmatter = context.plugin.app.metadataCache.getFileCache(file)?.frontmatter;
            return frontmatter?.nexus === context.plugin.manifest.id;
        });

        return nexusFiles.length > 0;
    }

    async execute(context: UpgradeContext): Promise<OperationResult> {
        try {
            const files = context.plugin.app.vault.getMarkdownFiles();
            const nexusFiles = files.filter((file: TFile) => {
                const frontmatter = context.plugin.app.metadataCache.getFileCache(file)?.frontmatter;
                return frontmatter?.nexus === context.plugin.manifest.id;
            });

            if (nexusFiles.length === 0) {
                return {
                    success: true,
                    message: "No Nexus conversation files found to clean",
                    details: { processed: 0, cleaned: 0, errors: 0 }
                };
            }

            // Show progress modal
            const progressModal = new UpgradeProgressModal(
                context.plugin.app,
                "Cleaning Metadata",
                nexusFiles.length
            );
            progressModal.open();

            let processed = 0;
            let cleaned = 0;
            let errors = 0;

            try {
                for (let i = 0; i < nexusFiles.length; i++) {
                    const file = nexusFiles[i];
                    processed++;

                    progressModal.updateStep(i + 1, {
                        title: "Processing files...",
                        detail: file.name
                    });

                    try {
                        const content = await context.plugin.app.vault.read(file);
                        const cleanedContent = this.cleanFrontmatter(content);

                        if (content !== cleanedContent) {
                            await context.plugin.app.vault.modify(file, cleanedContent);
                            cleaned++;
                        }

                    } catch (error) {
                        errors++;
                        context.plugin.logger.error(`Error cleaning metadata for ${file.path}:`, error);
                    }

                    // Small delay to show progress
                    if (i % 5 === 0) {
                        await new Promise(resolve => setTimeout(resolve, 50));
                    }
                }

                progressModal.showComplete(`Cleaned ${cleaned} files`);
                progressModal.closeAfterDelay(2000);

                return {
                    success: errors === 0,
                    message: `Metadata cleanup completed: ${cleaned} files cleaned, ${errors} errors`,
                    details: { processed, cleaned, errors }
                };

            } finally {
                progressModal.close();
            }

        } catch (error) {
            return {
                success: false,
                message: `Metadata cleanup failed: ${error}`,
                details: { error: String(error) }
            };
        }
    }

    /**
     * Clean frontmatter to keep only essential fields
     */
    private cleanFrontmatter(content: string): string {
        const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
        const match = content.match(frontmatterRegex);

        if (!match) return content;

        const frontmatterContent = match[1];
        const restOfContent = content.substring(match[0].length);

        // Define allowed frontmatter fields (clean v1.0.5 format)
        const allowedFields = [
            'nexus',
            'provider',
            'aliases',
            'conversation_id',
            'create_time',
            'update_time'
        ];

        // Parse and filter frontmatter
        const lines = frontmatterContent.split('\n');
        const cleanedLines = lines.filter(line => {
            const colonIndex = line.indexOf(':');
            if (colonIndex === -1) return true; // Keep non-field lines
            
            const fieldName = line.substring(0, colonIndex).trim();
            return allowedFields.includes(fieldName);
        });

        // Reconstruct content
        const cleanedFrontmatter = cleanedLines.join('\n');
        return `---\n${cleanedFrontmatter}\n---${restOfContent}`;
    }

    async verify(context: UpgradeContext): Promise<boolean> {
        // Sample verification - check a few files
        const files = context.plugin.app.vault.getMarkdownFiles();
        const nexusFiles = files.filter((file: TFile) => {
            const frontmatter = context.plugin.app.metadataCache.getFileCache(file)?.frontmatter;
            return frontmatter?.nexus === context.plugin.manifest.id;
        }).slice(0, 5); // Check first 5 files

        for (const file of nexusFiles) {
            try {
                const frontmatter = context.plugin.app.metadataCache.getFileCache(file)?.frontmatter;
                if (!frontmatter) continue;

                // Check if forbidden metadata still exists
                const forbiddenFields = [
                    'conversation_template_id', 'gizmo_id', 'gizmo_type',
                    'default_model_slug', 'is_archived', 'is_starred',
                    'current_node', 'memory_scope'
                ];

                const hasUnwantedFields = forbiddenFields.some(field => frontmatter.hasOwnProperty(field));
                if (hasUnwantedFields) {
                    return false;
                }
            } catch (error) {
                return false;
            }
        }

        return true;
    }
}

/**
 * Version 1.1.0 Upgrade Definition
 */
export class Upgrade110 extends VersionUpgrade {
    readonly version = "1.1.0";
    
    readonly automaticOperations = [
        new DeleteCatalogOperation(),
        new CleanMetadataOperation()  // Moved from manual to automatic
    ];
    
    readonly manualOperations = [
        // No manual operations for 1.1.0 - all operations are automatic
        // Future versions can add manual operations here for truly optional tasks
    ];
}