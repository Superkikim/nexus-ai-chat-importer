// src/upgrade/incremental-upgrade-manager.ts
import { Notice } from "obsidian";
import { VersionUpgrade, UpgradeContext } from "./upgrade-interface";
import { VersionUtils } from "./utils/version-utils";
import { showDialog } from "../dialogs";
import { Logger } from "../logger";
import { GITHUB } from "../config/constants";
import type NexusAiChatImporterPlugin from "../main";

const logger = new Logger();

export interface IncrementalUpgradeResult {
    success: boolean;
    upgradesExecuted: number;
    upgradesSkipped: number;
    upgradesFailed: number;
    results: Array<{
        version: string;
        automaticResults: any;
        manualResults: any;
    }>;
}

export class IncrementalUpgradeManager {
    private availableUpgrades: VersionUpgrade[] = [];
    private plugin: NexusAiChatImporterPlugin;

    constructor(plugin: NexusAiChatImporterPlugin) {
        this.plugin = plugin;
        this.registerUpgrades();
    }

    /**
     * Register all available version upgrades
     */
    private registerUpgrades(): void {
        // Import and register upgrades
        const { Upgrade110 } = require("./versions/upgrade-1.1.0");
        
        this.availableUpgrades = [
            new Upgrade110(),
            // Future: new Upgrade111(), new Upgrade120(), etc.
        ];

        // Sort by version for incremental execution
        this.availableUpgrades.sort((a, b) => {
            return VersionUtils.compareVersions(a.version, b.version);
        });

        logger.info(`Registered ${this.availableUpgrades.length} version upgrades`);
    }

    /**
     * Main incremental upgrade check and execution
     */
    async checkAndPerformUpgrade(): Promise<IncrementalUpgradeResult | null> {
        try {
            const currentVersion = this.plugin.manifest.version;
            const data = await this.plugin.loadData();
            const lastVersion = data?.lastVersion || "0.0.0";

            console.debug(`[NEXUS-DEBUG] Incremental upgrade check: ${lastVersion} → ${currentVersion}`);

            // Check if already completed upgrade to this version
            const upgradeCompleteFlag = `upgrade_completed_${currentVersion.replace(/\./g, '_')}`;
            const hasCompletedThisUpgrade = !!data?.[upgradeCompleteFlag];

            console.debug(`[NEXUS-DEBUG] Upgrade flag '${upgradeCompleteFlag}': ${hasCompletedThisUpgrade}`);

            if (hasCompletedThisUpgrade) {
                console.debug(`[NEXUS-DEBUG] Upgrade already completed - SKIPPING ALL`);
                logger.info(`Already completed upgrade to ${currentVersion}, skipping`);
                return null;
            }

            // Get upgrade chain: all upgrades between lastVersion and currentVersion
            const upgradeChain = this.getUpgradeChain(lastVersion, currentVersion);
            console.debug(`[NEXUS-DEBUG] Upgrade chain:`, upgradeChain.map(u => u.version));

            if (upgradeChain.length === 0) {
                console.debug(`[NEXUS-DEBUG] No upgrades needed - marking complete`);
                await this.markUpgradeComplete(currentVersion);
                await this.showUpgradeDialog(currentVersion, lastVersion);
                return {
                    success: true,
                    upgradesExecuted: 0,
                    upgradesSkipped: 0,
                    upgradesFailed: 0,
                    results: []
                };
            }

            console.debug(`[NEXUS-DEBUG] Executing ${upgradeChain.length} upgrades incrementally...`);

            // Execute upgrade chain incrementally
            const result = await this.executeUpgradeChain(upgradeChain, lastVersion, currentVersion);

            // Mark overall upgrade complete if successful
            if (result.success) {
                console.debug(`[NEXUS-DEBUG] All upgrades successful - marking overall upgrade complete`);
                await this.markUpgradeComplete(currentVersion);
            } else {
                console.debug(`[NEXUS-DEBUG] Some upgrades failed - NOT marking overall upgrade complete`);
            }

            // Show upgrade dialog
            await this.showUpgradeDialog(currentVersion, lastVersion);

            return result;

        } catch (error) {
            console.error(`[NEXUS-DEBUG] Incremental upgrade FAILED:`, error);
            logger.error("Error during incremental upgrade:", error);
            new Notice("Upgrade failed - see console for details");
            return {
                success: false,
                upgradesExecuted: 0,
                upgradesSkipped: 0,
                upgradesFailed: 1,
                results: []
            };
        }
    }

    /**
     * Get chain of upgrades to execute incrementally
     */
    private getUpgradeChain(fromVersion: string, toVersion: string): VersionUpgrade[] {
        return this.availableUpgrades.filter(upgrade => 
            upgrade.shouldRun(fromVersion, toVersion)
        );
    }

