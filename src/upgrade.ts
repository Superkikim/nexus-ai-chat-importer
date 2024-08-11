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
            
            const lastVersion = await this.plugin.loadData('lastVersion') || '0.0.0';

            console.log("Last version loaded from data is ", lastVersion);
            
            if (currentVersion !== lastVersion) {
                console.log("Versions are not equal");
                await this.performUpgrade(currentVersion, lastVersion);
                console.log("We have called upgrade");
                await this.plugin.saveData('lastVersion', currentVersion);
                console.log("We save lastVersion as currentVersion");
            } else {
                console.log("Versions are equal, no upgrade needed");
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
