// src/upgrade.ts
import { requestUrl, Plugin } from "obsidian";
import { showDialog } from "./dialogs";
import { Logger } from "./logger";
import { GITHUB } from "./config/constants";

const logger = new Logger();

export class Upgrader {
    private plugin: Plugin;

    constructor(plugin: Plugin) {
        this.plugin = plugin;
    }

    async checkForUpgrade() {
        try {
            const currentVersion = this.plugin.manifest.version;
            const data = await this.plugin.loadData();
            const lastVersion = data?.lastVersion || "0.0.0";
            const hasCompletedUpgrade = data?.hasCompletedUpgrade || false;

            // Perform the upgrade only if it hasn't been completed
            if (currentVersion !== lastVersion && !hasCompletedUpgrade) {
                await this.performUpgrade(currentVersion, lastVersion);
                const data = await this.plugin.loadData() || {};
                data.lastVersion = currentVersion;
                data.hasCompletedUpgrade = true;
                await this.plugin.saveData(data);
            }
        } catch (error) {
            logger.error("Error during upgrade check:", error);
        }
    }

    private async performUpgrade(currentVersion: string, lastVersion: string) {
        return this.showUpgradeDialog(currentVersion, lastVersion);
    }

    private async fetchOverview(version: string): Promise<string | null> {
        try {
            const response = await requestUrl({
                url: `${GITHUB.RAW_BASE}/${version}/RELEASE_NOTES.md`,
                method: 'GET'
            });
            
            const overviewRegex = /## Overview\s+(.*?)(?=##|$)/s;
            const match = response.text.match(overviewRegex);
            return match ? match[1].trim() : null;
        } catch (error) {
            logger.error("Error fetching overview:", error);
            return null;
        }
    }

    private getDefaultMessage(version: string): string {
        return `Nexus AI Chat Importer has been upgraded to version ${version}.`;
    }

    private getDocLinks(version: string): string {
        return `\n\n**Resources:**\n• [Full Release Notes](${GITHUB.REPO_BASE}/blob/${version}/RELEASE_NOTES.md)\n• [Documentation](${GITHUB.REPO_BASE}/blob/${version}/README.md)`;
    }

    private shouldShowUpgradeWarning(lastVersion: string): boolean {
        // Show warning if upgrading from versions prior to 1.0.2
        const lastVersionParts = lastVersion.split('.').map(Number);
        if (lastVersionParts[0] < 1) return true;
        if (lastVersionParts[0] === 1 && lastVersionParts[1] === 0 && lastVersionParts[2] < 2) return true;
        return false;
    }

    private getUpgradeWarning(): string {
        return `⚠️ **Important for users upgrading from versions prior to v1.0.2:**\n\nVersion 1.0.2 introduced new metadata parameters required for certain features. For optimal performance and feature compatibility, it's recommended to delete old data and re-import conversations with this new version.`;
    }

    private async showUpgradeDialog(currentVersion: string, lastVersion: string) {
        const overview = await this.fetchOverview(currentVersion);
        const message = overview || this.getDefaultMessage(currentVersion);
        
        const paragraphs = [message + this.getDocLinks(currentVersion)];
        
        // Add upgrade warning if upgrading from old version
        let note = undefined;
        if (this.shouldShowUpgradeWarning(lastVersion)) {
            note = this.getUpgradeWarning();
        }

        return showDialog(
            this.plugin.app,
            "information",
            `Upgrade to version ${currentVersion}`,
            paragraphs,
            note,
            { button1: "Got it!" }
        );
    }
}