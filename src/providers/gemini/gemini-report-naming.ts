import type { ReportNamingStrategy } from "../../types/standard";
import type { ProviderAdapter } from "../provider-adapter";
import type { GeminiActivityEntry } from "./gemini-types";

/**
 * Report naming strategy for Gemini imports
 */
export class GeminiReportNamingStrategy implements ReportNamingStrategy {
	extractReportPrefix(zipFileName: string): string {
		// Gemini Takeout files are named like: takeout-20251206T211947Z-3-001.zip
		// Extract the date part: 20251206 -> 2025.12.06

		const match = zipFileName.match(/takeout-(\d{8})/i);
		if (match) {
			const dateStr = match[1]; // e.g., "20251206"
			const year = dateStr.substring(0, 4);
			const month = dateStr.substring(4, 6);
			const day = dateStr.substring(6, 8);
			return `${year}.${month}.${day}`;
		}

		// Fallback to current date
		return this.getCurrentImportDate();
	}

	getProviderName(): string {
		return "gemini";
	}

	getProviderSpecificColumn(): {
		header: string;
		getValue: (adapter: ProviderAdapter, chat: any) => number;
	} {
		return {
			header: "Attachments",
			getValue: (adapter: ProviderAdapter, chat: GeminiActivityEntry) => {
				return chat.attachedFiles?.length || 0;
			},
		};
	}

	/**
	 * Get current date in YYYY.MM.DD format
	 */
	private getCurrentImportDate(): string {
		const now = new Date();
		const year = now.getFullYear();
		const month = String(now.getMonth() + 1).padStart(2, "0");
		const day = String(now.getDate()).padStart(2, "0");
		return `${year}.${month}.${day}`;
	}
}

