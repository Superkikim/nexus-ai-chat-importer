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
        const zipFile = this.findChatGPTFileById(zip, attachment);
        
        if (!zipFile) {
            // File not found - create informative status
            this.logger.warn(`ChatGPT attachment not found in ZIP: ${attachment.fileName}`);
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
            const localPath = await this.extractSingleAttachment(zip, conversationId, attachment, zipFile);
            
            if (localPath) {
                this.logger.info(`Successfully extracted ChatGPT attachment: ${localPath}`);
                return {
                    ...attachment,
                    url: localPath,
                    status: {
                        processed: true,
                        found: true,
                        localPath: localPath
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
     * Extract single attachment to disk with conflict resolution
     */
    private async extractSingleAttachment(
        zip: JSZip,
        conversationId: string,
        attachment: StandardAttachment,
        zipFile: JSZip.JSZipObject
    ): Promise<string | null> {
        // Generate target path for saving
        let targetPath = this.generateLocalPath(conversationId, attachment);

        // Ensure folder exists
        const folderPath = targetPath.substring(0, targetPath.lastIndexOf('/'));
        const folderResult = await ensureFolderExists(folderPath, this.plugin.app.vault);
        if (!folderResult.success) {
            throw new Error(`Failed to create ChatGPT attachment folder: ${folderResult.error}`);
        }

        // Handle file conflicts by adding suffix if needed
        targetPath = await this.resolveFileConflict(targetPath);

        // Extract and save file
        const fileContent = await zipFile.async("uint8array");
        await this.plugin.app.vault.adapter.writeBinary(targetPath, fileContent);

        return targetPath;
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
     * Find file in ZIP using ChatGPT's file ID with enhanced search
     */
    private findChatGPTFileById(zip: JSZip, attachment: StandardAttachment): JSZip.JSZipObject | null {
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

        // Strategy 2: If we have a file ID, try file ID patterns
        if (attachment.fileId) {
            // Pattern: file-{ID}-{name}
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

        // Strategy 3: Search through all files for pattern matching
        this.logger.info('ChatGPT Attachment Extractor - Searching all files for patterns...');
        for (const [path, file] of Object.entries(zip.files)) {
            if (!file.dir) {
                // Check if file path contains the file ID
                if (attachment.fileId && path.includes(attachment.fileId)) {
                    this.logger.info('ChatGPT Attachment Extractor - Found file by ID in path:', path);
                    return file;
                }
                // Check if filename matches at the end of path
                if (path.endsWith(attachment.fileName)) {
                    this.logger.info('ChatGPT Attachment Extractor - Found file by filename at end of path:', path);
                    return file;
                }
                // Check for similar names (case-insensitive)
                if (path.toLowerCase().includes(attachment.fileName.toLowerCase())) {
                    this.logger.info('ChatGPT Attachment Extractor - Found file by similar name:', path);
                    return file;
                }
            }
        }

        this.logger.info('ChatGPT Attachment Extractor - File not found in ZIP');
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