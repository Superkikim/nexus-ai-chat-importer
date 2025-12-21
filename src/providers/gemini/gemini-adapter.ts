import type { StandardConversation } from "../../types/standard";
import type { ReportNamingStrategy } from "../../types/standard";
import type NexusAiChatImporterPlugin from "../../main";
import { BaseProviderAdapter, AttachmentExtractor } from "../base/base-provider-adapter";
import { GeminiConverter } from "./gemini-converter";
import { GeminiAttachmentExtractor } from "./gemini-attachment-extractor";
import { GeminiReportNamingStrategy } from "./gemini-report-naming";
import type { GeminiActivityEntry } from "./gemini-types";

/**
 * Provider adapter for Google Gemini (Takeout My Activity) exports
 */
export class GeminiAdapter extends BaseProviderAdapter<GeminiActivityEntry> {
	private converter: GeminiConverter;
	private attachmentExtractor: GeminiAttachmentExtractor;
	private reportNamingStrategy: GeminiReportNamingStrategy;

	constructor(private plugin: NexusAiChatImporterPlugin) {
		super();
		this.converter = new GeminiConverter();
		this.attachmentExtractor = new GeminiAttachmentExtractor(plugin);
		this.reportNamingStrategy = new GeminiReportNamingStrategy();
	}

	/**
	 * Detect if raw conversations are Gemini activity entries
	 */
	detect(rawConversations: any[]): boolean {
		if (!Array.isArray(rawConversations) || rawConversations.length === 0) {
			return false;
		}

		const sample = rawConversations[0];

		// Check for Gemini activity entry structure
		return (
			typeof sample === "object" &&
			typeof sample.header === "string" &&
			typeof sample.title === "string" &&
			typeof sample.time === "string" &&
			(Array.isArray(sample.safeHtmlItem) ||
				Array.isArray(sample.activityControls) ||
				Array.isArray(sample.products))
		);
	}

	/**
	 * Get conversation ID
	 */
	getId(chat: GeminiActivityEntry): string {
		return this.converter["generateId"](chat);
	}

	/**
	 * Get conversation title
	 */
	getTitle(chat: GeminiActivityEntry): string {
		return this.converter["extractTitle"](chat);
	}

	/**
	 * Get creation timestamp
	 */
	getCreateTime(chat: GeminiActivityEntry): number {
		return this.converter["parseTimestamp"](chat.time);
	}

	/**
	 * Get update timestamp (same as create for Gemini)
	 */
	getUpdateTime(chat: GeminiActivityEntry): number {
		return this.getCreateTime(chat);
	}

	/**
	 * Convert Gemini entry to StandardConversation
	 */
	convertChat(chat: GeminiActivityEntry): StandardConversation {
		return this.converter.convertEntry(chat);
	}

	/**
	 * Get provider name
	 */
	getProviderName(): string {
		return "gemini";
	}

	/**
	 * Get new messages (for Gemini, each entry is atomic)
	 */
	getNewMessages(chat: GeminiActivityEntry, existingMessageIds: string[]): any[] {
		// For Gemini, each activity entry is a complete conversation
		// If any message ID exists, the whole conversation is considered existing
		const conversationId = this.getId(chat);
		const userMessageId = `${conversationId}-user`;
		const assistantMessageId = `${conversationId}-assistant`;

		if (
			existingMessageIds.includes(userMessageId) ||
			existingMessageIds.includes(assistantMessageId)
		) {
			return []; // No new messages
		}

		return [chat]; // Entire entry is new
	}

	/**
	 * Get report naming strategy
	 */
	getReportNamingStrategy(): ReportNamingStrategy {
		return this.reportNamingStrategy;
	}

	/**
	 * Get attachment extractor
	 */
	protected getAttachmentExtractor(): AttachmentExtractor {
		return this.attachmentExtractor;
	}
}

