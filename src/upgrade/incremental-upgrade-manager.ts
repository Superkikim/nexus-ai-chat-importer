/**
 * Nexus AI Chat Importer - Obsidian Plugin
 * Copyright (C) 2024 Akim Sissaoui
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */


// src/upgrade/incremental-upgrade-manager.ts
import { Notice } from "obsidian";
import { VersionUpgrade, UpgradeContext } from "./upgrade-interface";
import { VersionUtils } from "./utils/version-utils";
import { showDialog } from "../dialogs";
import { Logger } from "../logger";
import { GITHUB } from "../config/constants";
import { MultiOperationProgressModal, OperationStatus } from "./utils/multi-operation-progress-modal";
import type NexusAiChatImporterPlugin from "../main";
import { ensureFolderExists } from "../utils";

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
        const { Upgrade120 } = require("./versions/upgrade-1.2.0");
        const { Upgrade130 } = require("./versions/upgrade-1.3.0");

        this.availableUpgrades = [
            new Upgrade110(),
            new Upgrade120(),
            new Upgrade130(),
            // Future: new Upgrade131(), new Upgrade140(), etc.
        ];

        // Sort by version for incremental execution
        this.availableUpgrades.sort((a, b) => {
            return VersionUtils.compareVersions(a.version, b.version);
        });
    }

    /**
     * Main incremental upgrade check and execution
     */
    async checkAndPerformUpgrade(): Promise<IncrementalUpgradeResult | null> {
        try {
            const currentVersion = this.plugin.manifest.version;
            const previousVersion = this.plugin.settings.previousVersion; // ← Use settings instead of data


            // Skip if no version change
            if (previousVersion === currentVersion) {
                return null;
            }

            // Check if already completed upgrade to this version using new structure
            const data = await this.plugin.loadData();
            const versionKey = currentVersion.replace(/\./g, '_');
            const hasCompletedThisUpgrade = data?.upgradeHistory?.completedUpgrades?.[versionKey]?.completed;


            if (hasCompletedThisUpgrade) {
                return null;
            }

            // FRESH INSTALL DETECTION - Skip upgrades if this is a new installation
            const isFreshInstall = await this.detectFreshInstall();

            if (isFreshInstall) {
                await this.markUpgradeComplete(currentVersion);
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

            if (upgradeChain.length === 0) {
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


            // Show upgrade dialog FIRST - INFORMATION ONLY (no cancel option)
            await this.showUpgradeDialog(currentVersion, previousVersion, upgradeChain);

            // Execute upgrade chain with modal (no user choice - automatic)
            const result = await this.executeUpgradeChainWithModal(upgradeChain, previousVersion, currentVersion);

            // Mark overall upgrade complete - ALWAYS (even if some operations were "no-op")
            await this.markUpgradeComplete(currentVersion);

            // Write consolidated upgrade report
            try {
                await this.writeUpgradeReport(previousVersion, currentVersion, upgradeChain, result);
            } catch (e) {
                console.error("[NEXUS-DEBUG] ❌ Failed to write consolidated upgrade report", e);
                console.error("[NEXUS-DEBUG] Error stack:", e instanceof Error ? e.stack : 'No stack trace');
            }

            // Note: Folder configuration is now handled by ConfigureFolderLocationsOperation (task 5)
            // No need for separate UpgradeNoticeDialog anymore

            return result;




        } catch (error) {
            console.error(`[NEXUS-DEBUG] Incremental upgrade FAILED:`, error);

            // Check if user cancelled
            if (error instanceof Error && error.message === "User cancelled upgrade") {
                new Notice("Migration cancelled. Please complete the migration before importing.");
                return {
                    success: false,
                    upgradesExecuted: 0,
                    upgradesSkipped: 0,
                    upgradesFailed: 0,
                    results: []
                };
            }

            // Other errors
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
            const conversationFolder = this.plugin.settings.conversationFolder;
            const allFiles = this.plugin.app.vault.getMarkdownFiles();

            const existingConversations = allFiles.filter(file => {
                if (!file.path.startsWith(conversationFolder)) return false;

                // Exclude Reports and Attachments folders
                const relativePath = file.path.substring(conversationFolder.length + 1);
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

                const context = await this.createUpgradeContext(upgrade, fromVersion, toVersion);

                // Execute automatic operations with progress updates
                const automaticResults = await this.executeOperationsWithProgress(
                    upgrade.automaticOperations,
                    context,
                    upgrade.version,
                    progressModal
                );


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
        // Execute the operation
        const result = await operation.execute(context);

        // Update progress to 100% when complete
        progressModal.updateOperation(modalOperationId, {
            status: 'running',
            progress: 100
        });

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
    }

    /**
     * Write a consolidated upgrade report per run
     */
    private async writeUpgradeReport(
        fromVersion: string,
        toVersion: string,
        upgradeChain: VersionUpgrade[],
        result: IncrementalUpgradeResult
    ): Promise<void> {

        const reportRoot = this.plugin.settings.reportFolder || "Nexus/Reports";

        const upgradesFolder = `${reportRoot}/Upgrades`;

        const folderResult = await ensureFolderExists(upgradesFolder, this.plugin.app.vault);

        if (!folderResult.success) {
            console.error(`[NEXUS-UPGRADE-REPORT] ❌ Failed to create folder: ${folderResult.error}`);
            throw new Error(`Failed to create upgrades folder: ${folderResult.error}`);
        }

        const now = new Date();
        const pad = (n: number) => n.toString().padStart(2, '0');
        const ts = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
        const fileName = `${ts} - Upgrade to ${toVersion}.md`;
        const filePath = `${upgradesFolder}/${fileName}`;

        // Build a map to resolve operation names per version
        const opsByVersion: Record<string, Record<string, string>> = {};
        for (const up of upgradeChain) {
            opsByVersion[up.version] = {};
            for (const op of up.automaticOperations) {
                opsByVersion[up.version][op.id] = op.name;
            }
        }

        // Overview
        const readmeUrl = `${GITHUB.REPO_BASE}#readme`;
        const issuesUrl = `${GITHUB.REPO_BASE}/issues`;

        const totalVersions = result.results.length;
        const totalOps = result.results.reduce((acc, v) => acc + (v.automaticResults?.results?.length || 0), 0);

        let md = `# Upgrade to v${toVersion}\n\n`;
        md += `From v${fromVersion} → v${toVersion}\n\n`;
        md += `- Versions processed: ${totalVersions}\n`;
        md += `- Operations executed: ${totalOps}\n\n`;
        md += `See the latest README and release notes: ${readmeUrl}\n\n`;
        md += `Report or review issues: ${issuesUrl}\n\n`;

        // Sections per upgrade version and operation
        for (const entry of result.results) {
            md += `## ${entry.version}\n\n`;
            const ops = entry.automaticResults?.results || [];

            if (!ops.length) {
                md += `- No automatic operations\n\n`;
                continue;
            }
            for (const opRes of ops) {
                const opId = opRes.operationId;
                const opName = opsByVersion[entry.version]?.[opId] || opId;
                const ok = opRes.result?.success === true;
                const status = ok ? '✅' : '⚠️';
                const msg = opRes.result?.message || '';
                md += `### ${opName} ${status}\n\n`;
                if (msg) md += `${msg}\n\n`;

                const details = opRes.result?.details;
                if (details) {
                    // Format details based on type
                    if (Array.isArray(details)) {
                        // Array of strings (e.g., migration results)
                        if (details.length > 0) {
                            for (const item of details) {
                                if (typeof item === 'string') {
                                    md += `${item}\n`;
                                }
                            }
                            md += `\n`;
                        }
                    } else if (typeof details === 'object') {
                        // Object with key-value pairs (e.g., statistics)
                        const keys = Object.keys(details);
                        if (keys.length > 0 && !keys.every(k => /^\d+$/.test(k))) {
                            // Only show if not array-like keys (0, 1, 2...)
                            md += `**Statistics:**\n\n`;
                            for (const key of keys) {
                                const value = details[key as keyof typeof details];
                                md += `- ${key}: ${String(value)}\n`;
                            }
                            md += `\n`;
                        }
                    }
                }
            }
        }


        try {
            await this.plugin.app.vault.create(filePath, md);
        } catch (error) {
            console.error(`[NEXUS-UPGRADE-REPORT] ❌ Failed to write report file:`, error);
            console.error(`[NEXUS-UPGRADE-REPORT] Error details:`, {
                message: error instanceof Error ? error.message : String(error),
                filePath,
                contentLength: md.length
            });
            throw error;
        }
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
                // Check if this is the v1.2.0 or v1.3.0 upgrade - use beautiful modal
                const isV120Upgrade = upgradeChain.some(upgrade => upgrade.version === "1.2.0");
                const isV130Upgrade = upgradeChain.some(upgrade => upgrade.version === "1.3.0");

                if (isV130Upgrade) {
                    // Use beautiful upgrade modal for v1.3.0
                    const { NexusUpgradeModal130 } = await import("../dialogs/upgrade-modal-1.3.0");
                    const userChoice = await new Promise<string>((resolve) => {
                        new NexusUpgradeModal130(this.plugin.app, this.plugin, "1.3.0", resolve).open();
                    });

                    // If user cancelled/closed dialog, throw error to abort upgrade
                    if (userChoice !== "ok") {
                        throw new Error("User cancelled upgrade");
                    }
                } else if (isV120Upgrade) {
                    // Use beautiful upgrade modal for v1.2.0
                    const { NexusUpgradeModal } = require("./versions/upgrade-1.2.0");
                    await new Promise<void>((resolve) => {
                        new NexusUpgradeModal(this.plugin.app, this.plugin, "1.2.0", resolve).open();
                    });
                } else {
                    // Use standard dialog for other upgrades
                    await showDialog(
                        this.plugin.app,
                        "information",
                        `Upgrade to ${VersionUtils.formatVersion(currentVersion)}`,
                        paragraphs,
                        this.shouldShowUpgradeWarning(lastVersion) ? this.getUpgradeWarning() : undefined,
                        { button1: "Proceed with Upgrade" }
                    );
                }
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