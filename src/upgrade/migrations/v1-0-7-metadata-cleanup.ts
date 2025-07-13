// src/upgrade/migrations/v1-0-7-metadata-cleanup.ts
import { BaseMigration, MigrationContext, MigrationResult } from "./migration-interface";
import { VersionUtils } from "../utils/version-utils";
import { ProgressModal } from "../utils/progress-modal";
import { showDialog } from "../../dialogs";
import { Logger } from "../../logger";

const logger = new Logger();

export class MetadataCleanupMigration extends BaseMigration {
    readonly id = "metadata-cleanup";
    readonly name = "Metadata Cleanup";
    readonly description = "Remove unnecessary metadata from conversation notes";
    readonly fromVersion = "1.0.7";
    readonly toVersion = "1.1.0";

    shouldRun(fromVersion: string, toVersion: string): boolean {
        // Run if user was on 1.0.7-1.0.8 and is upgrading to 1.1.0+
        const wasInMetadataVersions = VersionUtils.isInRange(fromVersion, "1.0.7", "1.0.8");
        const isUpgradingToClean = VersionUtils.compareVersions(toVersion, "1.1.0") >= 0;
        
        return wasInMetadataVersions && isUpgradingToClean;
    }

    async canRun(context: MigrationContext): Promise<boolean> {
        // Check if there are any Nexus conversation files
        const files = context.plugin.app.vault.getMarkdownFiles();
        const nexusFiles = files.filter(file => {
            const frontmatter = context.plugin.app.metadataCache.getFileCache(file)?.frontmatter;
            return frontmatter?.nexus === context.plugin.manifest.id;
        });

        logger.info(`Metadata cleanup check: found ${nexusFiles.length} Nexus conversation files`);
        return nexusFiles.length > 0;
    }

    async requestUserConfirmation(context: MigrationContext): Promise<boolean> {
        const shouldCleanup = await showDialog(
            context.plugin.app,
            "confirmation",
            "Metadata Cleanup Available",
            [
                "Version 1.1.0 uses cleaner frontmatter for conversation notes.",
                "Would you like to remove unnecessary metadata from existing notes?",
                "**What will be cleaned:**",
                "• Remove technical metadata (gizmo_id, is_archived, memory_scope, etc.)",
                "• Keep essential data (conversation_id, provider, dates, aliases)",
                "• Progress will be shown during cleanup"
            ],
            "⚠️ **This operation cannot be undone.** Make sure you have a backup of your vault before proceeding.",
            { button1: "Clean Metadata", button2: "Skip Cleanup" }
        );

        logger.info(`User ${shouldCleanup ? 'accepted' : 'declined'} metadata cleanup`);
        return shouldCleanup;
    }

    async execute(context: MigrationContext): Promise<MigrationResult> {
        try {
            const files = context.plugin.app.vault.getMarkdownFiles();
            const nexusFiles = files.filter(file => {
                const frontmatter = context.plugin.app.metadataCache.getFileCache(file)?.frontmatter;
                return frontmatter?.nexus === context.plugin.manifest.id;
            });

            if (nexusFiles.length === 0) {
                return {
                    success: true,
                    message: "No Nexus conversation files found to clean",
                    stats: { processed: 0, successful: 0, failed: 0, skipped: 0 }
                };
            }

            logger.info(`Starting metadata cleanup for ${nexusFiles.length} files`);

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
            let skipped = 0;

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
                            logger.info(`Cleaned metadata for: ${file.path}`);
                        } else {
                            skipped++;
                        }

                    } catch (error) {
                        errors++;
                        logger.error(`Error cleaning metadata for ${file.path}:`, error);
                    }

                    // Small delay to prevent UI blocking and show progress
                    if (i % 5 === 0) {
                        await new Promise(resolve => setTimeout(resolve, 50));
                    }
                }

                progressModal.showComplete(`Cleaned ${cleaned} files`);
                progressModal.closeAfterDelay(2000);

                const message = `Metadata cleanup completed: ${cleaned} files cleaned, ${skipped} unchanged, ${errors} errors`;
                logger.info(message);

                return {
                    success: errors === 0,
                    message,
                    details: { cleaned, skipped, errors },
                    stats: { processed, successful: cleaned, failed: errors, skipped }
                };

            } finally {
                progressModal.close();
            }

        } catch (error) {
            logger.error("Error during metadata cleanup:", error);
            return {
                success: false,
                message: `Metadata cleanup failed: ${error}`,
                details: { error: String(error) }
            };
        }
    }

    async verify(context: MigrationContext): Promise<boolean> {
        // Sample a few files to verify cleanup worked
        const files = context.plugin.app.vault.getMarkdownFiles();
        const nexusFiles = files.filter(file => {
            const frontmatter = context.plugin.app.metadataCache.getFileCache(file)?.frontmatter;
            return frontmatter?.nexus === context.plugin.manifest.id;
        }).slice(0, 5); // Check first 5 files

        for (const file of nexusFiles) {
            try {
                const frontmatter = context.plugin.app.metadataCache.getFileCache(file)?.frontmatter;
                
                if (!frontmatter) continue;

                // Check if any forbidden metadata still exists
                const forbiddenFields = [
                    'conversation_template_id', 'gizmo_id', 'gizmo_type', 
                    'default_model_slug', 'is_archived', 'is_starred',
                    'current_node', 'memory_scope'
                ];

                const hasUnwantedFields = forbiddenFields.some(field => frontmatter.hasOwnProperty(field));
                
                if (hasUnwantedFields) {
                    logger.warn(`Verification failed: ${file.path} still has unwanted metadata`);
                    return false;
                }

                // Check that essential fields are still present
                const essentialFields = ['nexus', 'conversation_id', 'provider'];
                const hasEssentialFields = essentialFields.every(field => frontmatter.hasOwnProperty(field));
                
                if (!hasEssentialFields) {
                    logger.warn(`Verification failed: ${file.path} missing essential metadata`);
                    return false;
                }

            } catch (error) {
                logger.error(`Verification error for ${file.path}:`, error);
                return false;
            }
        }

        logger.info("Metadata cleanup verification passed");
        return true;
    }

    /**
     * Clean frontmatter to keep only essential fields
     */
    private cleanFrontmatter(content: string): string {
        // Extract frontmatter
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
            if (colonIndex === -1) return true; // Keep non-field lines (comments, etc.)
            
            const fieldName = line.substring(0, colonIndex).trim();
            return allowedFields.includes(fieldName);
        });

        // Reconstruct content
        const cleanedFrontmatter = cleanedLines.join('\n');
        return `---\n${cleanedFrontmatter}\n---${restOfContent}`;
    }
}