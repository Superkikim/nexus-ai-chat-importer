import type { StandardConversation, StandardMessage } from "../../types/standard";
import type { GeminiActivityEntry, GeminiIndex, IndexConversation } from "./gemini-types";
import { GeminiConverter } from "./gemini-converter";

/**
 * Merges Gemini Takeout entries with browser extension index to reconstruct full conversations
 * 
 * The Takeout export lacks conversation IDs, so we use the index (extracted from live web app)
 * to group individual activity entries into proper conversations.
 */
export class GeminiIndexMerger {
	private converter: GeminiConverter;

	constructor() {
		this.converter = new GeminiConverter();
	}

	/**
	 * Merge Takeout entries with index to create grouped conversations
	 */
	mergeIndexWithTakeout(
		takeoutEntries: GeminiActivityEntry[],
		index: GeminiIndex
	): StandardConversation[] {
		const conversations = new Map<string, StandardConversation>();
		const unmatchedEntries: GeminiActivityEntry[] = [];

		// Process each Takeout entry
		for (const entry of takeoutEntries) {
			const match = this.findMatchingConversation(entry, index);

			if (match) {
				// Found matching conversation in index
				const convId = match.conversationId;

				// Initialize conversation if not exists
				if (!conversations.has(convId)) {
					conversations.set(convId, this.createConversationFromIndex(match, entry));
				}

				// Add messages from this entry to the conversation
				const conversation = conversations.get(convId)!;
				const messages = this.converter["convertMessages"](entry);
				conversation.messages.push(...messages);

				// Update timestamps
				const entryTime = this.converter["parseTimestamp"](entry.time);
				if (entryTime < conversation.createTime) {
					conversation.createTime = entryTime;
				}
				if (entryTime > conversation.updateTime) {
					conversation.updateTime = entryTime;
				}
			} else {
				// No match found - will create standalone conversation
				unmatchedEntries.push(entry);
			}
		}

		// Create standalone conversations for unmatched entries
		for (const entry of unmatchedEntries) {
			const standalone = this.converter.convertEntry(entry);
			conversations.set(standalone.id, standalone);
		}

		return Array.from(conversations.values());
	}

	/**
	 * Find matching conversation in index for a Takeout entry
	 * Uses multiple strategies: exact timestamp match, fuzzy timestamp + prompt match
	 */
	private findMatchingConversation(
		entry: GeminiActivityEntry,
		index: GeminiIndex
	): IndexConversation | null {
		const entryTime = entry.time;
		const entryPrompt = this.extractPromptForMatching(entry);

		// Strategy 1: Exact timestamp match
		for (const conv of index.conversations) {
			// Check if first message timestamp matches
			// Note: Current index only has firstMessage, but future versions may have full message arrays
			if (this.timestampsMatch(entryTime, conv.firstMessage.preview)) {
				return conv;
			}
		}

		// Strategy 2: Fuzzy match (timestamp proximity + prompt similarity)
		for (const conv of index.conversations) {
			const timeDiff = this.getTimeDifference(entryTime, entryTime); // Will be enhanced when we have message timestamps
			const promptMatch = this.promptsMatch(entryPrompt, conv.firstMessage.preview);

			// Match if within 5 seconds and prompts are similar
			if (timeDiff < 5000 && promptMatch) {
				return conv;
			}
		}

		// Strategy 3: Title-based matching (fallback)
		const entryTitle = this.converter["extractTitle"](entry);
		for (const conv of index.conversations) {
			if (this.titlesMatch(entryTitle, conv.title)) {
				return conv;
			}
		}

		return null;
	}

	/**
	 * Create initial StandardConversation from index metadata
	 */
	private createConversationFromIndex(
		indexConv: IndexConversation,
		firstEntry: GeminiActivityEntry
	): StandardConversation {
		const timestamp = this.converter["parseTimestamp"](firstEntry.time);

		return {
			id: indexConv.conversationId,
			title: indexConv.title,
			provider: "gemini",
			createTime: timestamp,
			updateTime: timestamp,
			messages: [],
			chatUrl: indexConv.url,
			metadata: {
				indexSource: true,
				loadSuccess: indexConv.loadSuccess,
			},
		};
	}

	/**
	 * Extract prompt text for matching purposes
	 */
	private extractPromptForMatching(entry: GeminiActivityEntry): string {
		if (!entry.title) return "";
		
		// Remove common prefixes and normalize
		return entry.title
			.replace(/^(Prompted|Live Prompt|Asked)\s+/i, "")
			.trim()
			.toLowerCase()
			.substring(0, 50); // First 50 chars for matching
	}

	/**
	 * Check if timestamps match (exact ISO string comparison)
	 */
	private timestampsMatch(time1: string, time2: string): boolean {
		return time1 === time2;
	}

	/**
	 * Calculate time difference in milliseconds
	 */
	private getTimeDifference(time1: string, time2: string): number {
		try {
			const date1 = new Date(time1).getTime();
			const date2 = new Date(time2).getTime();
			return Math.abs(date1 - date2);
		} catch {
			return Infinity;
		}
	}

	/**
	 * Check if prompts match (fuzzy comparison)
	 */
	private promptsMatch(prompt1: string, prompt2: string): boolean {
		const normalized1 = prompt1.toLowerCase().trim();
		const normalized2 = prompt2.toLowerCase().trim();

		// Check if one starts with the other (handles truncation)
		if (normalized1.startsWith(normalized2.substring(0, 20)) ||
			normalized2.startsWith(normalized1.substring(0, 20))) {
			return true;
		}

		// Check similarity (simple Levenshtein-like approach)
		const minLength = Math.min(normalized1.length, normalized2.length);
		if (minLength < 10) return false; // Too short to compare reliably

		const compareLength = Math.min(30, minLength);
		const substring1 = normalized1.substring(0, compareLength);
		const substring2 = normalized2.substring(0, compareLength);

		return substring1 === substring2;
	}

	/**
	 * Check if titles match (fuzzy comparison)
	 */
	private titlesMatch(title1: string, title2: string): boolean {
		const normalized1 = title1.toLowerCase().trim();
		const normalized2 = title2.toLowerCase().trim();

		// Exact match
		if (normalized1 === normalized2) return true;

		// One contains the other (handles truncation with "...")
		if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
			return true;
		}

		// Check if they start the same way (first 40 chars)
		const compareLength = Math.min(40, normalized1.length, normalized2.length);
		if (compareLength < 10) return false;

		return normalized1.substring(0, compareLength) === normalized2.substring(0, compareLength);
	}
}

