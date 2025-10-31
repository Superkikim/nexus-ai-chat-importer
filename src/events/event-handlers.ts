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


// src/events/event-handlers.ts
import { TFile } from "obsidian";
import type NexusAiChatImporterPlugin from "../main";

export class EventHandlers {
    constructor(private plugin: NexusAiChatImporterPlugin) {}

    registerEvents() {
        // Handle file deletion - remove from conversation catalog
        this.plugin.registerEvent(
            this.plugin.app.vault.on("delete", async (file) => {
                if (file instanceof TFile) {
                    await this.plugin.getFileService().handleConversationFileDeletion(file);
                }
            })
        );
    }

    cleanup() {
        // No cleanup needed - Obsidian handles event unregistration
    }
}