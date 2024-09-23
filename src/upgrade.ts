// upgrade.ts
import { Plugin } from "obsidian";
import { showDialog } from "./components/dialogs";
import { Logger } from "./logger";

const logger = new Logger();

export class Upgrader {
    private plugin: Plugin;

    constructor(plugin: Plugin) {
        this.plugin = plugin;
    }

    async checkForUpgrade() {
        try {
            const currentVersion = this.plugin.manifest.version;

            // Load the last version and upgrade status
            const lastVersion =
                (await this.plugin.loadData("lastVersion")) || "0.0.0";
            const hasCompletedUpgrade =
                (await this.plugin.loadData("hasCompletedUpgrade")) || false;

            // Perform the upgrade only if it hasn't been completed
            if (currentVersion !== lastVersion && !hasCompletedUpgrade) {
                await this.performUpgrade(currentVersion, lastVersion);
                await this.plugin.saveData("lastVersion", currentVersion);
                await this.plugin.saveData("hasCompletedUpgrade", true); // Set upgrade as completed
            } else {
            }
        } catch (error) {
            logger.error("Error during upgrade check:", error);
        }
    }

    private async performUpgrade(currentVersion: string, lastVersion: string) {
        return this.showUpgradeDialog(currentVersion);
    }

    private async showUpgradeDialog(currentVersion: string) {
        return showDialog(
            this.plugin.app,
            "information",
            `Upgrade to version ${currentVersion}`,
            [
                "⚠️ Due to a name change, old conversation records imported with version 1.0.1b and earlier cannot be accessed. Please delete any old data and re-import your conversations with the new version. Next versions will include an upgrade feature if required.",
            ],
            undefined,
            { button1: "Ok, I'll do that" }
        );
    }
}
