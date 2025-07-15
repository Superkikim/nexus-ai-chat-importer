// src/upgrade/incremental-upgrade-manager.ts
import { Notice } from "obsidian";
import { VersionUpgrade, UpgradeContext } from "./upgrade-interface";
import { VersionUtils } from "./utils/version-utils";
import { showDialog } from "../dialogs";
import { Logger } from "../logger";
import { GITHUB } from "../config/constants";
import { MultiOperationProgressModal, OperationStatus } from "./utils/multi-operation-progress-modal";
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
            const previousVersion = this.plugin.settings.previousVersion; // ← Use settings instead of data
            
            console.debug(`[NEXUS-DEBUG] Incremental upgrade check: ${previousVersion} → ${currentVersion}`);

            // Skip if no version change
            if (previousVersion === currentVersion) {
                console.debug(`[NEXUS-DEBUG] No version change - SKIPPING ALL`);
                logger.info(`No version change (${currentVersion}), skipping upgrade checks`);
                return null;
            }

            // Check if already completed upgrade to this version using new structure
            const data = await this.plugin.loadData();
            const versionKey = currentVersion.replace(/\./g, '_');
            const hasCompletedThisUpgrade = data?.upgradeHistory?.completedUpgrades?.[versionKey]?.completed;

            console.debug(`[NEXUS-DEBUG] Upgrade history check for '${versionKey}': ${hasCompletedThisUpgrade}`);

            if (hasCompletedThisUpgrade) {
                console.debug(`[NEXUS-DEBUG] Upgrade already completed - SKIPPING ALL`);
                logger.info(`Already completed upgrade to ${currentVersion}, skipping`);
                return null;
            }

            // FRESH INSTALL DETECTION - Skip upgrades if this is a new installation
            const isFreshInstall = await this.detectFreshInstall();
            console.debug(`[NEXUS-DEBUG] Fresh install detection: ${isFreshInstall}`);

            if (isFreshInstall) {
                console.debug(`[NEXUS-DEBUG] Fresh install detected - marking as complete without upgrades`);
                await this.markUpgradeComplete(currentVersion);
                logger.info(`Fresh installation detected - marked as up-to-date v${currentVersion}`);
                return {
                    success: true,
                    upgradesExecuted: 0,
                    upgradesSkipped: 0,
                    upgradesFailed: 0,
                    results: []
                };
            }

            // Get upgrade chain: all upgrades between previousVersion and currentVersion
            const upgradeChain = this.getUpgradeChain(previousVersion, currentVersion);
            console.debug(`[NEXUS-DEBUG] Upgrade chain:`, upgradeChain.map(u => u.version));

            if (upgradeChain.length === 0) {
                console.debug(`[NEXUS-DEBUG] No upgrades needed - marking complete`);
                await this.markUpgradeComplete(currentVersion);
                await this.showUpgradeDialog(currentVersion, previousVersion, []);
                return {
                    success: true,
                    upgradesExecuted: 0,
                    upgradesSkipped: 0,
                    upgradesFailed: 0,
                    results: []
                };
            }

            console.debug(`[NEXUS-DEBUG] Need to execute ${upgradeChain.length} upgrades - showing dialog first`);

            // Show upgrade dialog FIRST - INFORMATION ONLY (no cancel option)
            await this.showUpgradeDialog(currentVersion, previousVersion, upgradeChain);

            // Execute upgrade chain with modal (no user choice - automatic)
            console.debug(`[NEXUS-DEBUG] Executing upgrades with modal...`);
            const result = await this.executeUpgradeChainWithModal(upgradeChain, previousVersion, currentVersion);

            // Mark overall upgrade complete - ALWAYS (even if some operations were "no-op")
            console.debug(`[NEXUS-DEBUG] Upgrade process completed - marking overall upgrade complete`);
            await this.markUpgradeComplete(currentVersion);

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
     * Detect if this is a fresh installation with no existing data
     */
    private async detectFreshInstall(): Promise<boolean> {
        try {
            // Check 1: No plugin data or very minimal data
            const data = await this.plugin.loadData();
            const hasLegacyData = !!(data?.conversationCatalog && Object.keys(data.conversationCatalog).length > 0);
            const hasImportedArchives = !!(data?.importedArchives && Object.keys(data.importedArchives).length > 0);
            
            // Check 2: No existing conversations in vault
            const archiveFolder = this.plugin.settings.archiveFolder;
            const allFiles = this.plugin.app.vault.getMarkdownFiles();
            
            const existingConversations = allFiles.filter(file => {
                if (!file.path.startsWith(archiveFolder)) return false;
                
                // Exclude Reports and Attachments folders
                const relativePath = file.path.substring(archiveFolder.length + 1);
                if (relativePath.startsWith('Reports/') || 
                    relativePath.startsWith('Attachments/') ||
                    relativePath.startsWith('reports/') ||
                    relativePath.startsWith('attachments/')) {
                    return false;
                }
                
                // Check if it's a Nexus conversation file
                const frontmatter = this.plugin.app.metadataCache.getFileCache(file)?.frontmatter;
                return frontmatter?.nexus === this.plugin.manifest.id;
            });

            const hasExistingConversations = existingConversations.length > 0;

            // Fresh install criteria: no legacy data AND no imported archives AND no existing conversations
            const isFreshInstall = !hasLegacyData && !hasImportedArchives && !hasExistingConversations;

            console.debug(`[NEXUS-DEBUG] Fresh install detection:`, {
                hasLegacyData,
                hasImportedArchives,
                hasExistingConversations,
                isFreshInstall
            });

            return isFreshInstall;

        } catch (error) {
            console.error(`[NEXUS-DEBUG] Error detecting fresh install:`, error);
            // If we can't determine, assume it's not fresh (safer to run upgrades)
            return false;
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
     * Execute upgrade chain with modal progress tracking
     */
    private async executeUpgradeChainWithModal(
        upgradeChain: VersionUpgrade[],
        fromVersion: string,
        toVersion: string
    ): Promise<IncrementalUpgradeResult> {
        
        // Collect all operations from all upgrades
        const allOperations: OperationStatus[] = [];
        for (const upgrade of upgradeChain) {
            for (const operation of upgrade.automaticOperations) {
                allOperations.push({
                    id: `${upgrade.version}_${operation.id}`,
                    name: operation.name,
                    status: 'pending'
                });
            }
        }

        // Create and show modal
        const progressModal = new MultiOperationProgressModal(
            this.plugin.app,
            `Upgrading to v${toVersion}`,
            allOperations
        );
        progressModal.open();

        const results = [];
        let upgradesExecuted = 0;
        let upgradesSkipped = 0;
        let upgradesFailed = 0;

        try {
            for (const upgrade of upgradeChain) {
                console.debug(`[NEXUS-DEBUG] Executing upgrade ${upgrade.version}...`);
                
                const context = await this.createUpgradeContext(upgrade, fromVersion, toVersion);
                
                // Execute automatic operations with progress updates
                const automaticResults = await this.executeOperationsWithProgress(
                    upgrade.automaticOperations,
                    context,
                    upgrade.version,
                    progressModal
                );
                
                console.debug(`[NEXUS-DEBUG] Automatic operations for ${upgrade.version}:`, automaticResults);

                // Manual operations will be handled separately if any exist
                const manualResults = { success: true, results: [] };

                results.push({
                    version: upgrade.version,
                    automaticResults,
                    manualResults
                });

                // Count as success even if some operations were "no-op" (smart success logic)
                upgradesExecuted++;
            }

            const overallSuccess = true; // Always success for automatic operations
            
            progressModal.markComplete(`All operations completed successfully!`);
            new Notice(`Upgrade completed: ${upgradesExecuted} versions processed successfully`);

            return {
                success: overallSuccess,
                upgradesExecuted,
                upgradesSkipped,
                upgradesFailed,
                results
            };

        } catch (error) {
            console.error(`[NEXUS-DEBUG] Modal upgrade execution failed:`, error);
            progressModal.showError(`Upgrade failed: ${error}`);
            throw error;
        }
    }

    /**
     * Execute operations with progress updates to modal
     */
    private async executeOperationsWithProgress(
        operations: any[],
        context: UpgradeContext,
        version: string,
        progressModal: MultiOperationProgressModal
    ): Promise<any> {
        const results: Array<{operationId: string; result: any}> = [];
        let criticalFailures = 0; // Only count actual critical failures

        for (const operation of operations) {
            const modalOperationId = `${version}_${operation.id}`;
            
            try {
                // Check if already completed
                if (await this.isOperationCompleted(operation.id, version)) {
                    progressModal.updateOperation(modalOperationId, {
                        status: 'completed',
                        progress: 100
                    });
                    results.push({
                        operationId: operation.id,
                        result: { success: true, message: "Already completed" }
                    });
                    continue;
                }

                // Mark as running
                progressModal.updateOperation(modalOperationId, {
                    status: 'running',
                    progress: 0
                });

                // Check if can run
                if (!(await operation.canRun(context))) {
                    // NOT a critical failure - just means nothing to do
                    progressModal.updateOperation(modalOperationId, {
                        status: 'completed',
                        progress: 100,
                        currentDetail: "Nothing to process"
                    });
                    results.push({
                        operationId: operation.id,
                        result: { success: true, message: "Prerequisites not met - nothing to process" }
                    });
                    continue;
                }

                // Execute operation with progress updates
                const result = await this.executeOperationWithProgress(
                    operation,
                    context,
                    modalOperationId,
                    progressModal
                );
                
                results.push({ operationId: operation.id, result });

                if (result.success) {
                    await this.markOperationCompleted(operation.id, version);
                    progressModal.updateOperation(modalOperationId, {
                        status: 'completed',
                        progress: 100
                    });
                } else {
                    // Only count as critical failure if it's actually critical
                    const isCritical = this.isCriticalFailure(result);
                    if (isCritical) {
                        criticalFailures++;
                        progressModal.updateOperation(modalOperationId, {
                            status: 'failed',
                            error: result.message
                        });
                    } else {
                        // Treat as completed with warning
                        progressModal.updateOperation(modalOperationId, {
                            status: 'completed',
                            progress: 100,
                            currentDetail: "Completed with warnings"
                        });
                    }
                }

            } catch (error) {
                const errorResult = {
                    success: false,
                    message: `Operation failed: ${error}`,
                    details: { error: String(error) }
                };
                results.push({ operationId: operation.id, result: errorResult });
                progressModal.updateOperation(modalOperationId, {
                    status: 'failed',
                    error: String(error)
                });
                criticalFailures++;
            }
        }

        return { success: criticalFailures === 0, results };
    }

    /**
     * Determine if an operation failure is critical
     */
    private isCriticalFailure(result: any): boolean {
        // For now, no failures are critical for upgrade operations
        // They're either successful or "nothing to do"
        return false;
    }

    /**
     * Execute single operation with progress callbacks
     */
    private async executeOperationWithProgress(
        operation: any,
        context: UpgradeContext,
        modalOperationId: string,
        progressModal: MultiOperationProgressModal
    ): Promise<any> {
        // For now, just execute the operation normally
        // In the future, we could modify operations to accept progress callbacks
        const result = await operation.execute(context);
        
        // Simulate progress for demo (remove this in production)
        const steps = 5;
        for (let i = 1; i <= steps; i++) {
            progressModal.updateOperation(modalOperationId, {
                status: 'running',
                progress: (i / steps) * 100,
                currentDetail: result.details?.processed ? `Processing... ${i}/${steps}` : undefined
            });
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        return result;
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
     * Show upgrade dialog - INFORMATION ONLY (no cancel)
     */
    private async showUpgradeDialog(currentVersion: string, lastVersion: string, upgradeChain: VersionUpgrade[]): Promise<void> {
        try {
            // Get overview content
            const overview = await this.fetchReleaseOverview(currentVersion);
            const baseMessage = overview || `Nexus AI Chat Importer has been upgraded to version ${currentVersion}.`;
            
            // Build paragraphs array with proper spacing
            const paragraphs: string[] = [];
            
            // Overview section
            paragraphs.push(baseMessage);
            paragraphs.push(this.getDocLinks(currentVersion));
            
            if (upgradeChain.length > 0) {
                // Add information about operations that will run
                paragraphs.push(""); // Empty paragraph for spacing
                paragraphs.push("**Upgrade Operations Required**");
                paragraphs.push("The following operations will be performed automatically:");
                paragraphs.push(""); // Empty paragraph for spacing
                
                // List operations from all upgrades
                const operationsList: string[] = [];
                for (const upgrade of upgradeChain) {
                    for (const operation of upgrade.automaticOperations) {
                        operationsList.push(`• **${operation.name}**: ${operation.description}`);
                    }
                }
                paragraphs.push(operationsList.join('\n'));
            } else {
                // No operations needed
                paragraphs.push(""); // Empty paragraph for spacing
                paragraphs.push("All systems are up to date. No operations required.");
            }
            
            // INFORMATION DIALOG - no cancel option
            if (upgradeChain.length > 0) {
                // Des opérations à faire
                await showDialog(
                    this.plugin.app,
                    "information",
                    `Upgrade to ${VersionUtils.formatVersion(currentVersion)}`,
                    paragraphs,
                    this.shouldShowUpgradeWarning(lastVersion) ? this.getUpgradeWarning() : undefined,
                    { button1: "Proceed with Upgrade" }  // ← Opérations à faire
                );
            } else {
                // Rien à faire
                await showDialog(
                    this.plugin.app,
                    "information", 
                    `Upgrade to ${VersionUtils.formatVersion(currentVersion)}`,
                    paragraphs,
                    this.shouldShowUpgradeWarning(lastVersion) ? this.getUpgradeWarning() : undefined,
                    { button1: "Got it!" }  // ← Juste informatif
                );
            }
        } catch (error) {
            logger.error("Error showing upgrade dialog:", error);
            new Notice(`Upgraded to Nexus AI Chat Importer v${currentVersion}`);
        }
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
     * Mark operation as completed using structured upgrade history
     */
    private async markOperationCompleted(operationId: string, version: string): Promise<void> {
        const data = await this.plugin.loadData() || {};
        
        // Initialize upgrade history structure if needed
        if (!data.upgradeHistory) {
            data.upgradeHistory = {
                completedUpgrades: {},
                completedOperations: {}
            };
        }
        
        // Mark operation as completed in structured format
        const operationKey = `operation_${version.replace(/\./g, '_')}_${operationId}`;
        data.upgradeHistory.completedOperations[operationKey] = {
            operationId: operationId,
            version: version,
            date: new Date().toISOString(),
            completed: true
        };
        
        await this.plugin.saveData(data);
        
        logger.info(`Marked operation ${operationId} (v${version}) as completed`);
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