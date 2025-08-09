// src/providers/claude/claude-attachment-extractor.ts
import JSZip from "jszip";
import { StandardAttachment } from "../../types/standard";
import { Logger } from "../../types/plugin";
import type NexusAiChatImporterPlugin from "../../main";

export class ClaudeAttachmentExtractor {
    constructor(
        private plugin: NexusAiChatImporterPlugin,
        private logger: Logger
    ) {}

    /**
     * Extract attachments from Claude ZIP archive
     * NOTE: Claude exports typically do NOT include the actual files, only references
     * This method handles the "files not found" case gracefully
     */
    async extractAttachments(
        zip: JSZip,
        conversationId: string,
        attachments: StandardAttachment[]
    ): Promise<StandardAttachment[]> {
        if (!this.plugin.settings.importAttachments || attachments.length === 0) {
            return attachments.map(att => ({
                ...att,
                extractedContent: `File: ${att.fileName} (attachment import disabled)`
            }));
        }

        const processedAttachments: StandardAttachment[] = [];

        for (const attachment of attachments) {
            try {
                const processedAttachment = await this.processAttachment(zip, conversationId, attachment);
                processedAttachments.push(processedAttachment);
            } catch (error) {
                this.logger.error(`Failed to process Claude attachment ${attachment.fileName}:`, error);
                // Return the attachment with error status
                processedAttachments.push({
                    ...attachment,
                    extractedContent: `❌ **File: ${attachment.fileName}**\n\nError processing attachment: ${error instanceof Error ? error.message : 'Unknown error'}`
                });
            }
        }

        return processedAttachments;
    }

    /**
     * Process a single Claude attachment
     * Claude exports typically don't include files, so we create informative placeholders
     */
    private async processAttachment(
        zip: JSZip,
        conversationId: string,
        attachment: StandardAttachment
    ): Promise<StandardAttachment> {
        const fileName = attachment.fileName;

        // Try to find the file in the ZIP (unlikely for Claude exports)
        const zipFile = this.findFileInZip(zip, fileName);

        if (!zipFile) {
            // This is the normal case for Claude - files are not included in export
            return this.createFileNotFoundPlaceholder(attachment);
        }

        // If file is found (rare), extract it
        if (this.isImageFile(fileName)) {
            return await this.processImageAttachment(zipFile, attachment, conversationId);
        } else if (this.isTextFile(fileName)) {
            return await this.processTextAttachment(zipFile, attachment);
        } else {
            return await this.processBinaryAttachment(zipFile, attachment, conversationId);
        }
    }

    /**
     * Create simple placeholder for missing files (normal for Claude)
     */
    private createFileNotFoundPlaceholder(attachment: StandardAttachment): StandardAttachment {
        const fileName = attachment.fileName;

        const placeholder = `📎 **Attachment:** ${fileName} (not included in archive. [Click to open original conversation](https://claude.ai))`;

        return {
            ...attachment,
            extractedContent: placeholder
        };
    }

    /**
     * Get file type from extension
     */
    private getFileTypeFromExtension(fileName: string): string {
        const extension = fileName.split('.').pop()?.toLowerCase();

        switch (extension) {
            case 'png':
            case 'jpg':
            case 'jpeg':
            case 'gif':
            case 'webp':
                return `image/${extension}`;
            case 'pdf':
                return 'application/pdf';
            case 'txt':
                return 'text/plain';
            case 'md':
                return 'text/markdown';
            case 'json':
                return 'application/json';
            default:
                return 'application/octet-stream';
        }
    }

    /**
     * Find a file in the ZIP archive
     * Claude files might be in root or in subdirectories
     */
    private findFileInZip(zip: JSZip, fileName: string): JSZip.JSZipObject | null {
        // Try exact match first
        let file = zip.file(fileName);
        if (file) return file;

        // Try in common subdirectories
        const commonPaths = ['attachments/', 'files/', 'uploads/'];
        for (const path of commonPaths) {
            file = zip.file(path + fileName);
            if (file) return file;
        }

        // Search through all files for a match
        const allFiles = Object.keys(zip.files);
        for (const filePath of allFiles) {
            if (filePath.endsWith(fileName) || filePath.includes(fileName)) {
                return zip.file(filePath);
            }
        }

        return null;
    }