    /**
     * Execute upgrade chain incrementally
     */
    private async executeUpgradeChain(
        upgradeChain: VersionUpgrade[],
        fromVersion: string,
        toVersion: string
    ): Promise<IncrementalUpgradeResult> {
        
        const results = [];
        let upgradesExecuted = 0;
        let upgradesSkipped = 0;
        let upgradesFailed = 0;

        for (const upgrade of upgradeChain) {
            try {
                console.debug(`[NEXUS-DEBUG] Executing upgrade ${upgrade.version}...`);
                
                const context = await this.createUpgradeContext(upgrade, fromVersion, toVersion);
                
                // 1. Execute automatic operations first
                const automaticResults = await upgrade.executeAutomaticOperations(context);
                console.debug(`[NEXUS-DEBUG] Automatic operations for ${upgrade.version}:`, automaticResults);

                // 2. Show manual operations dialog
                const manualResults = await upgrade.showManualOperationsDialog(context);
                console.debug(`[NEXUS-DEBUG] Manual operations for ${upgrade.version}:`, manualResults);

                results.push({
                    version: upgrade.version,
                    automaticResults,
                    manualResults
                });

                if (automaticResults.success && manualResults.success) {
                    upgradesExecuted++;
                } else {
                    upgradesFailed++;
                }

            } catch (error) {
                console.error(`[NEXUS-DEBUG] Upgrade ${upgrade.version} failed:`, error);
                upgradesFailed++;
                results.push({
                    version: upgrade.version,
                    automaticResults: { success: false, results: [] },
                    manualResults: { success: false, results: [] }
                });
            }
        }

        const overallSuccess = upgradesFailed === 0;
        
        if (overallSuccess) {
            new Notice(`Upgrade completed: ${upgradesExecuted} versions processed successfully`);
        } else {
            new Notice(`Upgrade completed with errors: ${upgradesFailed} failed, ${upgradesExecuted} successful`);
        }

        return {
            success: overallSuccess,
            upgradesExecuted,
            upgradesSkipped,
            upgradesFailed,
            results
        };
    }

    /**
     * Create upgrade context
     */
    private async createUpgradeContext(
        upgrade: VersionUpgrade,
        fromVersion: string,
        toVersion: string
    ): Promise<UpgradeContext> {
        const pluginData = await this.plugin.loadData();
        
        return {
            plugin: this.plugin,
            fromVersion,
            toVersion,
            pluginData
        };
    }

    /**
     * Mark overall upgrade as complete
     */
    private async markUpgradeComplete(version: string): Promise<void> {
        const data = await this.plugin.loadData() || {};
        
        // Version-specific flag (main check)
        const upgradeCompleteFlag = `upgrade_completed_${version.replace(/\./g, '_')}`;
        data[upgradeCompleteFlag] = true;
        data[`${upgradeCompleteFlag}_date`] = new Date().toISOString();
        
        // Legacy fields for compatibility
        data.lastVersion = version;
        data.hasCompletedUpgrade = true;
        data.upgradeDate = new Date().toISOString();
        
        // Version tracking
        if (VersionUtils.compareVersions(version, "1.1.0") >= 0) {
            data.versionTrackingEnabled = true;
        }
        
        await this.plugin.saveData(data);
        logger.info(`Marked overall upgrade to ${version} as complete`);
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
     * Get manual operations status for settings UI
     */
    async getManualOperationsForSettings(): Promise<Array<{
        version: string;
        operations: Array<{
            id: string;
            name: string;
            description: string;
            completed: boolean;
            canRun: boolean;
        }>;
    }>> {
        const results = [];
        
        for (const upgrade of this.availableUpgrades) {
            const context = await this.createUpgradeContext(upgrade, "0.0.0", this.plugin.manifest.version);
            const operationsStatus = await upgrade.getManualOperationsStatus(context);
            
            if (operationsStatus.length > 0) {
                results.push({
                    version: upgrade.version,
                    operations: operationsStatus.map(status => ({
                        id: status.operation.id,
                        name: status.operation.name,
                        description: status.operation.description,
                        completed: status.completed,
                        canRun: status.canRun
                    }))
                });
            }
        }
        
        return results;
    }

    /**
     * Execute single manual operation from settings
     */
    async executeManualOperation(version: string, operationId: string): Promise<{success: boolean; message: string}> {
        const upgrade = this.availableUpgrades.find(u => u.version === version);
        if (!upgrade) {
            return { success: false, message: "Upgrade version not found" };
        }

        const context = await this.createUpgradeContext(upgrade, "0.0.0", this.plugin.manifest.version);
        const result = await upgrade.executeManualOperation(operationId, context);
        
        return {
            success: result.success,
            message: result.message
        };
    }
}