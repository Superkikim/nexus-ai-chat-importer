import type { StandardConversation } from "../../types/standard";
import type { ReportNamingStrategy } from "../../types/standard";
import type NexusAiChatImporterPlugin from "../../main";
import { BaseProviderAdapter, AttachmentExtractor } from "../base/base-provider-adapter";
import { GeminiConverter } from "./gemini-converter";
import { GeminiAttachmentExtractor } from "./gemini-attachment-extractor";
import { GeminiReportNamingStrategy } from "./gemini-report-naming";
import { GeminiIndexMerger } from "./gemini-index-merger";
import type { GeminiActivityEntry, GeminiIndex } from "./gemini-types";

/**
 * Provider adapter for Google Gemini (Takeout My Activity) exports
 *
 * Supports two modes:
 * 1. Without index: Each Takeout entry becomes a standalone conversation (1 prompt + 1 response)
 * 2. With index: Entries are grouped into full conversations using browser extension index
 */
export class GeminiAdapter extends BaseProviderAdapter<GeminiActivityEntry> {
	private converter: GeminiConverter;
	private attachmentExtractor: GeminiAttachmentExtractor;
	private reportNamingStrategy: GeminiReportNamingStrategy;
	private indexMerger: GeminiIndexMerger;
	private geminiIndex: GeminiIndex | null = null;

	constructor(private plugin: NexusAiChatImporterPlugin) {
		super();
		this.converter = new GeminiConverter();
		this.attachmentExtractor = new GeminiAttachmentExtractor(plugin);
		this.reportNamingStrategy = new GeminiReportNamingStrategy();
		this.indexMerger = new GeminiIndexMerger();
	}

	/**
	 * Set the Gemini index for conversation reconstruction
	 * Must be called before processing if index-based grouping is desired
	 */
	setIndex(index: GeminiIndex | null): void {
		this.geminiIndex = index;
	}

	/**
	 * Get the current index (if any)
	 */
	getIndex(): GeminiIndex | null {
		return this.geminiIndex;
	}

	/**
	 * Check if adapter is in index mode
	 */
	hasIndex(): boolean {
		return this.geminiIndex !== null;
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
	 *
	 * Note: When index is set, this returns a standalone conversation for this single entry.
	 * Use convertAllWithIndex() to get properly grouped conversations.
	 */
	convertChat(chat: GeminiActivityEntry): StandardConversation {
		return this.converter.convertEntry(chat);
	}

	/**
	 * Convert all Takeout entries to StandardConversations
	 *
	 * If index is set, entries are grouped into full conversations.
	 * Otherwise, each entry becomes a standalone conversation.
	 *
	 * @param entries - All Takeout entries to convert
	 * @returns Array of StandardConversations (grouped if index available)
	 */
	convertAllWithIndex(entries: GeminiActivityEntry[]): StandardConversation[] {
		if (this.geminiIndex) {
			// Index mode: group entries into conversations
			return this.indexMerger.mergeIndexWithTakeout(entries, this.geminiIndex);
		} else {
			// Fallback mode: each entry is a standalone conversation
			return entries.map(entry => this.converter.convertEntry(entry));
		}
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

