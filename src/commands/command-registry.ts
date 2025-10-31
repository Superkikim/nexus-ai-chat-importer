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


// src/commands/command-registry.ts
import type NexusAiChatImporterPlugin from "../main";

export class CommandRegistry {
    constructor(private plugin: NexusAiChatImporterPlugin) {}

    registerCommands() {
        this.plugin.addCommand({
            id: "nexus-ai-chat-importer-select-zip",
            name: "Import AI conversations",
            callback: () => {
                // Use the new provider selection workflow
                this.plugin.showProviderSelectionDialog();
            },
        });
    }
}