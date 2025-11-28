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


// src/services/file-service.ts
import { TFile, TFolder } from "obsidian";
import { ConversationCatalogEntry } from "../types/plugin";
import { logger } from "../logger";
import type NexusAiChatImporterPlugin from "../main";

export class FileService {
    constructor(private plugin: NexusAiChatImporterPlugin) {}

    async writeToFile(filePath: string, content: string): Promise<void> {
        try {
            const file = this.plugin.app.vault.getAbstractFileByPath(filePath);

            if (file instanceof TFile) {
                await this.plugin.app.vault.modify(file, content);
            } else if (file instanceof TFolder) {
                throw new Error(`Cannot write to '${filePath}'; it is a folder.`);
            } else {
                await this.plugin.app.vault.create(filePath, content);
            }
        } catch (error: any) {
            this.plugin.logger.error(`Error creating or modifying file '${filePath}'`, error.message);
            throw error;
        }
    }

    async handleConversationFileDeletion(file: TFile): Promise<void> {
        try {
            // Check if this is a Nexus conversation file
            const frontmatter = this.plugin.app.metadataCache.getFileCache(file)?.frontmatter;

            if (!frontmatter?.conversation_id || frontmatter?.nexus !== this.plugin.manifest.id) {
                return; // Not a Nexus conversation file
            }

            // No action needed - conversations are tracked via frontmatter in vault
        } catch (error) {
            this.plugin.logger.error("Error handling conversation file deletion:", error);
        }
    }

    /**
     * Get file extension from filename (provider-agnostic utility)
     */
    getFileExtension(fileName: string): string {
        const lastDot = fileName.lastIndexOf('.');
        return lastDot === -1 ? '' : fileName.substring(lastDot + 1).toLowerCase();
    }

    // TODO: Future enhancement - delete conversation attachments
    // async deleteConversationAttachments(conversationId: string): Promise<void> {
    //     // Implementation for deleting attachments when conversation is deleted
    // }
}