    /**
     * Process image attachment
     */
    private async processImageAttachment(
        zipFile: JSZip.JSZipObject,
        attachment: StandardAttachment,
        conversationId: string
    ): Promise<StandardAttachment> {
        try {
            const imageData = await zipFile.async("base64");
            const fileName = this.generateUniqueFileName(attachment.fileName, conversationId);
            
            // Save to vault if enabled
            if (this.plugin.settings.importAttachments) {
                const filePath = await this.saveAttachmentToVault(fileName, imageData, true, "images");

                return {
                    ...attachment,
                    fileName: fileName,
                    extractedContent: `![${attachment.fileName}](${filePath})`
                };
            } else {
                return {
                    ...attachment,
                    extractedContent: `Image: ${attachment.fileName} (not imported - attachment import disabled)`
                };
            }
        } catch (error) {
            this.logger.error(`Error processing Claude image ${attachment.fileName}:`, error);
            return {
                ...attachment,
                extractedContent: `Error processing image: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    /**
     * Process text attachment
     */
    private async processTextAttachment(
        zipFile: JSZip.JSZipObject,
        attachment: StandardAttachment
    ): Promise<StandardAttachment> {
        try {
            const textContent = await zipFile.async("string");
            
            return {
                ...attachment,
                extractedContent: `\`\`\`\n${textContent}\n\`\`\``
            };
        } catch (error) {
            this.logger.error(`Error processing Claude text file ${attachment.fileName}:`, error);
            return {
                ...attachment,
                extractedContent: `Error reading text file: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    /**
     * Process binary attachment
     */
    private async processBinaryAttachment(
        zipFile: JSZip.JSZipObject,
        attachment: StandardAttachment,
        conversationId: string
    ): Promise<StandardAttachment> {
        try {
            if (this.plugin.settings.importAttachments) {
                const binaryData = await zipFile.async("base64");
                const fileName = this.generateUniqueFileName(attachment.fileName, conversationId);
                const filePath = await this.saveAttachmentToVault(fileName, binaryData, true, "documents");

                return {
                    ...attachment,
                    fileName: fileName,
                    extractedContent: `[${attachment.fileName}](${filePath})`
                };
            } else {
                return {
                    ...attachment,
                    extractedContent: `File: ${attachment.fileName} (not imported - attachment import disabled)`
                };
            }
        } catch (error) {
            this.logger.error(`Error processing Claude binary file ${attachment.fileName}:`, error);
            return {
                ...attachment,
                extractedContent: `Error processing file: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    /**
     * Check if file is an image
     */
    private isImageFile(fileName: string): boolean {
        const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp'];
        return imageExtensions.some(ext => fileName.toLowerCase().endsWith(ext));
    }

    /**
     * Check if file is a text file
     */
    private isTextFile(fileName: string): boolean {
        const textExtensions = ['.txt', '.md', '.json', '.csv', '.xml', '.html', '.css', '.js', '.ts', '.py', '.java', '.cpp', '.c', '.h'];
        return textExtensions.some(ext => fileName.toLowerCase().endsWith(ext));
    }

    /**
     * Generate unique filename to avoid conflicts
     */
    private generateUniqueFileName(originalFileName: string, conversationId: string): string {
        const timestamp = Date.now();
        const shortConversationId = conversationId.substring(0, 8);
        const extension = originalFileName.includes('.') ? originalFileName.split('.').pop() : '';
        const baseName = originalFileName.replace(/\.[^/.]+$/, "");
        
        return extension 
            ? `claude_${shortConversationId}_${timestamp}_${baseName}.${extension}`
            : `claude_${shortConversationId}_${timestamp}_${baseName}`;
    }

    /**
     * Save attachment to vault using attachmentFolder setting
     */
    private async saveAttachmentToVault(fileName: string, data: string, isBase64: boolean, category: string = "files"): Promise<string> {
        const attachmentFolder = `${this.plugin.settings.attachmentFolder}/claude/${category}`;

        // Ensure folder exists
        const { ensureFolderExists } = await import("../../utils");
        const folderResult = await ensureFolderExists(attachmentFolder, this.plugin.app.vault);
        if (!folderResult.success) {
            throw new Error(`Failed to create Claude attachment folder: ${folderResult.error}`);
        }

        const filePath = `${attachmentFolder}/${fileName}`;

        if (isBase64) {
            // Convert base64 to array buffer for binary files
            const binaryString = atob(data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            await this.plugin.app.vault.createBinary(filePath, bytes.buffer);
        } else {
            await this.plugin.app.vault.create(filePath, data);
        }

        return filePath;
    }
}
