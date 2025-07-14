// src/ui/settings/base-settings-section.ts
import type NexusAiChatImporterPlugin from "../../main";

export abstract class BaseSettingsSection {
    constructor(protected plugin: NexusAiChatImporterPlugin) {}

    /**
     * Render this section's settings
     */
    abstract render(containerEl: HTMLElement): Promise<void> | void;

    /**
     * Section title (optional)
     */
    abstract readonly title?: string;

    /**
     * Section order (lower = higher up)
     */
    readonly order: number = 100;

    /**
     * Callback to trigger full redraw when needed (for conditional sections)
     */
    protected redrawCallback?: () => void;

    /**
     * Set redraw callback from main settings tab
     */
    setRedrawCallback(callback: () => void): void {
        this.redrawCallback = callback;
    }

    /**
     * Trigger redraw of entire settings tab
     */
    protected redraw(): void {
        if (this.redrawCallback) {
            this.redrawCallback();
        }
    }
}