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


// src/services/link-update-service.ts
import { TFile } from "obsidian";
import type NexusAiChatImporterPlugin from "../main";
import { UpgradeProgressModal } from "../upgrade/utils/progress-modal";

export interface LinkUpdateStats {
    conversationsScanned: number;
    reportsScanned: number;
    attachmentLinksUpdated: number;
    conversationLinksUpdated: number;
    filesModified: number;
    errors: number;
}

export interface LinkUpdateProgress {
    phase: 'scanning' | 'updating-attachments' | 'updating-conversations' | 'complete' | 'error';
    current: number;
    total: number;
    detail: string;
}

export class LinkUpdateService {
    constructor(private plugin: NexusAiChatImporterPlugin) {}

    /**
     * Update attachment links when attachment folder path changes
     */
    async updateAttachmentLinks(
        oldAttachmentPath: string,
        newAttachmentPath: string,
        progressCallback?: (progress: LinkUpdateProgress) => void
    ): Promise<LinkUpdateStats> {
        const stats: LinkUpdateStats = {
            conversationsScanned: 0,
            reportsScanned: 0,
            attachmentLinksUpdated: 0,
            conversationLinksUpdated: 0,
            filesModified: 0,
            errors: 0
        };

        try {
            // Get all conversation files
            const conversationFiles = await this.getConversationFiles();
            stats.conversationsScanned = conversationFiles.length;

            progressCallback?.({
                phase: 'scanning',
                current: 0,
                total: conversationFiles.length,
                detail: `Found ${conversationFiles.length} conversations to scan`
            });

            // Process conversations in batches
            const batchSize = 10;
            for (let i = 0; i < conversationFiles.length; i += batchSize) {
                const batch = conversationFiles.slice(i, i + batchSize);

                progressCallback?.({
                    phase: 'updating-attachments',
                    current: i,
                    total: conversationFiles.length,
                    detail: `Updating attachment links: ${i}/${conversationFiles.length} files processed`
                });

                for (const file of batch) {
                    try {
                        const result = await this.updateAttachmentLinksInFile(file, oldAttachmentPath, newAttachmentPath);
                        stats.attachmentLinksUpdated += result.linksUpdated;
                        if (result.fileModified) {
                            stats.filesModified++;
                        }
                    } catch (error) {
                        stats.errors++;
                        this.plugin.logger.error(`Error updating attachment links in ${file.path}:`, error);
                    }
                }

                // Small delay between batches to prevent UI blocking
                if (i + batchSize < conversationFiles.length) {
                    await new Promise(resolve => setTimeout(resolve, 10));
                }
            }

            progressCallback?.({
                phase: 'complete',
                current: conversationFiles.length,
                total: conversationFiles.length,
                detail: `Updated ${stats.attachmentLinksUpdated} attachment links in ${stats.filesModified} files`
            });

            return stats;

        } catch (error) {
            this.plugin.logger.error("Error updating attachment links:", error);
            progressCallback?.({
                phase: 'error',
                current: 0,
                total: 0,
                detail: `Error: ${error.message}`
            });
            throw error;
        }
    }

    /**
     * Update conversation links when conversation folder path changes
     */
    async updateConversationLinks(
        oldConversationPath: string,
        newConversationPath: string,
        progressCallback?: (progress: LinkUpdateProgress) => void
    ): Promise<LinkUpdateStats> {
        const stats: LinkUpdateStats = {
            conversationsScanned: 0,
            reportsScanned: 0,
            attachmentLinksUpdated: 0,
            conversationLinksUpdated: 0,
            filesModified: 0,
            errors: 0
        };

        try {
            // Get all report files
            const reportFiles = await this.getReportFiles();
            stats.reportsScanned = reportFiles.length;

            progressCallback?.({
                phase: 'scanning',
                current: 0,
                total: reportFiles.length,
                detail: `Found ${reportFiles.length} reports to scan`
            });

            // Process reports in batches
            const batchSize = 5; // Smaller batches for reports since they're typically fewer
            for (let i = 0; i < reportFiles.length; i += batchSize) {
                const batch = reportFiles.slice(i, i + batchSize);

                progressCallback?.({
                    phase: 'updating-conversations',
                    current: i,
                    total: reportFiles.length,
                    detail: `Updating conversation links: ${i}/${reportFiles.length} reports processed`
                });

                for (const file of batch) {
                    try {
                        const result = await this.updateConversationLinksInFile(file, oldConversationPath, newConversationPath);
                        stats.conversationLinksUpdated += result.linksUpdated;
                        if (result.fileModified) {
                            stats.filesModified++;
                        }
                    } catch (error) {
                        stats.errors++;
                        this.plugin.logger.error(`Error updating conversation links in ${file.path}:`, error);
                    }
                }

                // Small delay between batches
                if (i + batchSize < reportFiles.length) {
                    await new Promise(resolve => setTimeout(resolve, 10));
                }
            }

            progressCallback?.({
                phase: 'complete',
                current: reportFiles.length,
                total: reportFiles.length,
                detail: `Updated ${stats.conversationLinksUpdated} conversation links in ${stats.filesModified} files`
            });

            return stats;

        } catch (error) {
            this.plugin.logger.error("Error updating conversation links:", error);
            progressCallback?.({
                phase: 'error',
                current: 0,
                total: 0,
                detail: `Error: ${error.message}`
            });
            throw error;
        }
    }

