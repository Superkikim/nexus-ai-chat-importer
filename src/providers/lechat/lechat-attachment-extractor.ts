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

import { StandardAttachment } from "../../types/standard";
import { ensureFolderExists } from "../../utils";
import { getFileCategory, sanitizeFileName } from "../../utils/file-utils";
import { Logger } from "../../logger";
import type NexusAiChatImporterPlugin from "../../main";
import { AttachmentMap } from "../../services/attachment-map-builder";
import { ZipArchiveReader, writeZipEntryToVault } from "../../utils/zip-loader";

/**
 * Attachment extractor for Le Chat (Mistral AI)
 * 
 * Le Chat stores attachments in directories named: chat-{chatId}-files/
 * Each file is stored with its original name.
 */
export class LeChatAttachmentExtractor {
    private zipFileCache = new Map<string, string | null>();
    private attachmentMap: AttachmentMap | null = null;
    private allZips: ZipArchiveReader[] = [];

    constructor(private plugin: NexusAiChatImporterPlugin, private logger: Logger) {}

    /**
     * Set attachment map for multi-ZIP support
     */
    setAttachmentMap(attachmentMap: AttachmentMap, allZips: ZipArchiveReader[]): void {
        this.attachmentMap = attachmentMap;
        this.allZips = allZips;
    }

    /**
     * Clear attachment map and ZIPs
     */
    clearAttachmentMap(): void {
        this.attachmentMap = null;
        this.allZips = [];
        this.zipFileCache.clear();
    }

    /**
     * Extract and save Le Chat attachments
     */
    async extractAttachments(
        zip: ZipArchiveReader,
        conversationId: string,
        attachments: StandardAttachment[],
        messageId?: string
    ): Promise<StandardAttachment[]> {
        if (attachments.length === 0) {
            return attachments;
        }

        const processedAttachments: StandardAttachment[] = [];

        for (const attachment of attachments) {
            try {
                const result = await this.processAttachment(zip, conversationId, attachment, messageId);
                processedAttachments.push(result);
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                const context = messageId
                    ? `conversation: ${conversationId}, message: ${messageId}`
                    : `conversation: ${conversationId}`;
                this.logger.error(`Failed to process Le Chat attachment: ${attachment.fileName} (${context})`, errorMessage);
                
                processedAttachments.push({
                    ...attachment,
                    status: {
                        processed: false,
                        found: false,
                        reason: 'extraction_failed',
                        note: `Processing failed: ${errorMessage}`
                    }
                });
            }
        }

        return processedAttachments;
    }

    /**
     * Process single attachment
     */
    private async processAttachment(
        zip: ZipArchiveReader,
        conversationId: string,
        attachment: StandardAttachment,
        messageId?: string
    ): Promise<StandardAttachment> {
        // Le Chat stores files in: chat-{chatId}-files/{filename}
        const zipPath = `chat-${conversationId}-files/${attachment.fileName}`;
        
        // Try to find file in ZIP
        let zipPathMatch = await this.findFileInZip(zip, zipPath);
        
        // If not found, try attachment map (multi-ZIP support)
        if (!zipPathMatch && this.attachmentMap) {
            const locations = this.attachmentMap.get(attachment.fileName);
            if (locations && locations.length > 0) {
                // Try each location
                for (const location of locations) {
                    const zipIndex = this.allZips.indexOf(zip);
                    if (zipIndex !== -1 && location.zipIndex < this.allZips.length) {
                        const targetZip = this.allZips[location.zipIndex];
                        zipPathMatch = await this.findFileInZip(targetZip, location.path);
                        if (zipPathMatch) break;
                    }
                }
            }
        }

        // If file not found, return attachment with not found status
        if (!zipPathMatch) {
            return {
                ...attachment,
                status: {
                    processed: false,
                    found: false,
                    reason: 'missing_from_export',
                    note: `File not found in ZIP: ${zipPath}`
                }
            };
        }

        // Extract file content
        let finalFileName = attachment.fileName;
        let finalFileType = attachment.fileType;

        // Generate unique filename to avoid collisions (like Claude does)
        const uniqueFileName = this.generateUniqueFileName(finalFileName, conversationId, messageId);

        // Determine file category (images, documents, etc.)
        const category = getFileCategory(uniqueFileName, finalFileType);

        // Build vault path: Attachments/lechat/{category}/{unique_filename}
        const attachmentFolder = this.plugin.settings.attachmentFolder;
        let vaultPath = `${attachmentFolder}/lechat/${category}/${sanitizeFileName(uniqueFileName)}`;

        // Ensure folder exists
        const folderPath = vaultPath.substring(0, vaultPath.lastIndexOf('/'));
        await ensureFolderExists(folderPath, this.plugin.app.vault);

        // Resolve file conflicts by adding numeric suffix if needed
        vaultPath = await this.resolveFileConflict(vaultPath);

        const entry = zip.get(zipPathMatch);
        if (!entry) {
            throw new Error(`Attachment entry disappeared from ZIP reader: ${zipPathMatch}`);
        }

        const writeResult = await writeZipEntryToVault(
            entry,
            vaultPath,
            this.plugin.app.vault
        );

        if ((!finalFileType || finalFileType === 'application/octet-stream') && writeResult.detectedMimeType) {
            finalFileType = writeResult.detectedMimeType;
        }

        return {
            ...attachment,
            fileName: finalFileName,
            fileType: finalFileType,
            fileSize: writeResult.byteLength,
            url: writeResult.targetPath,
            status: {
                processed: true,
                found: true,
                localPath: writeResult.targetPath
            }
        };
    }

