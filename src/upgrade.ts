// src/upgrade.ts (REPLACED - New modular version)
import { Plugin } from "obsidian";
import { UpgradeManager } from "./upgrade/upgrade-manager";
import { Logger } from "./logger";

const logger = new Logger();

export class Upgrader {
    private plugin: Plugin;
    private upgradeManager: UpgradeManager;

    constructor(plugin: Plugin) {
        this.plugin = plugin;
        this.upgradeManager = new UpgradeManager(plugin as any);
    }

    /**
     * Main upgrade check - now delegates to modular system
     */
    async checkForUpgrade(): Promise<void> {
        try {
            console.debug("[NEXUS-DEBUG] Upgrader.checkForUpgrade() - Starting");
            logger.info("Starting upgrade check with modular system");
            
            const result = await this.upgradeManager.checkAndPerformUpgrade();
            
            if (result) {
                console.debug("[NEXUS-DEBUG] Upgrade result:", result);
                logger.info("Upgrade completed:", {
                    success: result.success,
                    migrationsRun: result.migrationsRun,
                    migrationsFailed: result.migrationsFailed
                });
            } else {
                console.debug("[NEXUS-DEBUG] No upgrade needed");
                logger.info("No upgrade needed");
            }

        } catch (error) {
            console.error("[NEXUS-DEBUG] Upgrade system FAILED:", error);
            logger.error("Modular upgrade system failed:", error);
            
            // Fallback to basic version marking (in case of critical errors)
            try {
                await this.fallbackUpgrade();
            } catch (fallbackError) {
                console.error("[NEXUS-DEBUG] Fallback upgrade also FAILED:", fallbackError);
                logger.error("Fallback upgrade also failed:", fallbackError);
            }
        }
    }

    /**
     * Fallback upgrade - just mark version without migrations
     */
    private async fallbackUpgrade(): Promise<void> {
        const currentVersion = this.plugin.manifest.version;
        const data = await this.plugin.loadData() || {};
        
        data.lastVersion = currentVersion;
        data.hasCompletedUpgrade = true;
        data.fallbackUpgrade = true;
        data.upgradeDate = new Date().toISOString();
        
        await this.plugin.saveData(data);
        logger.info(`Fallback upgrade completed for version ${currentVersion}`);
    }

    /**
     * Get upgrade manager for testing/debugging
     */
    getUpgradeManager(): UpgradeManager {
        return this.upgradeManager;
    }
}