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

            // Check if already completed upgrade to this version using new structure
            const versionKey = currentVersion.replace(/\./g, '_');
            const hasCompletedThisUpgrade = data?.upgradeHistory?.completedUpgrades?.[versionKey]?.completed;

            console.debug(`[NEXUS-DEBUG] Upgrade history check for '${versionKey}': ${hasCompletedThisUpgrade}`);

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

            // Show upgrade dialog (will handle both overview and manual operations)
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

                // 2. Manual operations will be handled in showUpgradeDialog()
                const manualResults = { success: true, results: [] };
                console.debug(`[NEXUS-DEBUG] Manual operations will be shown in upgrade dialog`);

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
        
        // Initialize upgrade history structure if needed
        if (!data.upgradeHistory) {
            data.upgradeHistory = {
                completedUpgrades: {},
                completedOperations: {}
            };
        }
        
        // Mark upgrade as completed in structured format
        const versionKey = version.replace(/\./g, '_');
        data.upgradeHistory.completedUpgrades[versionKey] = {
            version: version,
            date: new Date().toISOString(),
            completed: true
        };
        
        // Legacy fields for compatibility (can be removed in future versions)
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
     * Show combined upgrade completion dialog with overview (shown once per version)
     */
    private async showUpgradeDialog(currentVersion: string, lastVersion: string): Promise<void> {
        try {
            // Get overview content
            const overview = await this.fetchReleaseOverview(currentVersion);
            const baseMessage = overview || `Nexus AI Chat Importer has been upgraded to version ${currentVersion}.`;
            
            // Build paragraphs array with proper spacing
            const paragraphs: string[] = [];
            
            // Overview section
            paragraphs.push(baseMessage);
            paragraphs.push(this.getDocLinks(currentVersion));
            
            // Add information about automatic operations
            paragraphs.push(""); // Empty paragraph for spacing
            paragraphs.push("**Automatic Operations Completed**");
            paragraphs.push("All necessary upgrade operations have been performed automatically.");
            
            // Check for manual operations (for future versions)
            const operationsData = await this.getManualOperationsForUpgradeDialog();
            
            if (operationsData.length > 0) {
                // Add spacing and operations section
                paragraphs.push(""); // Empty paragraph for spacing
                paragraphs.push("**Optional Operations Available**");
                paragraphs.push("Additional optional operations are available in Settings → Migrations:");
                paragraphs.push(""); // Empty paragraph for spacing
                
                // Add operations list as separate paragraph
                const operationsList: string[] = [];
                for (const versionData of operationsData) {
                    for (const operation of versionData.operations) {
                        operationsList.push(`• **${operation.name}**: ${operation.description}`);
                    }
                }
                paragraphs.push(operationsList.join('\n'));
                
                // Show dialog with operation buttons
                const shouldRunOperations = await showDialog(
                    this.plugin.app,
                    "confirmation",
                    `Upgrade to ${VersionUtils.formatVersion(currentVersion)}`,
                    paragraphs,
                    this.shouldShowUpgradeWarning(lastVersion) ? this.getUpgradeWarning() : undefined,
                    { button1: "Run Optional Operations Now", button2: "Skip (Access Later in Settings)" }
                );
                
                // Execute operations if user chose to run them
                if (shouldRunOperations) {
                    await this.executeUpgradeOperations(operationsData);
                }
            } else {
                // No manual operations - show simple info dialog
                paragraphs.push(""); // Empty paragraph for spacing
                paragraphs.push("You can access additional settings and information in Settings → Migrations if needed.");
                
                await showDialog(
                    this.plugin.app,
                    "information",
                    `Upgrade to ${VersionUtils.formatVersion(currentVersion)}`,
                    paragraphs,
                    this.shouldShowUpgradeWarning(lastVersion) ? this.getUpgradeWarning() : undefined,
                    { button1: "Got it!" }
                );
            }

        } catch (error) {
            logger.error("Error showing upgrade dialog:", error);
            new Notice(`Upgraded to Nexus AI Chat Importer v${currentVersion}`);
        }
    }

    /**
     * Get manual operations for upgrade dialog (filters available operations)
     */
    private async getManualOperationsForUpgradeDialog(): Promise<any[]> {
        const results = [];
        
        for (const upgrade of this.availableUpgrades) {
            const context = await this.createUpgradeContext(upgrade, "0.0.0", this.plugin.manifest.version);
            
            // Get only manual operations (not automatic ones)
            const manualOperations = upgrade.manualOperations || [];
            const operationsStatus = [];
            
            for (const operation of manualOperations) {
                const completed = await this.isOperationCompleted(operation.id, upgrade.version);
                const canRun = !completed && await operation.canRun(context);
                
                operationsStatus.push({
                    operation,
                    completed,
                    canRun
                });
            }
            
            // Only include operations that can run (not completed and meet prerequisites)
            const availableOperations = operationsStatus.filter(status => 
                !status.completed && status.canRun
            );
            
            if (availableOperations.length > 0) {
                results.push({
                    version: upgrade.version,
                    operations: availableOperations.map(status => ({
                        id: status.operation.id,
                        name: status.operation.name,
                        description: status.operation.description
                    }))
                });
            }
        }
        
        return results;
    }

    /**
     * Check if operation was completed using new upgrade history structure
     */
    private async isOperationCompleted(operationId: string, version: string): Promise<boolean> {
        const data = await this.plugin.loadData();
        const operationKey = `operation_${version.replace(/\./g, '_')}_${operationId}`;
        return data?.upgradeHistory?.completedOperations?.[operationKey]?.completed || false;
    }

    /**
     * Execute all available operations
     */
    private async executeUpgradeOperations(operationsData: any[]): Promise<void> {
        for (const versionData of operationsData) {
            for (const operation of versionData.operations) {
                try {
                    console.debug(`[NEXUS-DEBUG] Executing upgrade operation: ${operation.id} (v${versionData.version})`);
                    
                    const result = await this.executeManualOperation(versionData.version, operation.id);
                    
                    if (result.success) {
                        console.debug(`[NEXUS-DEBUG] Operation ${operation.id} completed successfully`);
                    } else {
                        console.error(`[NEXUS-DEBUG] Operation ${operation.id} failed:`, result.message);
                    }
                } catch (error) {
                    console.error(`[NEXUS-DEBUG] Error executing operation ${operation.id}:`, error);
                }
            }
        }
        
        new Notice("Optional operations completed. You can run them again from Settings → Migrations if needed.");
    }

    /**
     * Get documentation links
     */
    private getDocLinks(version: string): string {
        return `**Resources:**
• [Full Release Notes](${GITHUB.REPO_BASE}/blob/${version}/RELEASE_NOTES.md)
• [Documentation](${GITHUB.REPO_BASE}/blob/${version}/README.md)`;
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
        return `⚠️ **Important for users upgrading from versions prior to v1.0.2:**

Version 1.0.2 introduced new metadata parameters required for certain features. For optimal performance and feature compatibility, it's recommended to delete old data and re-import conversations with this new version.`;
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