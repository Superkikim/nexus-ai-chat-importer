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
			// If the index provides per-message hashes, use them as the primary
			// source of truth to reconstruct full conversations in DOM order.
			const hasHashedMessages = index.conversations.some(
				(conv) => Array.isArray(conv.messages) && conv.messages.length > 0
			);
			if (hasHashedMessages) {
				return this.mergeUsingMessageHashes(takeoutEntries, index);
			}

			// Fallback path for older index versions without detailed message hashes:
			// group entries by matching them to conversations using heuristics.
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
		 * Robust reconstruction when the index provides per-message hashes.
		 *
		 * Strategy:
		 *   1. For every Takeout entry, compute the curated prompt hash
		 *      (same logic as the extension) and build a hash -> entries map.
		 *   2. For each conversation in the index, walk its messages[] in order
		 *      and, for each messageHash, pick the corresponding Takeout entry.
		 *   3. Convert those entries to StandardMessages and append them to a
		 *      single StandardConversation, preserving the DOM order from the index.
		 *   4. Any Takeout entries that were not consumed are turned into
		 *      standalone conversations.
		 */
		private mergeUsingMessageHashes(
			takeoutEntries: GeminiActivityEntry[],
			index: GeminiIndex
		): StandardConversation[] {
			// Build hash -> queue of Takeout entries
			const hashToEntries = new Map<string, GeminiActivityEntry[]>();
			for (const entry of takeoutEntries) {
				const hash = this.converter.computeUserPromptHash(entry);
				if (!hash) continue;
				let list = hashToEntries.get(hash);
				if (!list) {
					list = [];
					hashToEntries.set(hash, list);
				}
				list.push(entry);
			}

			const usedEntries = new Set<GeminiActivityEntry>();
			const groupedConversations: StandardConversation[] = [];

			for (const indexConv of index.conversations) {
				if (!indexConv.messages || indexConv.messages.length === 0) {
					continue;
				}

				const entriesForConversation: GeminiActivityEntry[] = [];

				for (const msg of indexConv.messages) {
					const candidates = hashToEntries.get(msg.messageHash);
					if (!candidates || candidates.length === 0) {
						continue;
					}

					// Take the first unused entry for this hash
					let chosen: GeminiActivityEntry | undefined;
					for (let i = 0; i < candidates.length; i++) {
						const candidate = candidates[i];
						if (!usedEntries.has(candidate)) {
							chosen = candidate;
							candidates.splice(i, 1);
							break;
						}
					}

					if (!chosen) {
						continue;
					}

					usedEntries.add(chosen);
					entriesForConversation.push(chosen);
				}

				if (entriesForConversation.length === 0) {
					continue;
				}

				// Create conversation seeded with the first matched entry
				const firstEntry = entriesForConversation[0];
				const conversation = this.createConversationFromIndex(indexConv, firstEntry);

				for (const entry of entriesForConversation) {
					const messages = this.converter["convertMessages"](entry);
					conversation.messages.push(...messages);

					const entryTime = this.converter["parseTimestamp"](entry.time);
					if (entryTime < conversation.createTime) {
						conversation.createTime = entryTime;
					}
					if (entryTime > conversation.updateTime) {
						conversation.updateTime = entryTime;
					}
				}

				groupedConversations.push(conversation);
			}

			// Any Takeout entries that didn't match the index hashes become standalone
			for (const entry of takeoutEntries) {
				if (usedEntries.has(entry)) continue;
				groupedConversations.push(this.converter.convertEntry(entry));
			}

			return groupedConversations;
		}

		/**
		 * Find matching conversation in index for a Takeout entry.
		 *
		 * New primary strategy (robust):
		 *   - Compute a SHA-256 hash of the curated user prompt from Takeout
		 *   - Look for the same hash in index.conversations[*].messages[*].messageHash
		 *
		 * Legacy fallback (when index has no hashes yet):
		 *   - Use heuristic title/prompt matching as before.
		 */
		private findMatchingConversation(
			entry: GeminiActivityEntry,
			index: GeminiIndex
		): IndexConversation | null {
			// Preferred path: hash-based matching when the index provides detailed messages
			const hashedMatch = this.findByMessageHash(entry, index);
			if (hashedMatch) {
				return hashedMatch;
			}

			// Fallback for older index versions: use legacy fuzzy matching
			return this.findByHeuristics(entry, index);
		}

		/**
		 * Robust matching using message hashes from the index.
		 */
		private findByMessageHash(
			entry: GeminiActivityEntry,
			index: GeminiIndex
		): IndexConversation | null {
			// If the index doesn't have detailed messages yet, we can't use this strategy
			const hasHashedMessages = index.conversations.some((conv) => Array.isArray(conv.messages) && conv.messages.length > 0);
			if (!hasHashedMessages) {
				return null;
			}

			const hash = this.converter.computeUserPromptHash(entry);

			for (const conv of index.conversations) {
				if (!conv.messages) continue;

				for (const msg of conv.messages) {
					if (msg.messageHash === hash) {
						return conv;
					}
				}
			}

			return null;
		}

		/**
		 * Legacy heuristic-based matching, kept as a fallback for compatibility
		 * with older index exports that don't include message hashes.
		 */
		private findByHeuristics(
			entry: GeminiActivityEntry,
			index: GeminiIndex
		): IndexConversation | null {
			const entryTime = entry.time;
			const entryPrompt = this.extractPromptForMatching(entry);

			// Strategy 1: Title-based matching (primary heuristic)
			const entryTitle = this.converter["extractTitle"](entry);
			for (const conv of index.conversations) {
				if (this.titlesMatch(entryTitle, conv.title)) {
					return conv;
				}
			}

			// Strategy 2: Fuzzy prompt match against first message preview
			for (const conv of index.conversations) {
				const promptMatch = this.promptsMatch(entryPrompt, conv.firstMessage.preview);
				if (promptMatch) {
					return conv;
				}
			}

			// Strategy 3: Timestamp proximity (very weak signal, last resort)
			for (const conv of index.conversations) {
				const timeDiff = this.getTimeDifference(entryTime, entryTime); // Placeholder: no timestamps in legacy index
				if (timeDiff < 5000) {
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
			
			// Keep logic in sync with GeminiConverter.stripPromptPrefix
			const cleaned = entry.title
				.replace(/^(Prompted|Live Prompt|Asked)\s+/i, "")
				.replace(/^Prompt\s*:?\s+/i, "");

			return cleaned
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

