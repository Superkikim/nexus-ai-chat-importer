// src/upgrade/upgrade-manager.ts
import { Notice } from "obsidian";
import { BaseMigration, MigrationContext, MigrationResult } from "./migrations/migration-interface";
import { UpgradeRegistry } from "./upgrade-registry";
import { VersionUtils } from "./utils/version-utils";
import { ProgressModal } from "./utils/progress-modal";
import { showDialog } from "../dialogs";
import { Logger } from "../logger";
import { GITHUB } from "../config/constants";
import type NexusAiChatImporterPlugin from "../main";

const logger = new Logger();

export interface UpgradeResult {
    success: boolean;
    migrationsRun: number;
    migrationsSkipped: number;
    migrationsFailed: number;
    results: Array<{
        migrationId: string;
        result: MigrationResult;
    }>;
}

export class UpgradeManager {
    private registry: UpgradeRegistry;
    private plugin: NexusAiChatImporterPlugin;

    constructor(plugin: NexusAiChatImporterPlugin) {
        this.plugin = plugin;
        this.registry = new UpgradeRegistry();
        this.registerBuiltinMigrations();
    }

    /**
     * Register all built-in migrations
     */
    private registerBuiltinMigrations(): void {
        // Lazy import to avoid circular dependencies
        const { CatalogMigration } = require("./migrations/v1-0-2-catalog-migration");
        const { MetadataCleanupMigration } = require("./migrations/v1-0-7-metadata-cleanup");
        
        this.registry.register(new CatalogMigration());
        this.registry.register(new MetadataCleanupMigration());
        
        logger.info("Built-in migrations registered:", this.registry.getStats());
    }

    /**
     * Main upgrade check and execution
     */
    async checkAndPerformUpgrade(): Promise<UpgradeResult | null> {
        try {
            const currentVersion = this.plugin.manifest.version;
            const data = await this.plugin.loadData();
            const lastVersion = data?.lastVersion || "0.0.0";
            const hasCompletedUpgrade = data?.hasCompletedUpgrade || false;

            // Skip if already upgraded to this version
            if (currentVersion === lastVersion && hasCompletedUpgrade) {
                logger.info(`Already upgraded to ${currentVersion}, skipping`);
                return null;
            }

            logger.info(`Checking upgrade from ${lastVersion} to ${currentVersion}`);

            // Get applicable migrations
            const migrations = this.registry.getMigrationsForUpgrade(lastVersion, currentVersion);
            
            if (migrations.length === 0) {
                logger.info("No migrations needed for this upgrade");
                await this.markUpgradeComplete(currentVersion);
                await this.showUpgradeDialog(currentVersion, lastVersion);
                return {
                    success: true,
                    migrationsRun: 0,
                    migrationsSkipped: 0,
                    migrationsFailed: 0,
                    results: []
                };
            }

            // Execute migrations
            const result = await this.executeMigrations(migrations, lastVersion, currentVersion);
            
            // Mark upgrade complete if successful
            if (result.success) {
                await this.markUpgradeComplete(currentVersion);
            }

            // Show upgrade dialog
            await this.showUpgradeDialog(currentVersion, lastVersion);

            return result;

        } catch (error) {
            logger.error("Error during upgrade check:", error);
            new Notice("Upgrade check failed - see console for details");
            return {
                success: false,
                migrationsRun: 0,
                migrationsSkipped: 0,
                migrationsFailed: 1,
                results: []
            };
        }
    }

