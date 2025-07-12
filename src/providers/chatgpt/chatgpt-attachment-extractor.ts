// src/providers/chatgpt/chatgpt-attachment-extractor.ts
import JSZip from "jszip";
import { StandardAttachment } from "../../types/standard";
import { ensureFolderExists } from "../../utils";
import { Logger } from "../../logger";
import type NexusAiChatImporterPlugin from "../../main";

export class ChatGPTAttachmentExtractor {
    constructor(private plugin: NexusAiChatImporterPlugin, private logger: Logger) {}

    /**
     * Extract and save ChatGPT attachments, return updated attachments with local links
     */
    async extractAttachments(
        zip: JSZip,
        conversationId: string,
        attachments: StandardAttachment[]
    ): Promise<StandardAttachment[]> {
        if (!this.plugin.settings.importAttachments || attachments.length === 0) {
            return attachments;
        }

        const processedAttachments: StandardAttachment[] = [];

        for (const attachment of attachments) {
            try {
                const localPath = await this.extractSingleAttachment(zip, conversationId, attachment);
                
                processedAttachments.push({
                    ...attachment,
                    url: localPath // Set the local file path as URL for linking
                });
            } catch (error) {
                this.logger.error(`Failed to extract ChatGPT attachment: ${attachment.fileName}`, error);
                processedAttachments.push(attachment); // Keep original if failed
            }
        }

        return processedAttachments;
    }

    /**
     * Extract single attachment using ChatGPT file ID mapping
     */
    private async extractSingleAttachment(
        zip: JSZip,
        conversationId: string,
        attachment: StandardAttachment
    ): Promise<string | null> {
        // Find file in ZIP using ChatGPT's file ID pattern
        const zipFile = this.findChatGPTFileById(zip, attachment);
        if (!zipFile) {
            this.logger.warn(`ChatGPT attachment not found in ZIP: ${attachment.fileName} (ID: ${attachment.fileId})`);
            return null;
        }

        // Generate target path for saving
        const targetPath = this.generateLocalPath(conversationId, attachment);

        // Ensure folder exists
        const folderPath = targetPath.substring(0, targetPath.lastIndexOf('/'));
        const folderResult = await ensureFolderExists(folderPath, this.plugin.app.vault);
        if (!folderResult.success) {
            throw new Error(`Failed to create ChatGPT attachment folder: ${folderResult.error}`);
        }

        // Extract and save file
        const fileContent = await zipFile.async("uint8array");
        await this.plugin.app.vault.adapter.writeBinary(targetPath, fileContent);

        this.logger.info(`Saved ChatGPT attachment: ${targetPath}`);
        return targetPath;
    }

    /**
     * Find file in ZIP using ChatGPT's file ID
     * Pattern: file-{ID}-{original-name} or just file-{ID}.{ext}
     */
    private findChatGPTFileById(zip: JSZip, attachment: StandardAttachment): JSZip.JSZipObject | null {
        if (!attachment.fileId) {
            return null;
        }

        // Try exact filename match first
        let zipFile = zip.file(attachment.fileName);
        if (zipFile) return zipFile;

        // Try file ID pattern: file-{ID}-{name}
        const fileIdPattern = `${attachment.fileId}-${attachment.fileName}`;
        zipFile = zip.file(fileIdPattern);
        if (zipFile) return zipFile;

        // Search through all files for pattern matching
        for (const [path, file] of Object.entries(zip.files)) {
            if (!file.dir) {
                // Check if file path contains the file ID
                if (path.includes(attachment.fileId)) {
                    return file;
                }
                // Check if filename matches at the end of path
                if (path.endsWith(attachment.fileName)) {
                    return file;
                }
            }
        }

        return null;
    }

    /**
     * Generate local path for ChatGPT attachment
     */
    private generateLocalPath(conversationId: string, attachment: StandardAttachment): string {
        const baseFolder = this.plugin.settings.attachmentFolder;
        const category = this.categorizeFile(attachment);
        
        // Clean filename for filesystem
        const safeFileName = this.sanitizeFileName(attachment.fileName);
        
        return `${baseFolder}/chatgpt/${conversationId}/${category}/${safeFileName}`;
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
     * Sanitize filename for filesystem compatibility
     */
    private sanitizeFileName(fileName: string): string {
        return fileName
            .replace(/[<>:"\/\\|?*]/g, '_')
            .replace(/\s+/g, '_')
            .trim();
    }
}