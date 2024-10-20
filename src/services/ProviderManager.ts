// ProviderManager.ts
import { App } from "obsidian";
import fs from "fs-extra";
import path from "path";
import YAML from "yaml";
import { Provider } from "../types";

class ProviderManager {
    private app: App;
    private providers: { [key: string]: Provider }; // Mapping of provider names to provider configurations

    constructor(app: App) {
        this.app = app;
        this.providers = {};
    }

    /**
     * Load providers from the specified directory.
     */
    async loadProviders(directory: string): Promise<void> {
        const files = await fs.readdir(directory);
        for (const file of files) {
            if (file.endsWith(".yaml")) {
                const filePath = path.join(directory, file);
                const fileContent = await fs.readFile(filePath, "utf8");
                const providerConfig = YAML.parse(fileContent);
                this.providers[providerConfig.provider.name] =
                    providerConfig.provider; // Storing the provider by name
            }
        }
    }

    /**
     * Identify the provider for a given file.
     * @param fileName Name of the uploaded file
     * @returns Provider object or null if no valid provider found
     */
    identifyProvider(fileName: string): Provider | null {
        for (const providerName in this.providers) {
            const provider = this.providers[providerName];
            const regex = new RegExp(provider.file_format.filename_regex);

            if (regex.test(fileName)) {
                return provider; // Return the matching provider
            }
        }
        return null; // Return null if no provider matches
    }
}

export { ProviderManager };
