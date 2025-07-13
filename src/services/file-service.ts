// src/services/file-service.ts
import { TFile, TFolder } from "obsidian";
import { ConversationCatalogEntry } from "../types/plugin";
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

            // Remove from conversation catalog
            const storage = this.plugin.getStorageService();
            const catalog = storage.getConversationCatalog();
            
            for (const [id, record] of Object.entries(catalog) as [string, ConversationCatalogEntry][]) {
                if (record.conversationId === frontmatter.conversation_id) {
                    storage.deleteFromConversationCatalog(id);
                    await this.plugin.saveSettings();
                    break;
                }
            }
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