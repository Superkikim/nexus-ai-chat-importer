// upgrade.ts
import { Plugin } from 'obsidian';
import { showDialog } from './dialogs';

export class Upgrader {
    private plugin: Plugin;

    constructor(plugin: Plugin) {
        this.plugin = plugin;
    }

    async checkForUpgrade() {
        try {
            const currentVersion = this.plugin.manifest.version;
            console.log("Manifest version is ", currentVersion);
            
            // Load the last version and upgrade status
            const lastVersion = await this.plugin.loadData('lastVersion') || '0.0.0';
            const hasCompletedUpgrade = (await this.plugin.loadData('hasCompletedUpgrade')) || false;
    
            console.log("Last version loaded from data is ", lastVersion);
            console.log("Has completed upgrade: ", hasCompletedUpgrade);
            
            // Perform the upgrade only if it hasn't been completed
            if (currentVersion !== lastVersion && !hasCompletedUpgrade) {
                console.log("Versions are not equal and upgrade not completed");
                await this.performUpgrade(currentVersion, lastVersion);
                console.log("We have called upgrade");
                await this.plugin.saveData('lastVersion', currentVersion);
                await this.plugin.saveData('hasCompletedUpgrade', true); // Set upgrade as completed
                console.log("We save lastVersion as currentVersion and upgrade status");
            } else {
                console.log("Versions are equal or upgrade already completed, no upgrade needed");
            }
        } catch (error) {
            console.error("Error during upgrade check:", error);
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
            ["⚠️ Due to a name change, old conversation records imported with version 1.0.1b and earlier cannot be accessed. Please delete any old data and re-import your conversations with the new version. Next versions will include an upgrade feature if required."],
            undefined,
            { button1: "Ok, I'll do that" }
        );
    }
}
