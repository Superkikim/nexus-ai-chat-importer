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


// src/providers/chatgpt/chatgpt-attachment-extractor.ts
import { StandardAttachment } from "../../types/standard";
import { ensureFolderExists } from "../../utils";
import { formatFileSize, getFileCategory, sanitizeFileName } from "../../utils/file-utils";
import { Logger } from "../../logger";
import type NexusAiChatImporterPlugin from "../../main";
import { AttachmentMap, AttachmentLocation } from "../../services/attachment-map-builder";
import {
    AttachmentLookupIndex,
    buildAttachmentLookupIndex,
    writeZipEntryToVault,
    ZipArchiveReader,
    ZipEntryHandle,
} from "../../utils/zip-loader";


export class ChatGPTAttachmentExtractor {
    private zipFileCache = new Map<string, { reader: ZipArchiveReader; path: string } | null>();
    private attachmentMap: AttachmentMap | null = null; // Multi-ZIP attachment map
    private allZips: ZipArchiveReader[] = [];
    private lookupIndexCache = new WeakMap<object, AttachmentLookupIndex>();

    constructor(private plugin: NexusAiChatImporterPlugin, private logger: Logger) {}

    /**
     * Set attachment map for multi-ZIP support
     * This enables fallback to older ZIPs when files are missing in recent exports
     */
    setAttachmentMap(attachmentMap: AttachmentMap, allZips: ZipArchiveReader[]): void {
        this.attachmentMap = attachmentMap;
        this.allZips = allZips;
    }

    /**
     * Clear attachment map and ZIPs (call after import completes)
     */
    clearAttachmentMap(): void {
        this.attachmentMap = null;
        this.allZips = [];
        this.zipFileCache.clear();
    }