    /**
     * Find file in ZIP with caching
     */
    private async findFileInZip(zip: ZipArchiveReader, path: string): Promise<string | null> {
        // Check cache first
        const cacheKey = `${zip}:${path}`;
        if (this.zipFileCache.has(cacheKey)) {
            return this.zipFileCache.get(cacheKey) || null;
        }

        // Try exact match
        let filePath = zip.has(path) ? path : null;
        
        // Try case-insensitive match
        if (!filePath) {
            const lowerPath = path.toLowerCase();
            const entries = await zip.listEntries();
            const matchingPath = entries.map(entry => entry.path).find(p => p.toLowerCase() === lowerPath);
            if (matchingPath) {
                filePath = matchingPath;
            }
        }

        // Cache result
        this.zipFileCache.set(cacheKey, filePath);

        return filePath;
    }

    /**
     * Generate unique filename to avoid conflicts
     * Strategy: lechat_{conversationId}_{messageId}_{timestamp}_{originalName}
     */
    private generateUniqueFileName(originalFileName: string, conversationId: string, messageId?: string): string {
        const timestamp = Date.now();
        const shortConversationId = conversationId.substring(0, 8);
        const shortMessageId = messageId ? messageId.substring(0, 8) : 'unknown';

        // Extract extension and base name
        const extension = originalFileName.includes('.') ? originalFileName.split('.').pop() : '';
        const baseName = originalFileName.replace(/\.[^/.]+$/, "");

        // Sanitize base name (remove special characters)
        const safeBaseName = baseName.replace(/[^a-zA-Z0-9_-]/g, '_');

        // Build unique filename: lechat_{convId}_{msgId}_{timestamp}_{name}.{ext}
        const uniqueName = `lechat_${shortConversationId}_${shortMessageId}_${timestamp}_${safeBaseName}`;

        return extension ? `${uniqueName}.${extension}` : uniqueName;
    }

    /**
     * Resolve file conflicts by adding numeric suffix
     * Same strategy as ChatGPT provider
     */
    private async resolveFileConflict(originalPath: string): Promise<string> {
        let finalPath = originalPath;
        let counter = 1;

        while (await this.plugin.app.vault.adapter.exists(finalPath)) {
            // File exists, try with suffix
            const lastDot = originalPath.lastIndexOf('.');
            if (lastDot === -1) {
                finalPath = `${originalPath}_${counter}`;
            } else {
                const nameWithoutExt = originalPath.substring(0, lastDot);
                const extension = originalPath.substring(lastDot);
                finalPath = `${nameWithoutExt}_${counter}${extension}`;
            }
            counter++;
        }

        return finalPath;
    }
}
