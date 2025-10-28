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
import JSZip from "jszip";
import { StandardAttachment } from "../../types/standard";
import { ensureFolderExists } from "../../utils";
import { Logger } from "../../logger";
import type NexusAiChatImporterPlugin from "../../main";
import { AttachmentMap, AttachmentLocation } from "../../services/attachment-map-builder";


export class ChatGPTAttachmentExtractor {
    private zipFileCache = new Map<string, JSZip.JSZipObject | null>(); // Cache for ZIP file lookups
    private attachmentMap: AttachmentMap | null = null; // Multi-ZIP attachment map
    private allZips: JSZip[] = []; // All opened ZIPs for multi-ZIP fallback

    constructor(private plugin: NexusAiChatImporterPlugin, private logger: Logger) {}

    /**
     * Set attachment map for multi-ZIP support
     * This enables fallback to older ZIPs when files are missing in recent exports
     */
    setAttachmentMap(attachmentMap: AttachmentMap, allZips: JSZip[]): void {
        this.attachmentMap = attachmentMap;
        this.allZips = allZips;
        this.logger.debug(`Attachment map set with ${attachmentMap.size} file IDs across ${allZips.length} ZIPs`);
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
        zip: JSZip,
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
        zip: JSZip,
        conversationId: string,
        attachment: StandardAttachment,
        messageId?: string
    ): Promise<StandardAttachment> {
        // Try to find file in ZIP
        const zipFile = await this.findChatGPTFileById(zip, attachment, conversationId, messageId);

        if (!zipFile) {
            // File not found - create informative status
            return {
                ...attachment,
                status: {
                    processed: true,
                    found: false,
                    reason: 'missing_from_export',
                    note: 'This file was referenced in the conversation but not included in the ChatGPT export. ' +
                          'This can happen with older conversations or certain file types.'
                }
            };
        }

        // File found - try to extract it
        try {
            const extractResult = await this.extractSingleAttachment(zip, conversationId, attachment, zipFile);

            if (extractResult) {
                // For generated images with extractedContent, replace placeholders
                let finalExtractedContent = attachment.extractedContent;
                if (attachment.attachmentType === 'generated_image' && attachment.extractedContent) {
                    finalExtractedContent = attachment.extractedContent
                        .replace('{{FILENAME}}', extractResult.finalFileName)
                        .replace('{{FILETYPE}}', extractResult.actualFileType)
                        .replace('{{FILESIZE}}', this.formatFileSize(attachment.fileSize || 0))
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
                return {
                    ...attachment,
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
            return {
                ...attachment,
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
        zip: JSZip,
        conversationId: string,
        attachment: StandardAttachment,
        zipFile: JSZip.JSZipObject
    ): Promise<{localPath: string, finalFileName: string, actualFileType: string} | null> {
        // Get file content for format detection
        const fileContent = await zipFile.async("uint8array");
        
        // Detect actual file format (especially for .dat files)
        const formatInfo = this.detectFileFormat(fileContent);
        
        // Update filename with correct extension if needed (for all generated images)
        let finalFileName = attachment.fileName;
        let finalFileType = attachment.fileType;

        if (attachment.attachmentType === 'generated_image' && formatInfo.extension) {
            // Correct extension for generated images (handles .dat, .webp, .jpg, .png)
            const baseName = attachment.fileName.replace(/\.(dat|png|jpg|jpeg|gif|webp)$/i, '');
            finalFileName = `${baseName}.${formatInfo.extension}`;
            finalFileType = formatInfo.mimeType || attachment.fileType;
        }
        
        // Generate target path for saving
        let targetPath = this.generateLocalPath(conversationId, {
            ...attachment,
            fileName: finalFileName,
            fileType: finalFileType
        });

        // Ensure folder exists
        const folderPath = targetPath.substring(0, targetPath.lastIndexOf('/'));
        const folderResult = await ensureFolderExists(folderPath, this.plugin.app.vault);
        if (!folderResult.success) {
            throw new Error(`Failed to create ChatGPT attachment folder: ${folderResult.error}`);
        }

        // Handle file conflicts by adding suffix if needed
        targetPath = await this.resolveFileConflict(targetPath);

        // Save file
        await this.plugin.app.vault.adapter.writeBinary(targetPath, fileContent.buffer as ArrayBuffer);

        return {
            localPath: targetPath,
            finalFileName: finalFileName,
            actualFileType: finalFileType || 'application/octet-stream'
        };
    }

    /**
     * Detect file format from magic bytes (especially for .dat files)
     */
    private detectFileFormat(fileContent: Uint8Array): {extension: string | null, mimeType: string | null} {
        if (fileContent.length < 4) {
            this.logger.warn('File too small for format detection');
            return {extension: null, mimeType: null};
        }

        // Check magic bytes
        const header = Array.from(fileContent.slice(0, 12)).map(b => b.toString(16).padStart(2, '0')).join('');
        
        // PNG: 89 50 4E 47 0D 0A 1A 0A
        if (header.startsWith('89504e47')) {
            return {extension: 'png', mimeType: 'image/png'};
        }
        
        // JPEG: FF D8 FF
        if (header.startsWith('ffd8ff')) {
            return {extension: 'jpg', mimeType: 'image/jpeg'};
        }
        
        // GIF: 47 49 46 38
        if (header.startsWith('47494638')) {
            return {extension: 'gif', mimeType: 'image/gif'};
        }
        
        // WebP: 52 49 46 46 [4 bytes] 57 45 42 50
        if (header.startsWith('52494646') && header.substring(16, 24) === '57454250') {
            return {extension: 'webp', mimeType: 'image/webp'};
        }
        
        // RIFF (could be WebP or other formats)
        if (header.startsWith('52494646')) {
            return {extension: 'webp', mimeType: 'image/webp'}; // Assume WebP for RIFF in DALL-E context
        }

        return {extension: null, mimeType: null};
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
        zip: JSZip,
        attachment: StandardAttachment,
        conversationId?: string,
        messageId?: string
    ): Promise<JSZip.JSZipObject | null> {
        if (!attachment.fileId) {
            const context = conversationId && messageId
                ? `conversation: ${conversationId}, message: ${messageId}`
                : conversationId
                ? `conversation: ${conversationId}`
                : 'unknown context';
            this.logger.warn(`No fileId provided for attachment: ${attachment.fileName} (${context})`);

            // Fallback: try to find by filename only
            const zipFile = zip.file(attachment.fileName);
            if (zipFile) {
                this.logger.debug(`Found attachment by filename fallback: ${attachment.fileName} (${context})`);
                return zipFile;
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

        // Strategy 1: Try exact filename match first
        let zipFile = zip.file(attachment.fileName);
        if (zipFile) {
            this.zipFileCache.set(cacheKey, zipFile);
            return zipFile;
        }

        // Strategy 2: DALL-E Strategy - Check dalle-generations/ folder first (restored from v1.2.0)
        if (attachment.fileName.startsWith('dalle_')) {
            const dalleFiles = await this.searchDalleGenerations(zip, attachment.fileId);
            if (dalleFiles.length > 0) {
                this.logger.debug(`Found DALL-E file in dalle-generations/: ${dalleFiles[0].name}`);
                this.zipFileCache.set(cacheKey, dalleFiles[0]);
                return dalleFiles[0]; // Return first match
            }
        }

        // Strategy 3: Regular file ID patterns (restored from v1.2.0)
        const fileIdPattern = `${attachment.fileId}-${attachment.fileName}`;
        zipFile = zip.file(fileIdPattern);
        if (zipFile) {
            this.logger.debug(`Found file by ID pattern match: ${fileIdPattern}`);
            this.zipFileCache.set(cacheKey, zipFile);
            return zipFile;
        }

        // Strategy 4: Pattern file-{ID}.{ext} (restored from v1.2.0)
        const extension = this.getFileExtension(attachment.fileName);
        if (extension) {
            const fileIdExtPattern = `${attachment.fileId}.${extension}`;
            zipFile = zip.file(fileIdExtPattern);
            if (zipFile) {
                this.logger.debug(`Found file by ID extension match: ${fileIdExtPattern}`);
                this.zipFileCache.set(cacheKey, zipFile);
                return zipFile;
            }
        }

        // Strategy 5: Comprehensive search by file ID in entire ZIP
        const foundFile = await this.searchZipByFileId(zip, attachment.fileId);

        // Cache result (even if null)
        this.zipFileCache.set(cacheKey, foundFile);

        return foundFile;
    }

    /**
     * Search entire ZIP for file by exact ID with enhanced DALL-E support
     */
    private async searchZipByFileId(zip: JSZip, fileId: string): Promise<JSZip.JSZipObject | null> {
        // Search through all files in ZIP for exact match
        for (const [path, file] of Object.entries(zip.files)) {
            if (file.dir) continue;

            // Strategy 1: Check if path contains the exact file ID
            if (path.includes(fileId)) {
                return file;
            }

            // Strategy 2: For DALL-E files, also check common patterns
            // DALL-E files might be stored as:
            // - dalle/file-{fileId}.png
            // - images/{fileId}.dat
            // - attachments/{fileId}
            const fileName = path.split('/').pop() || '';
            if (fileName.includes(fileId) ||
                fileName.startsWith(`file-${fileId}`) ||
                fileName.startsWith(fileId)) {
                return file;
            }
        }

        return null;
    }

    /**
     * Find file using attachment map (multi-ZIP fallback)
     * Tries to find the file in any of the available ZIPs, preferring newer exports
     */
    private async findFileUsingAttachmentMap(
        attachment: StandardAttachment,
        conversationId?: string,
        messageId?: string
    ): Promise<JSZip.JSZipObject | null> {
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
                    this.logger.debug(`Found attachment using alternative ID ${altId}: ${attachment.fileName} (${context})`);
                    return this.getFileFromLocation(altLocations[altLocations.length - 1]);
                }
            }
            return null;
        }

        // Use the newest location (last in array)
        const bestLocation = locations[locations.length - 1];

        this.logger.debug(`Found attachment in ZIP ${bestLocation.zipIndex + 1} (${bestLocation.zipFileName}): ${bestLocation.path} (${context})`);

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
    private getFileFromLocation(location: AttachmentLocation): JSZip.JSZipObject | null {
        if (location.zipIndex >= this.allZips.length) {
            this.logger.error(`Invalid ZIP index ${location.zipIndex} (only ${this.allZips.length} ZIPs available)`);
            return null;
        }

        const zip = this.allZips[location.zipIndex];
        const zipFile = zip.file(location.path);

        if (!zipFile) {
            this.logger.error(`File not found in ZIP ${location.zipIndex}: ${location.path}`);
            return null;
        }

        return zipFile;
    }

    /**
     * Search specifically in dalle-generations/ folder (restored from v1.2.0)
     */
    private async searchDalleGenerations(zip: JSZip, fileId: string): Promise<JSZip.JSZipObject[]> {
        const matches: JSZip.JSZipObject[] = [];

        for (const [path, file] of Object.entries(zip.files)) {
            if (!file.dir && path.toLowerCase().includes('dalle')) {
                // Check various patterns for DALL-E files
                if (path.includes(fileId) ||
                    path.includes(fileId.replace('file_', '')) ||
                    path.includes(fileId.replace('file-', ''))) {
                    matches.push(file);
                }
            }
        }

        return matches;
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
        const safeFileName = this.sanitizeFileName(attachment.fileName);

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
     * Sanitize filename and handle potential conflicts
     */
    private sanitizeFileName(fileName: string): string {
        let cleanName = fileName
            .replace(/[<>:"\/\\|?*]/g, '_')
            .replace(/\s+/g, '_')
            .trim();
            
        // If filename conflicts might occur, we could add a timestamp prefix
        // but for now, ChatGPT file IDs should make names unique enough
        return cleanName;
    }

    /**
     * Format file size in human-readable format
     */
    private formatFileSize(bytes: number): string {
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        if (bytes === 0) return '0 Bytes';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }

    /**
     * Clear ZIP file cache (call between different ZIP files)
     */
    clearCache(): void {
        this.zipFileCache.clear();
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