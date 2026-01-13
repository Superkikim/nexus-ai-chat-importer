/**
 * Types for Google Gemini (Takeout My Activity) exports
 */

/**
 * A single activity entry from Google Takeout My Activity JSON for Gemini Apps
 */
export interface GeminiActivityEntry {
	/**
	 * Header text (e.g., "Gemini Apps")
	 */
	header: string;

	/**
	 * Title of the activity (often the user's prompt/question)
	 */
	title: string;

	/**
	 * ISO 8601 timestamp string
	 */
	time: string;

	/**
	 * HTML content items (typically the assistant's response)
	 */
	safeHtmlItem?: Array<{
		html: string;
	}>;

	/**
	 * Subtitles (additional metadata)
	 */
	subtitles?: Array<{
		name: string;
		url?: string;
	}>;

	/**
	 * List of attached file names (images, documents, etc.)
	 */
	attachedFiles?: string[];

	/**
	 * User-uploaded image file name (if any)
	 */
	imageFile?: string;

	/**
	 * Google products associated with this activity
	 */
	products?: string[];

	/**
	 * Activity controls metadata
	 */
	activityControls?: string[];

	/**
	 * Location information (if available)
	 */
	locationInfos?: any[];

	/**
	 * Details array (additional structured data)
	 */
	details?: Array<{
		name: string;
	}>;
}