    /**
     * Execute a list of migrations
     */
    private async executeMigrations(
        migrations: BaseMigration[], 
        fromVersion: string, 
        toVersion: string
    ): Promise<UpgradeResult> {
        
        const results: Array<{ migrationId: string; result: MigrationResult }> = [];
        let migrationsRun = 0;
        let migrationsSkipped = 0;
        let migrationsFailed = 0;

        logger.info(`Executing ${migrations.length} migrations`);

        // Show progress modal
        const progressModal = new UpgradeProgressModal(
            this.plugin.app, 
            `Upgrading to v${toVersion}`, 
            migrations.length
        );
        progressModal.open();

        try {
            for (let i = 0; i < migrations.length; i++) {
                const migration = migrations[i];
                
                progressModal.updateStep(i + 1, {
                    title: migration.name,
                    detail: migration.description
                });

                try {
                    const context = await this.createMigrationContext(migration, fromVersion, toVersion);
                    const result = await this.executeSingleMigration(migration, context);
                    
                    results.push({ migrationId: migration.id, result });

                    if (result.success) {
                        migrationsRun++;
                        logger.info(`Migration ${migration.id} completed successfully`);
                    } else {
                        migrationsFailed++;
                        logger.error(`Migration ${migration.id} failed: ${result.message}`);
                    }

                } catch (error) {
                    migrationsFailed++;
                    const errorResult: MigrationResult = {
                        success: false,
                        message: `Migration execution failed: ${error}`,
                        details: { error: String(error) }
                    };
                    results.push({ migrationId: migration.id, result: errorResult });
                    logger.error(`Migration ${migration.id} threw error:`, error);
                }

                // Small delay to show progress
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            const overallSuccess = migrationsFailed === 0;
            
            if (overallSuccess) {
                progressModal.showComplete("All migrations completed successfully");
                new Notice(`Upgrade completed: ${migrationsRun} migrations successful`);
            } else {
                progressModal.showError(`${migrationsFailed} migrations failed`);
                new Notice(`Upgrade completed with errors: ${migrationsFailed} failed, ${migrationsRun} successful`);
            }

            progressModal.closeAfterDelay(3000);

            return {
                success: overallSuccess,
                migrationsRun,
                migrationsSkipped,
                migrationsFailed,
                results
            };

        } catch (error) {
            progressModal.showError("Upgrade process failed");
            progressModal.closeAfterDelay(3000);
            throw error;
        }
    }

    /**
     * Execute a single migration with full workflow
     */
    private async executeSingleMigration(
        migration: BaseMigration, 
        context: MigrationContext
    ): Promise<MigrationResult> {
        
        logger.info(`Starting migration: ${migration.id}`);

        // 1. Check if migration can run
        const canRun = await migration.canRun(context);
        if (!canRun) {
            return {
                success: false,
                message: "Migration prerequisites not met",
                details: { reason: "canRun returned false" }
            };
        }

        // 2. Request user confirmation if needed
        const confirmed = await migration.requestUserConfirmation(context);
        if (!confirmed) {
            return {
                success: true, // User declined, but not an error
                message: "Migration skipped by user",
                details: { reason: "user_declined" }
            };
        }

        // 3. Execute migration
        const result = await migration.execute(context);
        if (!result.success) {
            return result;
        }

        // 4. Verify migration if method exists
        try {
            const verified = await migration.verify(context);
            if (!verified) {
                return {
                    success: false,
                    message: "Migration verification failed",
                    details: { ...result.details, verified: false }
                };
            }
        } catch (error) {
            logger.warn(`Migration ${migration.id} verification failed:`, error);
            // Don't fail the migration for verification errors, just warn
        }

        logger.info(`Migration ${migration.id} completed and verified`);
        return result;
    }

    /**
     * Create migration context
     */
    private async createMigrationContext(
        migration: BaseMigration,
        fromVersion: string,
        toVersion: string
    ): Promise<MigrationContext> {
        const pluginData = await this.plugin.loadData();
        
        return {
            plugin: this.plugin,
            fromVersion,
            toVersion,
            pluginData
        };
    }

    /**
     * Mark upgrade as complete
     */
    private async markUpgradeComplete(version: string): Promise<void> {
        const data = await this.plugin.loadData() || {};
        data.lastVersion = version;
        data.hasCompletedUpgrade = true;
        data.upgradeDate = new Date().toISOString();
        
        await this.plugin.saveData(data);
        logger.info(`Marked upgrade to ${version} as complete`);
    }

    /**
     * Show upgrade completion dialog
     */
    private async showUpgradeDialog(currentVersion: string, lastVersion: string): Promise<void> {
        try {
            const overview = await this.fetchReleaseOverview(currentVersion);
            const message = overview || `Nexus AI Chat Importer has been upgraded to version ${currentVersion}.`;
            
            const paragraphs = [message + this.getDocLinks(currentVersion)];
            
            // Add upgrade warning for very old versions
            let note = undefined;
            if (this.shouldShowUpgradeWarning(lastVersion)) {
                note = this.getUpgradeWarning();
            }

            await showDialog(
                this.plugin.app,
                "information",
                `Upgrade to ${VersionUtils.formatVersion(currentVersion)}`,
                paragraphs,
                note,
                { button1: "Got it!" }
            );

        } catch (error) {
            logger.error("Error showing upgrade dialog:", error);
            // Fallback to simple notice
            new Notice(`Upgraded to Nexus AI Chat Importer v${currentVersion}`);
        }
    }

    /**
     * Fetch release overview from GitHub
     */
    private async fetchReleaseOverview(version: string): Promise<string | null> {
        try {
            const { requestUrl } = require("obsidian");
            const response = await requestUrl({
                url: `${GITHUB.RAW_BASE}/${version}/RELEASE_NOTES.md`,
                method: 'GET'
            });
            
            const overviewRegex = /## Overview\s+(.*?)(?=##|$)/s;
            const match = response.text.match(overviewRegex);
            return match ? match[1].trim() : null;
        } catch (error) {
            logger.warn("Could not fetch release overview:", error);
            return null;
        }
    }

    /**
     * Get documentation links
     */
    private getDocLinks(version: string): string {
        return `\n\n**Resources:**\n• [Full Release Notes](${GITHUB.REPO_BASE}/blob/${version}/RELEASE_NOTES.md)\n• [Documentation](${GITHUB.REPO_BASE}/blob/${version}/README.md)`;
    }

    /**
     * Check if should show upgrade warning for very old versions
     */
    private shouldShowUpgradeWarning(lastVersion: string): boolean {
        return VersionUtils.compareVersions(lastVersion, "1.0.2") < 0;
    }

    /**
     * Get upgrade warning for very old versions
     */
    private getUpgradeWarning(): string {
        return `⚠️ **Important for users upgrading from versions prior to v1.0.2:**\n\nVersion 1.0.2 introduced new metadata parameters required for certain features. For optimal performance and feature compatibility, it's recommended to delete old data and re-import conversations with this new version.`;
    }

    /**
     * Get registry for external access (testing, etc.)
     */
    getRegistry(): UpgradeRegistry {
        return this.registry;
    }

    /**
     * Get upgrade statistics
     */
    getStats(): any {
        return {
            registry: this.registry.getStats(),
            version: this.plugin.manifest.version
        };
    }
}