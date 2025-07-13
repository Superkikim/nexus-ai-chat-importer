// src/providers/chatgpt/chatgpt-attachment-extractor.ts
import JSZip from "jszip";
import { StandardAttachment } from "../../types/standard";
import { ensureFolderExists } from "../../utils";
import { Logger } from "../../logger";
import type NexusAiChatImporterPlugin from "../../main";


export class ChatGPTAttachmentExtractor {
    constructor(private plugin: NexusAiChatImporterPlugin, private logger: Logger) {}

    /**
     * Extract and save ChatGPT attachments using "best effort" strategy
     * - If file exists in ZIP: extract and link
     * - If file missing: create informative note
     */
    async extractAttachments(
        zip: JSZip,
        conversationId: string,
        attachments: StandardAttachment[]
    ): Promise<StandardAttachment[]> {
        if (!this.plugin.settings.importAttachments || attachments.length === 0) {
            return attachments.map(att => ({ ...att, status: { processed: false, found: false } }));
        }

        const processedAttachments: StandardAttachment[] = [];

        for (const attachment of attachments) {
            try {
                const result = await this.processAttachmentBestEffort(zip, conversationId, attachment);
                processedAttachments.push(result);
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                this.logger.error(`Failed to process ChatGPT attachment: ${attachment.fileName}`, errorMessage);
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
        attachment: StandardAttachment
    ): Promise<StandardAttachment> {
        // Try to find file in ZIP
        const zipFile = await this.findChatGPTFileById(zip, attachment);
        
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
                return {
                    ...attachment,
                    fileName: extractResult.finalFileName, // Update with actual extracted filename
                    fileType: extractResult.actualFileType, // Update with detected file type
                    url: extractResult.localPath,
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
            this.logger.error(`Error extracting ChatGPT attachment: ${attachment.fileName}`, errorMessage);
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
        
        // Update filename with correct extension if needed
        let finalFileName = attachment.fileName;
        if (zipFile.name.endsWith('.dat') && formatInfo.extension) {
            // Replace .dat with correct extension
            const baseName = attachment.fileName.replace(/\.(dat|png|jpg|jpeg|gif|webp)$/i, '');
            finalFileName = `${baseName}.${formatInfo.extension}`;
        }
        
        // Generate target path for saving
        let targetPath = this.generateLocalPath(conversationId, {
            ...attachment,
            fileName: finalFileName,
            fileType: formatInfo.mimeType || attachment.fileType
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
        await this.plugin.app.vault.adapter.writeBinary(targetPath, fileContent);

        return {
            localPath: targetPath,
            finalFileName: finalFileName,
            actualFileType: formatInfo.mimeType || attachment.fileType || 'application/octet-stream'
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
     * Find file in ZIP - ENHANCED WITH COMPREHENSIVE SEARCH
     */
    private async findChatGPTFileById(zip: JSZip, attachment: StandardAttachment): Promise<JSZip.JSZipObject | null> {
        if (!attachment.fileId) {
            this.logger.warn('No fileId provided for attachment:', attachment.fileName);
            return null;
        }

        // Strategy 1: Try exact filename match first
        let zipFile = zip.file(attachment.fileName);
        if (zipFile) {
            return zipFile;
        }

        // Strategy 2: Comprehensive search by file ID in entire ZIP
        const foundFile = await this.searchZipByFileId(zip, attachment.fileId);
        if (foundFile) {
            return foundFile;
        }

        return null;
    }

    /**
     * Search entire ZIP for file by exact ID
     */
    private async searchZipByFileId(zip: JSZip, fileId: string): Promise<JSZip.JSZipObject | null> {
        // Search through all files in ZIP for exact match
        for (const [path, file] of Object.entries(zip.files)) {
            if (file.dir) continue;
            
            // Check if path contains the exact file ID
            if (path.includes(fileId)) {
                return file;
            }
        }
        
        return null;
    }

    /**
     * Generate local path for ChatGPT attachment - simplified structure
     */
    private generateLocalPath(conversationId: string, attachment: StandardAttachment): string {
        const baseFolder = this.plugin.settings.attachmentFolder;
        const category = this.categorizeFile(attachment);
        
        // Clean filename for filesystem - keep original name since it should be unique
        const safeFileName = this.sanitizeFileName(attachment.fileName);
        
        // Simple structure: attachments/chatgpt/images/filename.jpg
        return `${baseFolder}/chatgpt/${category}/${safeFileName}`;
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