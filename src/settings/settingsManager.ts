// src/services/SettingsManager.ts

import { PluginSettings, defaultSettings } from "../settings/settings";

export class SettingsManager {
    private settings: PluginSettings;

    constructor() {
        this.settings = defaultSettings; // Load default settings initially
    }

    loadSettings(): PluginSettings {
        // Logic to load settings from the user's config or file
        // Implement file reading logic and update `this.settings`
        return this.settings; // Placeholder; adjust to return loaded settings
    }

    saveSettings(newSettings: PluginSettings): void {
        this.settings = newSettings;
        // Logic to save settings to a file or configuration
        // Implement file writing logic here
    }

    getSettings(): PluginSettings {
        return this.settings; // Provide current settings for access
    }
}
