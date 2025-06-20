// upgrade.ts
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
            const lastVersion = (await this.plugin.loadData("lastVersion")) || "0.0.0";
            const hasCompletedUpgrade = (await this.plugin.loadData("hasCompletedUpgrade")) || false;

            // Perform the upgrade only if it hasn't been completed
            if (currentVersion !== lastVersion && !hasCompletedUpgrade) {
                await this.performUpgrade(currentVersion, lastVersion);
                await this.plugin.saveData("lastVersion", currentVersion);
                await this.plugin.saveData("hasCompletedUpgrade", true);
            }
        } catch (error) {
            logger.error("Error during upgrade check:", error);
        }
    }

    private async performUpgrade(currentVersion: string, lastVersion: string) {
        return this.showUpgradeDialog(currentVersion);
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
        return `\n\nFull Release Notes: [RELEASE_NOTES.md](${GITHUB.REPO_BASE}/blob/${version}/RELEASE_NOTES.md)\nDocumentation: [README](${GITHUB.REPO_BASE}/blob/${version}/README.md)`;
    }

    private async showUpgradeDialog(currentVersion: string) {
        const overview = await this.fetchOverview(currentVersion);
        const message = overview || this.getDefaultMessage(currentVersion);

        return showDialog(
            this.plugin.app,
            "information",
            `Upgrade to version ${currentVersion}`,
            [message + this.getDocLinks(currentVersion)],
            undefined,
            { button1: "Got it!" }
        );
    }
}