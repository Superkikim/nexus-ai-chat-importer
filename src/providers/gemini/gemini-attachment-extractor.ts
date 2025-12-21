import type { AttachmentExtractor } from "../base/base-provider-adapter";
import type { StandardAttachment } from "../../types/standard";
import type JSZip from "jszip";
import type NexusAiChatImporterPlugin from "../../main";
import { detectFileFormat, getFileCategory, sanitizeFileName } from "../../utils/file-utils";
import { normalizePath } from "obsidian";
import { ensureFolderExists } from "../../utils";

/**
 * Extracts attachments from Gemini Takeout exports
 */
export class GeminiAttachmentExtractor implements AttachmentExtractor {
	constructor(private plugin: NexusAiChatImporterPlugin) {}

	async extractAttachments(
		zip: JSZip,
		conversationId: string,
		attachments: StandardAttachment[],
		messageId?: string
	): Promise<StandardAttachment[]> {
		const processedAttachments: StandardAttachment[] = [];

		for (const attachment of attachments) {
			try {
				const processed = await this.processAttachment(zip, conversationId, attachment);
				processedAttachments.push(processed);
			} catch (error) {
				processedAttachments.push({
					...attachment,
					status: {
						processed: false,
						found: false,
						reason: 'extraction_failed',
						note: `Error: ${error instanceof Error ? error.message : String(error)}`,
					},
				});
			}
		}

		return processedAttachments;
	}

	/**
	 * Process a single attachment
	 */
	private async processAttachment(
		zip: JSZip,
		conversationId: string,
		attachment: StandardAttachment
	): Promise<StandardAttachment> {
		// Find the attachment file in the ZIP
		const zipFile = this.findAttachmentInZip(zip, attachment.fileName);

		if (!zipFile) {
			return {
				...attachment,
				status: {
					processed: false,
					found: false,
					reason: "missing_from_export",
					note: "File not found in ZIP",
				},
			};
		}

		// Read file content
		const fileContent = await zipFile.async("uint8array");

		// Detect file format
		let finalFileName = attachment.fileName;
		let finalFileType = attachment.fileType;

		if (!finalFileType || finalFileType === 'application/octet-stream') {
			const detected = detectFileFormat(fileContent);
			if (detected.extension && detected.mimeType) {
				finalFileType = detected.mimeType;
				if (!finalFileName.includes('.')) {
					finalFileName = `${finalFileName}.${detected.extension}`;
				}
			}
		}

		// Determine file category
		const category = getFileCategory(finalFileName, finalFileType);

		// Generate unique filename
		const sanitized = sanitizeFileName(finalFileName);
		const uniqueFileName = await this.resolveFileConflict(sanitized, category);

		// Build vault path
		const attachmentFolder = this.plugin.settings.attachmentFolder;
		const vaultPath = normalizePath(`${attachmentFolder}/gemini/${category}/${uniqueFileName}`);

		// Ensure folder exists
		const folderPath = vaultPath.substring(0, vaultPath.lastIndexOf('/'));
		await ensureFolderExists(folderPath, this.plugin.app.vault);

		// Save to vault
		await this.plugin.app.vault.adapter.writeBinary(vaultPath, fileContent.buffer as ArrayBuffer);

		return {
			...attachment,
			fileName: finalFileName,
			fileType: finalFileType,
			fileSize: fileContent.length,
			status: {
				processed: true,
				found: true,
				localPath: vaultPath,
			},
		};
	}

	/**
	 * Find attachment file in ZIP (search in Gemini folder)
	 */
	private findAttachmentInZip(zip: JSZip, fileName: string): JSZip.JSZipObject | null {
		// Search for files matching the pattern: Takeout/.../<*Gemini*>/<fileName>
		const allFiles = Object.keys(zip.files);

		for (const path of allFiles) {
			const segments = path.split("/");

			// Must be in Takeout structure
			if (segments.length < 3 || segments[0] !== "Takeout") {
				continue;
			}

			// Third segment must contain "Gemini"
			if (!segments[2].toLowerCase().includes("gemini")) {
				continue;
			}

			// Check if filename matches
			const pathFileName = segments[segments.length - 1];
			if (pathFileName === fileName) {
				return zip.files[path];
			}
		}

		return null;
	}

	/**
	 * Resolve filename conflicts by appending a counter
	 */
	private async resolveFileConflict(fileName: string, category: string): Promise<string> {
		const attachmentFolder = this.plugin.settings.attachmentFolder;
		const basePath = normalizePath(`${attachmentFolder}/gemini/${category}`);

		// Check if file exists
		const fullPath = normalizePath(`${basePath}/${fileName}`);
		const exists = await this.plugin.app.vault.adapter.exists(fullPath);

		if (!exists) {
			return fileName;
		}

		// File exists, append counter
		const nameParts = fileName.split(".");
		const ext = nameParts.length > 1 ? nameParts.pop() : "";
		const baseName = nameParts.join(".");

		let counter = 1;
		let uniqueName = ext ? `${baseName}_${counter}.${ext}` : `${baseName}_${counter}`;

		while (await this.plugin.app.vault.adapter.exists(normalizePath(`${basePath}/${uniqueName}`))) {
			counter++;
			uniqueName = ext ? `${baseName}_${counter}.${ext}` : `${baseName}_${counter}`;
		}

		return uniqueName;
	}
}

