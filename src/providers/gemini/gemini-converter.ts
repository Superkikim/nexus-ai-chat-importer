import type { StandardConversation, StandardMessage, StandardAttachment } from "../../types/standard";
import type { GeminiActivityEntry } from "./gemini-types";
import { createHash } from "crypto";

/**
 * Converts Gemini Activity entries to StandardConversation format
 */
export class GeminiConverter {
	/**
	 * Convert a single Gemini activity entry to a StandardConversation
	 */
	convertEntry(entry: GeminiActivityEntry): StandardConversation {
		const id = this.generateId(entry);
		const title = this.extractTitle(entry);
		const timestamp = this.parseTimestamp(entry.time);
		const messages = this.convertMessages(entry);

		return {
			id,
			title,
			provider: "gemini",
			createTime: timestamp,
			updateTime: timestamp,
			messages,
			metadata: {
				header: entry.header,
				products: entry.products,
				activityControls: entry.activityControls,
				subtitles: entry.subtitles,
			},
		};
	}

	/**
	 * Generate a stable ID from the entry
	 */
	private generateId(entry: GeminiActivityEntry): string {
		// Use time + title for stable ID
		const composite = `${entry.time}-${entry.title}`;
		return createHash("sha256").update(composite).digest("hex").substring(0, 16);
	}

	/**
	 * Extract title from entry
	 */
	private extractTitle(entry: GeminiActivityEntry): string {
		let title = entry.title || "Untitled Gemini Activity";

		// Remove common prefixes like "Prompted Gemini: " or "Asked Gemini: "
		title = title.replace(/^(Prompted|Asked)\s+Gemini:\s*/i, "");

		// Truncate if too long
		if (title.length > 100) {
			title = title.substring(0, 97) + "...";
		}

		return title;
	}

	/**
	 * Parse ISO 8601 timestamp to Unix seconds
	 */
	private parseTimestamp(timeString: string): number {
		try {
			return Math.floor(new Date(timeString).getTime() / 1000);
		} catch {
			return Math.floor(Date.now() / 1000);
		}
	}

	/**
	 * Convert entry to StandardMessage array (user prompt + assistant response)
	 */
	private convertMessages(entry: GeminiActivityEntry): StandardMessage[] {
		const messages: StandardMessage[] = [];
		const timestamp = this.parseTimestamp(entry.time);

		// User message (the prompt/question)
		const userContent = this.extractUserPrompt(entry);
		messages.push({
			id: `${this.generateId(entry)}-user`,
			role: "user",
			content: userContent,
			timestamp,
			attachments: this.extractUserAttachments(entry),
		});

		// Assistant message (the response)
		const assistantContent = this.extractAssistantResponse(entry);
		messages.push({
			id: `${this.generateId(entry)}-assistant`,
			role: "assistant",
			content: assistantContent,
			timestamp: timestamp + 1, // Slightly after user message
			attachments: this.extractAssistantAttachments(entry),
		});

		return messages;
	}

	/**
	 * Extract user prompt from entry
	 */
	private extractUserPrompt(entry: GeminiActivityEntry): string {
		return this.extractTitle(entry);
	}

	/**
	 * Extract assistant response from safeHtmlItem
	 */
	private extractAssistantResponse(entry: GeminiActivityEntry): string {
		if (entry.safeHtmlItem && entry.safeHtmlItem.length > 0) {
			const html = entry.safeHtmlItem[0].html;
			return this.htmlToText(html);
		}

		// If no HTML content but has attachments, indicate that
		if (entry.attachedFiles && entry.attachedFiles.length > 0) {
			return `*[Response with ${entry.attachedFiles.length} attachment(s)]*`;
		}

		return "*[No response content]*";
	}

	/**
	 * Convert HTML to plain text (simple implementation)
	 * TODO: Improve HTML to Markdown conversion
	 */
	private htmlToText(html: string): string {
		// Remove HTML tags and decode entities
		return html
			.replace(/<br\s*\/?>/gi, '\n')
			.replace(/<\/p>/gi, '\n\n')
			.replace(/<[^>]+>/g, '')
			.replace(/&nbsp;/g, ' ')
			.replace(/&lt;/g, '<')
			.replace(/&gt;/g, '>')
			.replace(/&amp;/g, '&')
			.replace(/&quot;/g, '"')
			.replace(/&#39;/g, "'")
			.trim();
	}

	/**
	 * Extract user attachments (currently none expected in Gemini exports)
	 */
	private extractUserAttachments(entry: GeminiActivityEntry): StandardAttachment[] {
		// Gemini exports don't typically include user-uploaded files in My Activity
		return [];
	}

	/**
	 * Extract assistant attachments from attachedFiles
	 */
	private extractAssistantAttachments(entry: GeminiActivityEntry): StandardAttachment[] {
		if (!entry.attachedFiles || entry.attachedFiles.length === 0) {
			return [];
		}

		return entry.attachedFiles.map((fileName, index) => ({
			fileName,
			fileSize: 0, // Unknown from JSON
			fileType: this.guessFileType(fileName),
			attachmentType: "file",
			status: {
				processed: false,
				found: false,
			},
		}));
	}

	/**
	 * Guess file type from extension
	 */
	private guessFileType(fileName: string): string {
		const ext = fileName.split(".").pop()?.toLowerCase();
		const typeMap: Record<string, string> = {
			png: "image/png",
			jpg: "image/jpeg",
			jpeg: "image/jpeg",
			gif: "image/gif",
			webp: "image/webp",
			pdf: "application/pdf",
			txt: "text/plain",
		};
		return typeMap[ext || ""] || "application/octet-stream";
	}
}

