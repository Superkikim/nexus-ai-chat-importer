// src/upgrade/migrations/v1-0-2-catalog-migration.ts
import { TFile } from "obsidian";
import { BaseMigration, MigrationContext, MigrationResult } from "./migration-interface";
import { VersionUtils } from "../utils/version-utils";
import { Logger } from "../../logger";

const logger = new Logger();

export class CatalogMigration extends BaseMigration {
    readonly id = "catalog-to-vault-migration";
    readonly name = "Catalog to Vault Migration";
    readonly description = "Migrate conversation catalog to vault-based tracking";
    readonly fromVersion = "1.0.2";
    readonly toVersion = "1.1.0";

    shouldRun(fromVersion: string, toVersion: string): boolean {
        // Run if user was on 1.0.2-1.0.8 and is upgrading to 1.1.0+
        const wasInCatalogVersions = VersionUtils.isInRange(fromVersion, "1.0.2", "1.0.8");
        const isUpgradingToVault = VersionUtils.compareVersions(toVersion, "1.1.0") >= 0;
        
        return wasInCatalogVersions && isUpgradingToVault;
    }

    async canRun(context: MigrationContext): Promise<boolean> {
        // Check if catalog exists in plugin data
        const catalog = context.pluginData?.conversationCatalog;
        const catalogExists = catalog && Object.keys(catalog).length > 0;
        
        logger.info(`Catalog migration check: catalog exists = ${catalogExists}`);
        return catalogExists;
    }

    async execute(context: MigrationContext): Promise<MigrationResult> {
        try {
            const catalog = context.pluginData.conversationCatalog || {};
            const catalogSize = Object.keys(catalog).length;

            if (catalogSize === 0) {
                return {
                    success: true,
                    message: "No catalog to migrate",
                    stats: { processed: 0, successful: 0, failed: 0, skipped: 0 }
                };
            }

            logger.info(`Starting catalog migration for ${catalogSize} conversations`);

            // Verify each conversation exists in vault with proper frontmatter
            const verificationResult = await this.verifyCatalogIntegrity(catalog, context);
            
            if (!verificationResult.success) {
                return {
                    success: false,
                    message: "Catalog verification failed",
                    details: verificationResult,
                    stats: { 
                        processed: verificationResult.stats.total,
                        successful: verificationResult.stats.verified,
                        failed: verificationResult.stats.missing,
                        skipped: 0
                    }
                };
            }

            // Migration successful - prepare cleaned data
            const cleanedData = {
                settings: context.pluginData.settings,
                importedArchives: context.pluginData.importedArchives || {},
                // Remove conversationCatalog - this is the key change
                lastVersion: context.toVersion,
                migrationDate: new Date().toISOString(),
                migrationStats: verificationResult.stats
            };

            // Save cleaned data
            await context.plugin.saveData(cleanedData);

            logger.info("Catalog migration completed successfully", verificationResult.stats);

            return {
                success: true,
                message: `Catalog migration completed: ${verificationResult.stats.verified}/${catalogSize} conversations verified`,
                details: verificationResult,
                stats: {
                    processed: catalogSize,
                    successful: verificationResult.stats.verified,
                    failed: verificationResult.stats.missing,
                    skipped: 0
                }
            };

        } catch (error) {
            logger.error("Error during catalog migration:", error);
            return {
                success: false,
                message: `Catalog migration failed: ${error}`,
                details: { error: String(error) }
            };
        }
    }

    async verify(context: MigrationContext): Promise<boolean> {
        // Verify that catalog was removed from plugin data
        const data = await context.plugin.loadData();
        const catalogRemoved = !data.conversationCatalog;
        
        // Verify that storage service can scan conversations
        const storage = context.plugin.getStorageService();
        try {
            const scannedConversations = await storage.scanExistingConversations();
            const scanWorking = scannedConversations.size >= 0; // Should work without error
            
            logger.info(`Migration verification: catalog removed = ${catalogRemoved}, scan working = ${scanWorking}`);
            return catalogRemoved && scanWorking;
        } catch (error) {
            logger.error("Migration verification failed:", error);
            return false;
        }
    }

    /**
     * Verify that all catalog entries correspond to actual vault files with proper frontmatter
     */
    private async verifyCatalogIntegrity(catalog: any, context: MigrationContext): Promise<{
        success: boolean;
        stats: { total: number; verified: number; missing: number };
        errors: string[];
    }> {
        const stats = { total: 0, verified: 0, missing: 0 };
        const errors: string[] = [];

        for (const [conversationId, entry] of Object.entries(catalog)) {
            stats.total++;
            
            try {
                const entryTyped = entry as any;
                
                // Check if file exists
                const fileExists = await context.plugin.app.vault.adapter.exists(entryTyped.path);
                
                if (!fileExists) {
                    stats.missing++;
                    errors.push(`File not found: ${entryTyped.path}`);
                    continue;
                }

                // Check frontmatter
                const file = context.plugin.app.vault.getAbstractFileByPath(entryTyped.path);
                if (!file || !(file instanceof TFile)) {
                    stats.missing++;
                    errors.push(`Could not access file or not a markdown file: ${entryTyped.path}`);
                    continue;
                }

                const frontmatter = context.plugin.app.metadataCache.getFileCache(file)?.frontmatter;
                
                if (!frontmatter?.conversation_id) {
                    stats.missing++;
                    errors.push(`Missing conversation_id in frontmatter: ${entryTyped.path}`);
                    continue;
                }

                if (frontmatter.conversation_id !== conversationId) {
                    stats.missing++;
                    errors.push(`Conversation ID mismatch in ${entryTyped.path}: expected ${conversationId}, found ${frontmatter.conversation_id}`);
                    continue;
                }

                if (frontmatter.nexus !== context.plugin.manifest.id) {
                    stats.missing++;
                    errors.push(`Missing or incorrect nexus field in ${entryTyped.path}`);
                    continue;
                }

                // All checks passed
                stats.verified++;

            } catch (error) {
                stats.missing++;
                errors.push(`Error verifying ${conversationId}: ${error}`);
            }
        }

        const success = stats.missing === 0;
        
        if (!success) {
            logger.warn(`Catalog verification found ${stats.missing} issues:`, errors.slice(0, 5)); // Log first 5 errors
        }

        return { success, stats, errors };
    }
}