    /**
     * Estimate time for link updates based on file count
     */
    async estimateUpdateTime(folderType: 'attachments' | 'conversations'): Promise<{ fileCount: number; estimatedSeconds: number }> {
        let fileCount = 0;

        if (folderType === 'attachments') {
            const conversationFiles = await this.getConversationFiles();
            fileCount = conversationFiles.length;
        } else {
            const reportFiles = await this.getReportFiles();
            fileCount = reportFiles.length;
        }

        // Estimate ~0.1 seconds per file for small operations, with minimum 2 seconds
        const estimatedSeconds = Math.max(2, Math.ceil(fileCount * 0.1));

        return { fileCount, estimatedSeconds };
    }

    /**
     * Get all conversation files from the vault
     */
    private async getConversationFiles(): Promise<TFile[]> {
        const conversationFolder = this.plugin.settings.conversationFolder;
        const allFiles = this.plugin.app.vault.getMarkdownFiles();

        return allFiles.filter(file => {
            if (!file.path.startsWith(conversationFolder)) return false;

            // Exclude Reports and Attachments folders
            const relativePath = file.path.substring(conversationFolder.length + 1);
            if (relativePath.startsWith('Reports/') ||
                relativePath.startsWith('Attachments/') ||
                relativePath.startsWith('reports/') ||
                relativePath.startsWith('attachments/')) {
                return false;
            }

            return true;
        });
    }

    /**
     * Get all report files from the vault
     */
    private async getReportFiles(): Promise<TFile[]> {
        const reportFolder = this.plugin.settings.reportFolder;
        const allFiles = this.plugin.app.vault.getMarkdownFiles();

        return allFiles.filter(file => file.path.startsWith(reportFolder));
    }

    /**
     * Update attachment links in a single file
     */
    private async updateAttachmentLinksInFile(
        file: TFile,
        oldAttachmentPath: string,
        newAttachmentPath: string
    ): Promise<{ linksUpdated: number; fileModified: boolean }> {
        const content = await this.plugin.app.vault.read(file);
        let updatedContent = content;
        let linksUpdated = 0;

        // Escape special regex characters in paths
        const escapedOldPath = this.escapeRegExp(oldAttachmentPath);

        // Pattern 1: Markdown image links ![alt](path)
        const imagePattern = new RegExp(`(!\\[[^\\]]*\\]\\()${escapedOldPath}(/[^)]+\\))`, 'g');
        updatedContent = updatedContent.replace(imagePattern, (match, prefix, suffix) => {
            linksUpdated++;
            return `${prefix}${newAttachmentPath}${suffix}`;
        });

        // Pattern 2: Markdown file links [text](path)
        const linkPattern = new RegExp(`(\\[[^\\]]*\\]\\()${escapedOldPath}(/[^)]+\\))`, 'g');
        updatedContent = updatedContent.replace(linkPattern, (match, prefix, suffix) => {
            linksUpdated++;
            return `${prefix}${newAttachmentPath}${suffix}`;
        });

        // Pattern 3: Obsidian image embeds ![[path]]
        const obsidianImagePattern = new RegExp(`(!\\[\\[)${escapedOldPath}(/[^\\]]+\\]\\])`, 'g');
        updatedContent = updatedContent.replace(obsidianImagePattern, (match, prefix, suffix) => {
            linksUpdated++;
            return `${prefix}${newAttachmentPath}${suffix}`;
        });

        // Pattern 4: Obsidian file links [[path]]
        const obsidianLinkPattern = new RegExp(`(\\[\\[)${escapedOldPath}(/[^\\]]+\\]\\])`, 'g');
        updatedContent = updatedContent.replace(obsidianLinkPattern, (match, prefix, suffix) => {
            linksUpdated++;
            return `${prefix}${newAttachmentPath}${suffix}`;
        });

        const fileModified = content !== updatedContent;
        if (fileModified) {
            await this.plugin.app.vault.modify(file, updatedContent);
        }

        return { linksUpdated, fileModified };
    }

    /**
     * Update conversation links in a single report file
     */
    private async updateConversationLinksInFile(
        file: TFile,
        oldConversationPath: string,
        newConversationPath: string
    ): Promise<{ linksUpdated: number; fileModified: boolean }> {
        const content = await this.plugin.app.vault.read(file);
        let updatedContent = content;
        let linksUpdated = 0;

        // Escape special regex characters in paths
        const escapedOldPath = this.escapeRegExp(oldConversationPath);

        // Pattern: Obsidian links with aliases [[path|title]]
        const linkWithAliasPattern = new RegExp(`(\\[\\[)${escapedOldPath}(/[^|\\]]+)(\\|[^\\]]+\\]\\])`, 'g');
        updatedContent = updatedContent.replace(linkWithAliasPattern, (match, prefix, pathSuffix, aliasSuffix) => {
            linksUpdated++;
            return `${prefix}${newConversationPath}${pathSuffix}${aliasSuffix}`;
        });

        // Pattern: Simple Obsidian links [[path]]
        const simpleLinkPattern = new RegExp(`(\\[\\[)${escapedOldPath}(/[^\\]]+\\]\\])`, 'g');
        updatedContent = updatedContent.replace(simpleLinkPattern, (match, prefix, suffix) => {
            linksUpdated++;
            return `${prefix}${newConversationPath}${suffix}`;
        });

        const fileModified = content !== updatedContent;
        if (fileModified) {
            await this.plugin.app.vault.modify(file, updatedContent);
        }

        return { linksUpdated, fileModified };
    }

    /**
     * Escape special regex characters
     */
    private escapeRegExp(string: string): string {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}
