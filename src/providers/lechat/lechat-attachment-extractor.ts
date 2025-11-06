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

import JSZip from "jszip";
import { StandardAttachment } from "../../types/standard";
import { ensureFolderExists } from "../../utils";
import { formatFileSize, detectFileFormat, getFileCategory, sanitizeFileName } from "../../utils/file-utils";
import { Logger } from "../../logger";
import type NexusAiChatImporterPlugin from "../../main";
import { AttachmentMap } from "../../services/attachment-map-builder";

/**
 * Attachment extractor for Le Chat (Mistral AI)
 * 
 * Le Chat stores attachments in directories named: chat-{chatId}-files/
 * Each file is stored with its original name.
 */
export class LeChatAttachmentExtractor {
    private zipFileCache = new Map<string, JSZip.JSZipObject | null>();
    private attachmentMap: AttachmentMap | null = null;
    private allZips: JSZip[] = [];

    constructor(private plugin: NexusAiChatImporterPlugin, private logger: Logger) {}

    /**
     * Set attachment map for multi-ZIP support
     */
    setAttachmentMap(attachmentMap: AttachmentMap, allZips: JSZip[]): void {
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
        zip: JSZip,
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
        zip: JSZip,
        conversationId: string,
        attachment: StandardAttachment,
        messageId?: string
    ): Promise<StandardAttachment> {
        // Le Chat stores files in: chat-{chatId}-files/{filename}
        const zipPath = `chat-${conversationId}-files/${attachment.fileName}`;
        
        // Try to find file in ZIP
        let zipFile = this.findFileInZip(zip, zipPath);
        
        // If not found, try attachment map (multi-ZIP support)
        if (!zipFile && this.attachmentMap) {
            const locations = this.attachmentMap.get(attachment.fileName);
            if (locations && locations.length > 0) {
                // Try each location
                for (const location of locations) {
                    const zipIndex = this.allZips.indexOf(zip);
                    if (zipIndex !== -1 && location.zipIndex < this.allZips.length) {
                        const targetZip = this.allZips[location.zipIndex];
                        zipFile = this.findFileInZip(targetZip, location.path);
                        if (zipFile) break;
                    }
                }
            }
        }

        // If file not found, return attachment with not found status
        if (!zipFile) {
            return {
                ...attachment,
                status: {
                    processed: false,
                    found: false,
                    reason: 'not_in_zip',
                    note: `File not found in ZIP: ${zipPath}`
                }
            };
        }

        // Extract file content
        const fileContent = await zipFile.async("uint8array");

        // Detect file format if needed
        let finalFileName = attachment.fileName;
        let finalFileType = attachment.fileType;

        if (!finalFileType || finalFileType === 'application/octet-stream') {
            const detected = detectFileFormat(fileContent);
            if (detected.extension && detected.mimeType) {
                finalFileType = detected.mimeType;
                // Update extension if detected
                if (!finalFileName.includes('.')) {
                    finalFileName = `${finalFileName}.${detected.extension}`;
                }
            }
        }

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

        // Save file to vault
        await this.plugin.app.vault.adapter.writeBinary(vaultPath, fileContent.buffer as ArrayBuffer);

        this.logger.info(`Extracted Le Chat attachment: ${finalFileName} → ${vaultPath}`);

        return {
            ...attachment,
            fileName: finalFileName,
            fileType: finalFileType,
            fileSize: fileContent.length,
            url: vaultPath,
            status: {
                processed: true,
                found: true,
                extracted: true
            }
        };
    }

    /**
     * Find file in ZIP with caching
     */
    private findFileInZip(zip: JSZip, path: string): JSZip.JSZipObject | null {
        // Check cache first
        const cacheKey = `${zip}:${path}`;
        if (this.zipFileCache.has(cacheKey)) {
            return this.zipFileCache.get(cacheKey) || null;
        }

        // Try exact match
        let file = zip.file(path);
        
        // Try case-insensitive match
        if (!file) {
            const lowerPath = path.toLowerCase();
            const allFiles = Object.keys(zip.files);
            const matchingPath = allFiles.find(p => p.toLowerCase() === lowerPath);
            if (matchingPath) {
                file = zip.file(matchingPath);
            }
        }

        // Cache result
        this.zipFileCache.set(cacheKey, file);

        return file;
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