    /**
     * Extract and save ChatGPT attachments using "best effort" strategy
     * - If file exists in ZIP: extract and link
     * - If file missing: create informative note
     */
    async extractAttachments(
        zip: ZipArchiveReader,
        conversationId: string,
        attachments: StandardAttachment[],
        messageId?: string
    ): Promise<StandardAttachment[]> {
        if (attachments.length === 0) {
            return attachments.map(att => ({ ...att, status: { processed: false, found: false } }));
        }

        const processedAttachments: StandardAttachment[] = [];

        for (const attachment of attachments) {
            try {
                const result = await this.processAttachmentBestEffort(zip, conversationId, attachment, messageId);
                processedAttachments.push(result);
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                const context = messageId
                    ? `conversation: ${conversationId}, message: ${messageId}`
                    : `conversation: ${conversationId}`;
                this.logger.error(`Failed to process ChatGPT attachment: ${attachment.fileName} (${context})`, errorMessage);
                // Even if processing fails, return attachment with error status
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
     * Process single attachment with best effort strategy
     */
    private async processAttachmentBestEffort(
        zip: ZipArchiveReader,
        conversationId: string,
        attachment: StandardAttachment,
        messageId?: string
    ): Promise<StandardAttachment> {
        // Try to find file in ZIP
        const locatedFile = await this.findChatGPTFileById(zip, attachment, conversationId, messageId);

        if (!locatedFile) {
            // File not found - handle DALL-E images specially
            let finalExtractedContent = attachment.extractedContent;

            if (attachment.attachmentType === 'generated_image' && attachment.extractedContent) {
                // Replace the attachment callout with "Image Not Found" message
                // Keep the prompt callout intact, only replace the attachment part
                finalExtractedContent = attachment.extractedContent.replace(
                    />>\[!nexus_attachment\] \*\*\{\{FILENAME\}\}\*\* \(\{\{FILETYPE\}\}\) - \{\{FILESIZE\}\}\n>> !\[\[\{\{URL\}\}\]\]/,
                    '>>[!nexus_attachment] **Image Not Found**\n>> ⚠️ Image could not be found. Perhaps it was not generated or is missing from the archive.'
                );
            }

            return {
                ...attachment,
                extractedContent: finalExtractedContent,
                url: attachment.url || `https://chatgpt.com/c/${conversationId}`,
                status: {
                    processed: true,
                    found: false,
                    reason: 'missing_from_export'
                }
            };
        }

        // File found - try to extract it
        try {
            const extractResult = await this.extractSingleAttachment(conversationId, attachment, locatedFile);

            if (extractResult) {
                // For generated images with extractedContent, replace placeholders
                let finalExtractedContent = attachment.extractedContent;
                if (attachment.attachmentType === 'generated_image' && attachment.extractedContent) {
                    finalExtractedContent = attachment.extractedContent
                        .replace('{{FILENAME}}', extractResult.finalFileName)
                        .replace('{{FILETYPE}}', extractResult.actualFileType)
                        .replace('{{FILESIZE}}', formatFileSize(attachment.fileSize || 0))
                        .replace('{{URL}}', extractResult.localPath);
                }

                return {
                    ...attachment,
                    fileName: extractResult.finalFileName, // Update with actual extracted filename
                    fileType: extractResult.actualFileType, // Update with detected file type
                    url: extractResult.localPath,
                    extractedContent: finalExtractedContent, // Update with replaced placeholders
                    status: {
                        processed: true,
                        found: true,
                        localPath: extractResult.localPath
                    }
                };
            } else {
                // Extraction failed - handle DALL-E images specially
                let finalExtractedContent = attachment.extractedContent;

                if (attachment.attachmentType === 'generated_image' && attachment.extractedContent) {
                    // Replace the attachment callout with "Image Not Found" message
                    finalExtractedContent = attachment.extractedContent.replace(
                        />>\[!nexus_attachment\] \*\*\{\{FILENAME\}\}\*\* \(\{\{FILETYPE\}\}\) - \{\{FILESIZE\}\}\n>> !\[\[\{\{URL\}\}\]\]/,
                        '>>[!nexus_attachment] **Image Not Found**\n>> ⚠️ File was found in export but could not be extracted to disk.'
                    );
                }

                return {
                    ...attachment,
                    extractedContent: finalExtractedContent,
                    status: {
                        processed: true,
                        found: false,
                        reason: 'extraction_failed',
                        note: 'File was found in export but could not be extracted to disk.'
                    }
                };
            }
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const context = messageId
                ? `conversation: ${conversationId}, message: ${messageId}`
                : `conversation: ${conversationId}`;
            this.logger.error(`Error extracting ChatGPT attachment: ${attachment.fileName} (${context})`, errorMessage);

            // Handle DALL-E images specially
            let finalExtractedContent = attachment.extractedContent;

            if (attachment.attachmentType === 'generated_image' && attachment.extractedContent) {
                // Replace the attachment callout with error message
                finalExtractedContent = attachment.extractedContent.replace(
                    />>\[!nexus_attachment\] \*\*\{\{FILENAME\}\}\*\* \(\{\{FILETYPE\}\}\) - \{\{FILESIZE\}\}\n>> !\[\[\{\{URL\}\}\]\]/,
                    `>>[!nexus_attachment] **Extraction Failed**\n>> ⚠️ ${errorMessage}`
                );
            }

            return {
                ...attachment,
                extractedContent: finalExtractedContent,
                status: {
                    processed: true,
                    found: true, // File exists but extraction failed
                    reason: 'extraction_failed',
                    note: `Extraction failed: ${errorMessage}`
                }
            };
        }
    }

    /**
     * Extract single attachment to disk with conflict resolution and format detection
     */
    private async extractSingleAttachment(
        conversationId: string,
        attachment: StandardAttachment,
        locatedFile: { reader: ZipArchiveReader; path: string }
    ): Promise<{localPath: string, finalFileName: string, actualFileType: string} | null> {
        let finalFileName = attachment.fileName;
        let finalFileType = attachment.fileType;
        const entry = locatedFile.reader.get(locatedFile.path);
        if (!entry) {
            throw new Error(`Attachment entry disappeared from ZIP reader: ${locatedFile.path}`);
        }

        const writeResult = await writeZipEntryToVault(
            entry,
            async (detection) => {
                if (attachment.attachmentType === 'generated_image' && detection.detectedExtension) {
                    const baseName = attachment.fileName.replace(/\.(dat|png|jpg|jpeg|gif|webp)$/i, '');
                    finalFileName = `${baseName}.${detection.detectedExtension}`;
                    finalFileType = detection.detectedMimeType || attachment.fileType;
                }

                let targetPath = this.generateLocalPath(conversationId, {
                    ...attachment,
                    fileName: finalFileName,
                    fileType: finalFileType
                });

                const folderPath = targetPath.substring(0, targetPath.lastIndexOf('/'));
                const folderResult = await ensureFolderExists(folderPath, this.plugin.app.vault);
                if (!folderResult.success) {
                    throw new Error(`Failed to create attachment folder: ${folderResult.error}`);
                }

                return this.resolveFileConflict(targetPath);
            },
            this.plugin.app.vault
        );

        return {
            localPath: writeResult.targetPath,
            finalFileName: finalFileName,
            actualFileType: finalFileType || 'application/octet-stream'
        };
    }



    /**
     * Resolve file conflicts by adding numeric suffix
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

    /**
     * Find file in ZIP - ENHANCED WITH MULTI-ZIP FALLBACK + COMPREHENSIVE SEARCH + CACHING
     */
    private async findChatGPTFileById(
        zip: ZipArchiveReader,
        attachment: StandardAttachment,
        conversationId?: string,
        messageId?: string
    ): Promise<{ reader: ZipArchiveReader; path: string } | null> {
        if (!attachment.fileId) {
            const context = conversationId && messageId
                ? `conversation: ${conversationId}, message: ${messageId}`
                : conversationId
                ? `conversation: ${conversationId}`
                : 'unknown context';
            this.logger.warn(`No fileId provided for attachment: ${attachment.fileName} (${context})`);

            // Fallback: try to find by filename only
            if (zip.has(attachment.fileName)) {
                return { reader: zip, path: attachment.fileName };
            }

            return null;
        }

        // Check cache first
        const cacheKey = `${attachment.fileId}_${attachment.fileName}`;
        if (this.zipFileCache.has(cacheKey)) {
            return this.zipFileCache.get(cacheKey)!;
        }

        // NEW: If attachment map is available, use it for multi-ZIP fallback
        if (this.attachmentMap && this.allZips.length > 0) {
            const result = await this.findFileUsingAttachmentMap(attachment, conversationId, messageId);
            if (result) {
                this.zipFileCache.set(cacheKey, result);
                return result;
            }
        }

        const index = await this.getLookupIndex(zip);

        // Strategy 1: Try exact filename match first
        if (zip.has(attachment.fileName)) {
            const located = { reader: zip, path: attachment.fileName };
            this.zipFileCache.set(cacheKey, located);
            return located;
        }

        // Strategy 2: DALL-E Strategy - Check dalle-generations/ folder first (restored from v1.2.0)
        if (attachment.fileName.startsWith('dalle_')) {
            const dalleFiles = this.findCandidatePaths(index.byDalleId, attachment.fileId);
            if (dalleFiles.length > 0) {
                const located = { reader: zip, path: dalleFiles[0] };
                this.zipFileCache.set(cacheKey, located);
                return located;
            }
        }

        // Strategy 3: Regular file ID patterns (restored from v1.2.0)
        const fileIdPattern = `${attachment.fileId}-${attachment.fileName}`;
        if (zip.has(fileIdPattern)) {
            const located = { reader: zip, path: fileIdPattern };
            this.zipFileCache.set(cacheKey, located);
            return located;
        }

        // Strategy 4: Pattern file-{ID}.{ext} (restored from v1.2.0)
        const extension = this.getFileExtension(attachment.fileName);
        if (extension) {
            const fileIdExtPattern = `${attachment.fileId}.${extension}`;
            if (zip.has(fileIdExtPattern)) {
                const located = { reader: zip, path: fileIdExtPattern };
                this.zipFileCache.set(cacheKey, located);
                return located;
            }
        }

        const candidates = this.findCandidatePaths(index.byFileId, attachment.fileId);
        const foundFile = candidates.length > 0 ? { reader: zip, path: candidates[0] } : null;

        // Cache result (even if null)
        this.zipFileCache.set(cacheKey, foundFile);

        return foundFile;
    }

    /**
     * Find file using attachment map (multi-ZIP fallback)
     * Tries to find the file in any of the available ZIPs, preferring newer exports
     */
    private async findFileUsingAttachmentMap(
        attachment: StandardAttachment,
        conversationId?: string,
        messageId?: string
    ): Promise<{ reader: ZipArchiveReader; path: string } | null> {
        if (!this.attachmentMap || this.allZips.length === 0) {
            return null;
        }

        const context = conversationId && messageId
            ? `conversation: ${conversationId}, message: ${messageId}`
            : conversationId
            ? `conversation: ${conversationId}`
            : 'unknown context';

        // Try to find the file in the attachment map
        // The map contains all possible file IDs extracted from filenames
        const fileId = attachment.fileId || '';
        if (!fileId) {
            return null;
        }

        const locations = this.attachmentMap.get(fileId);

        if (!locations || locations.length === 0) {
            // Try alternative file ID formats
            const alternativeIds = this.getAlternativeFileIds(fileId);
            for (const altId of alternativeIds) {
                const altLocations = this.attachmentMap.get(altId);
                if (altLocations && altLocations.length > 0) {
                    return this.getFileFromLocation(altLocations[altLocations.length - 1]);
                }
            }
            return null;
        }

        // Use the newest location (last in array)
        const bestLocation = locations[locations.length - 1];

        return this.getFileFromLocation(bestLocation);
    }

    /**
     * Get alternative file ID formats for fallback matching
     */
    private getAlternativeFileIds(fileId: string): string[] {
        const alternatives: string[] = [];

        // If fileId starts with "file_", also try without prefix
        if (fileId.startsWith('file_')) {
            alternatives.push(fileId.substring(5));
        }
        // If fileId doesn't have prefix, try with "file_" prefix
        else if (!fileId.startsWith('file-')) {
            alternatives.push(`file_${fileId}`);
        }

        // Also try with dash instead of underscore
        if (fileId.includes('_')) {
            alternatives.push(fileId.replace(/_/g, '-'));
        }
        if (fileId.includes('-')) {
            alternatives.push(fileId.replace(/-/g, '_'));
        }

        return alternatives;
    }

    /**
     * Get JSZip file object from attachment location
     */
    private getFileFromLocation(location: AttachmentLocation): { reader: ZipArchiveReader; path: string } | null {
        if (location.zipIndex >= this.allZips.length) {
            this.logger.error(`Invalid ZIP index ${location.zipIndex} (only ${this.allZips.length} ZIPs available)`);
            return null;
        }

        const zip = this.allZips[location.zipIndex];

        if (!zip.has(location.path)) {
            this.logger.error(`File not found in ZIP ${location.zipIndex}: ${location.path}`);
            return null;
        }

        return { reader: zip, path: location.path };
    }

    /**
     * Get file extension from filename (restored from v1.2.0)
     */
    private getFileExtension(fileName: string): string {
        const lastDot = fileName.lastIndexOf('.');
        return lastDot === -1 ? '' : fileName.substring(lastDot + 1).toLowerCase();
    }

    /**
     * Generate local path for ChatGPT attachment using attachmentFolder setting
     */
    private generateLocalPath(conversationId: string, attachment: StandardAttachment): string {
        const category = this.categorizeFile(attachment);

        // Clean filename for filesystem - keep original name since it should be unique
        const safeFileName = sanitizeFileName(attachment.fileName);

        // Use attachmentFolder setting: <attachmentFolder>/chatgpt/<category>/filename.jpg
        return `${this.plugin.settings.attachmentFolder}/chatgpt/${category}/${safeFileName}`;
    }

    /**
     * Categorize file based on MIME type or extension
     */
    private categorizeFile(attachment: StandardAttachment): string {
        // Use MIME type if available
        if (attachment.fileType) {
            if (attachment.fileType.startsWith('image/')) return 'images';
            if (attachment.fileType.startsWith('audio/')) return 'audio';
            if (attachment.fileType.startsWith('video/')) return 'video';
            if (attachment.fileType === 'application/pdf') return 'documents';
            if (attachment.fileType.includes('text/') || attachment.fileType.includes('markdown')) return 'documents';
        }

        // Fall back to file extension using FileService
        const ext = this.plugin.getFileService().getFileExtension(attachment.fileName);
        
        const audioExts = ['wav', 'mp3', 'ogg', 'm4a', 'flac'];
        const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'];
        const docExts = ['pdf', 'doc', 'docx', 'txt', 'md', 'rtf'];
        const videoExts = ['mp4', 'avi', 'mov', 'mkv'];

        if (audioExts.includes(ext)) return 'audio';
        if (imageExts.includes(ext)) return 'images';
        if (docExts.includes(ext)) return 'documents';
        if (videoExts.includes(ext)) return 'video';
        
        return 'files';
    }



    /**
     * Clear ZIP file cache (call between different ZIP files)
     */
    clearCache(): void {
        this.zipFileCache.clear();
    }

    private async getLookupIndex(zip: ZipArchiveReader): Promise<AttachmentLookupIndex> {
        const cached = this.lookupIndexCache.get(zip as object);
        if (cached) {
            return cached;
        }

        const entries = await zip.listEntries();
        const index = buildAttachmentLookupIndex(entries);
        this.lookupIndexCache.set(zip as object, index);
        return index;
    }

    private findCandidatePaths(index: Map<string, string[]>, fileId: string): string[] {
        const exact = index.get(fileId);
        if (exact && exact.length > 0) return exact;

        for (const alternative of this.getAlternativeFileIds(fileId)) {
            const matches = index.get(alternative);
            if (matches && matches.length > 0) return matches;
        }

        return [];
    }

    /**
     * Get attachment processing statistics
     */
    getStatistics(attachments: StandardAttachment[]): {
        total: number;
        found: number;
        missing: number;
        failed: number;
    } {
        return {
            total: attachments.length,
            found: attachments.filter(a => a.status?.found && a.status?.processed).length,
            missing: attachments.filter(a => !a.status?.found && a.status?.reason === 'missing_from_export').length,
            failed: attachments.filter(a => a.status?.reason === 'extraction_failed').length
        };
    }
}
