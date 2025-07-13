// src/providers/chatgpt/chatgpt-attachment-extractor.ts
import JSZip from "jszip";
import { StandardAttachment, AttachmentStatus } from "../../types/standard";
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
        this.logger.info('ChatGPT Attachment Extractor - Starting best effort extraction', {
            conversationId,
            attachmentCount: attachments.length,
            importEnabled: this.plugin.settings.importAttachments
        });

        if (!this.plugin.settings.importAttachments || attachments.length === 0) {
            this.logger.info('ChatGPT Attachment Extractor - Skipping extraction (disabled or no attachments)');
            return attachments.map(att => ({ ...att, status: { processed: false, found: false } }));
        }

        const processedAttachments: StandardAttachment[] = [];

        for (const attachment of attachments) {
            this.logger.info('ChatGPT Attachment Extractor - Processing attachment', attachment);
            try {
                const result = await this.processAttachmentBestEffort(zip, conversationId, attachment);
                processedAttachments.push(result);
            } catch (error) {
                this.logger.error(`Failed to process ChatGPT attachment: ${attachment.fileName}`, error);
                // Even if processing fails, return attachment with error status
                processedAttachments.push({
                    ...attachment,
                    status: {
                        processed: false,
                        found: false,
                        reason: 'extraction_failed',
                        note: `Processing failed: ${error.message}`
                    }
                });
            }
        }

        this.logger.info('ChatGPT Attachment Extractor - Finished best effort extraction', {
            total: attachments.length,
            found: processedAttachments.filter(a => a.status?.found).length,
            missing: processedAttachments.filter(a => !a.status?.found).length
        });

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
                this.logger.info(`Successfully extracted ChatGPT attachment: ${extractResult.localPath}`);
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
        } catch (error) {
            this.logger.error(`Error extracting ChatGPT attachment: ${attachment.fileName}`, error);
            return {
                ...attachment,
                status: {
                    processed: true,
                    found: true, // File exists but extraction failed
                    reason: 'extraction_failed',
                    note: `Extraction failed: ${error.message}`
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

        if (finalPath !== originalPath) {
            this.logger.info(`Resolved file conflict: ${originalPath} -> ${finalPath}`);
        }

        return finalPath;
    }

    /**
     * Find file in ZIP - ENHANCED FOR DALL-E SUPPORT
     */
    private async findChatGPTFileById(zip: JSZip, attachment: StandardAttachment): Promise<JSZip.JSZipObject | null> {
        this.logger.info('ChatGPT Attachment Extractor - Looking for file', {
            fileName: attachment.fileName,
            fileId: attachment.fileId
        });

        // Strategy 1: Try exact filename match first
        let zipFile = zip.file(attachment.fileName);
        if (zipFile) {
            this.logger.info('ChatGPT Attachment Extractor - Found exact filename match');
            return zipFile;
        }

        // Strategy 2: If we have a file ID, try DALL-E specific patterns
        if (attachment.fileId) {
            
            // DALL-E Strategy: Check dalle-generations/ folder first
            if (attachment.fileName.startsWith('dalle_')) {
                const dalleFiles = await this.searchDalleGenerations(zip, attachment.fileId);
                if (dalleFiles.length > 0) {
                    this.logger.info('ChatGPT Attachment Extractor - Found DALL-E file in dalle-generations/');
                    return dalleFiles[0]; // Return first match
                }
            }
            
            // Regular file ID patterns
            const fileIdPattern = `${attachment.fileId}-${attachment.fileName}`;
            zipFile = zip.file(fileIdPattern);
            if (zipFile) {
                this.logger.info('ChatGPT Attachment Extractor - Found file ID pattern match');
                return zipFile;
            }

            // Pattern: file-{ID}.{ext}
            const extension = this.getFileExtension(attachment.fileName);
            if (extension) {
                const fileIdExtPattern = `${attachment.fileId}.${extension}`;
                zipFile = zip.file(fileIdExtPattern);
                if (zipFile) {
                    this.logger.info('ChatGPT Attachment Extractor - Found file ID extension match');
                    return zipFile;
                }
            }
        }

        // Strategy 3: Comprehensive search through all files
        this.logger.info('ChatGPT Attachment Extractor - Performing comprehensive search...');
        return await this.comprehensiveFileSearch(zip, attachment);
    }

    /**
     * Comprehensive search through all ZIP files with multiple strategies
     */
    private async comprehensiveFileSearch(zip: JSZip, attachment: StandardAttachment): Promise<JSZip.JSZipObject | null> {
        const searchStrategies = [];
        
        // Prepare search terms
        if (attachment.fileId) {
            // Clean file ID variants
            const cleanId = attachment.fileId.replace(/^(file_|file-)/i, '');
            searchStrategies.push(
                attachment.fileId,           // full ID
                cleanId,                     // clean ID
                attachment.fileId.toLowerCase(),
                cleanId.toLowerCase()
            );
        }
        
        // Search through all files
        for (const [path, file] of Object.entries(zip.files)) {
            if (file.dir) continue;
            
            const pathLower = path.toLowerCase();
            const fileName = path.split('/').pop() || '';
            
            // Strategy 1: File ID in path
            for (const searchTerm of searchStrategies) {
                if (pathLower.includes(searchTerm.toLowerCase())) {
                    this.logger.info(`ChatGPT Attachment Extractor - Found file by ID search: ${path}`);
                    return file;
                }
            }
            
            // Strategy 2: Exact filename at end of path
            if (pathLower.endsWith(attachment.fileName.toLowerCase())) {
                this.logger.info(`ChatGPT Attachment Extractor - Found file by filename: ${path}`);
                return file;
            }
            
            // Strategy 3: Similar filename (fuzzy match)
            if (this.isSimilarFilename(fileName, attachment.fileName)) {
                this.logger.info(`ChatGPT Attachment Extractor - Found file by similar name: ${path}`);
                return file;
            }
        }
        
        this.logger.info('ChatGPT Attachment Extractor - File not found in ZIP after comprehensive search');
        return null;
    }

    /**
     * Check if two filenames are similar (for fuzzy matching)
     */
    private isSimilarFilename(zipFileName: string, targetFileName: string): boolean {
        const normalize = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '');
        const zipNorm = normalize(zipFileName);
        const targetNorm = normalize(targetFileName);
        
        // Similar if one contains the other, or if they're very close
        if (zipNorm.includes(targetNorm) || targetNorm.includes(zipNorm)) {
            return true;
        }
        
        // Check for partial matches (at least 50% similarity for longer names)
        if (targetNorm.length > 10) {
            const similarity = this.calculateSimilarity(zipNorm, targetNorm);
            return similarity > 0.5;
        }
        
        return false;
    }

    /**
     * Calculate simple string similarity
     */
    private calculateSimilarity(str1: string, str2: string): number {
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;
        
        if (longer.length === 0) return 1.0;
        
        let matches = 0;
        for (let i = 0; i < shorter.length; i++) {
            if (longer.includes(shorter[i])) matches++;
        }
        
        return matches / longer.length;
    }

    /**
     * Search specifically in dalle-generations/ folder
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

        // Fall back to file extension
        const ext = this.getFileExtension(attachment.fileName);
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
     * Get file extension from filename
     */
    private getFileExtension(fileName: string): string {
        const lastDot = fileName.lastIndexOf('.');
        return lastDot === -1 ? '' : fileName.substring(lastDot + 1).toLowerCase();
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