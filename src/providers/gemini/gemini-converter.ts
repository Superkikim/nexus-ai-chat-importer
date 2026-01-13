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
	 * Extract title from entry (for conversation title - truncated)
	 */
	private extractTitle(entry: GeminiActivityEntry): string {
		let title = entry.title || "Untitled Gemini Activity";

		// Remove common prefixes like "Prompted ", "Live Prompt ", "Asked "
		title = title.replace(/^(Prompted|Live Prompt|Asked)\s+/i, "");

		// Truncate to 60 characters for readability
		if (title.length > 60) {
			title = title.substring(0, 57) + "...";
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
	 * Extract user prompt from entry (full text, not truncated)
	 */
	private extractUserPrompt(entry: GeminiActivityEntry): string {
		if (!entry.title) {
			return "";
		}

		// Remove common prefixes like "Prompted ", "Live Prompt ", "Asked "
		return entry.title.replace(/^(Prompted|Live Prompt|Asked)\s+/i, "").trim();
	}

	/**
	 * Extract assistant response from safeHtmlItem
	 */
	private extractAssistantResponse(entry: GeminiActivityEntry): string {
		if (entry.safeHtmlItem && entry.safeHtmlItem.length > 0) {
			const html = entry.safeHtmlItem[0].html;
			return this.htmlToText(html);
		}

		// Return empty string - formatter will handle attachments-only messages
		return "";
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
	 * Extract user attachments (from imageFile field)
	 */
	private extractUserAttachments(entry: GeminiActivityEntry): StandardAttachment[] {
		const attachments: StandardAttachment[] = [];

		// User-uploaded image (imageFile field)
		if (entry.imageFile) {
			attachments.push({
				fileName: entry.imageFile,
				fileSize: 0,
				fileType: this.guessFileType(entry.imageFile),
				attachmentType: "file",
				status: {
					processed: false,
					found: false,
				},
			});
		}

		return attachments;
	}

	/**
	 * Extract assistant attachments (from safeHtmlItem images)
	 */
	private extractAssistantAttachments(entry: GeminiActivityEntry): StandardAttachment[] {
		const attachments: StandardAttachment[] = [];

		// Extract images from safeHtmlItem (generated images)
		if (entry.safeHtmlItem && entry.safeHtmlItem.length > 0) {
			const html = entry.safeHtmlItem[0].html;
			// Extract image sources from <img src="...">
			const imgRegex = /<img[^>]+src="([^"]+)"/gi;
			let match;
			while ((match = imgRegex.exec(html)) !== null) {
				const fileName = match[1];
				attachments.push({
					fileName,
					fileSize: 0,
					fileType: this.guessFileType(fileName),
					attachmentType: "file",
					status: {
						processed: false,
						found: false,
					},
				});
			}
		}

		return attachments;
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

