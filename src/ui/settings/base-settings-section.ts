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