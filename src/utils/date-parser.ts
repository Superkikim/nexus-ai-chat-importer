/**
 * Nexus AI Chat Importer - Obsidian Plugin
 * Copyright (C) 2024 Akim Sissaoui
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

// src/utils/date-parser.ts
import { moment } from "obsidian";
import { logger } from "../logger";

/**
 * Date format information
 */
export interface DateFormatInfo {
    separator: '/' | '-' | '.';
    order: 'YMD' | 'DMY' | 'MDY';
    timeFormat: '12h' | '24h';
    hasSeconds: boolean;
}

/**
 * Intelligent date format detector and parser
 * Supports all formats: ISO, US, EU, DE, JP, and locale-based formats
 */
export class DateParser {

    /**
     * Parse a date string with automatic format detection
     * Returns Unix timestamp (seconds) or 0 if parsing fails
     * @param dateStr - Date string to parse
     * @param contextId - Optional context identifier for logging (e.g., "Artifact abc123_v1", "Conversation xyz")
     */
    static parseDate(dateStr: string, contextId?: string): number {
        const ctx = contextId ? `[${contextId}] ` : '';

        if (!dateStr || typeof dateStr !== 'string') {
            return 0;
        }

        try {
            // Try ISO 8601 first (fastest and most common in v1.3.0+)
            const isoDate = moment(dateStr, moment.ISO_8601, true);
            if (isoDate.isValid()) {
                return isoDate.unix();
            }

            // Detect format and parse
            const format = this.detectFormat(dateStr);
            if (!format) {
                logger.warn(`${ctx}parseDate - FAILED: could not detect format`);
                return 0;
            }

            const parsed = this.parseWithFormat(dateStr, format);
            if (parsed === 0) {
                logger.warn(`${ctx}parseDate - FAILED: parsing returned 0`);
            }

            return parsed;

        } catch (error) {
            logger.warn(`${ctx}parseDate - FAILED: exception:`, error);
            return 0;
        }
    }

    /**
     * Parse a date string with a forced component order (YMD/DMY/MDY)
     * Keeps other parts auto-detected from the string (separator, time format, seconds)
     */
    static parseDateWithOrder(dateStr: string, order: 'YMD'|'DMY'|'MDY'): number {
        if (!dateStr || typeof dateStr !== 'string') return 0;

        // If ISO, short-circuit
        const isoDate = moment(dateStr, moment.ISO_8601, true);
        if (isoDate.isValid()) return isoDate.unix();

        // Start from auto-detected format and override order
        const detected = this.detectFormat(dateStr);
        if (!detected) return 0;
        const forced: DateFormatInfo = { ...detected, order };
        return this.parseWithFormat(dateStr, forced);
    }

    /**
     * Convert a date string to ISO 8601 with a forced component order
     */
    static convertToISO8601WithOrder(dateStr: string, order: 'YMD'|'DMY'|'MDY'): string | null {
        const unixTime = this.parseDateWithOrder(dateStr, order);
        if (unixTime === 0) return null;
        return new Date(unixTime * 1000).toISOString();
    }

    /**
     * Detect date format from a single date string
     */
    static detectFormat(dateStr: string): DateFormatInfo | null {
        // Check for ISO 8601 format first
        if (dateStr.match(/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?(\.\d{3})?Z?$/)) {
            return {
                separator: '-',
                order: 'YMD',
                timeFormat: '24h',
                hasSeconds: dateStr.includes(':') && dateStr.split(':').length >= 3
            };
        }

        // Determine separator
        let separator: '/' | '-' | '.' = '/';
        if (dateStr.includes('-') && !dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
            separator = '-';
        } else if (dateStr.includes('.')) {
            separator = '.';
        } else if (dateStr.includes('/')) {
            separator = '/';
        } else {
            return null; // No recognizable separator
        }

        // Determine time format (12h with AM/PM or 24h)
        const hasAMPM = /\s(AM|PM)$/i.test(dateStr);
        const timeFormat: '12h' | '24h' = hasAMPM ? '12h' : '24h';

        // Check if has seconds (extract time part after any whitespace)
        const timeMatch = dateStr.match(/\s(\d{1,2}:\d{2}(?::\d{2})?(?:\s?[AP]M)?)/i);
        const timePart = timeMatch ? timeMatch[1] : '';
        const hasSeconds = timePart.split(':').length >= 3;

        // Extract date part (before time)
        const datePart = dateStr.split(/\s/)[0];
        const parts = datePart.split(separator).map(p => parseInt(p, 10));

        if (parts.length !== 3 || parts.some(isNaN)) {
            return null;
        }

        // Detect order (YMD, DMY, MDY) - now with AM/PM hint
        const order = this.detectOrder(parts, separator, hasAMPM);

        return {
            separator,
            order,
            timeFormat,
            hasSeconds
        };
    }

    /**
     * Detect date component order (YMD, DMY, MDY)
     * @param parts - Date parts [first, second, third]
     * @param separator - Date separator ('/', '-', '.')
     * @param hasAMPM - Whether the time uses AM/PM format (hint for US format)
     */
    private static detectOrder(parts: number[], separator: string, hasAMPM: boolean): 'YMD' | 'DMY' | 'MDY' {
        const [first, second, third] = parts;

        // RULE 1: If first > 31 → Year first → YMD
        if (first > 31) {
            return 'YMD'; // 2024/06/28 or 2024-06-28
        }

        // RULE 2: If third > 31 → Year last → DMY or MDY
        if (third > 31) {
            // If first > 12 → Day first → DMY
            if (first > 12) {
                return 'DMY'; // 28/06/2024
            }
            // If second > 12 → Day second → MDY
            if (second > 12) {
                return 'MDY'; // 06/28/2024
            }
            // Ambiguous (both ≤ 12), use hints
            if (separator === '.') {
                return 'DMY'; // German format
            }
            if (hasAMPM) {
                return 'MDY'; // US format (most common with 12h)
            }
            // Default to DMY (more common internationally)
            return 'DMY';
        }

        // RULE 3: If first > 12 → Day first → DMY
        if (first > 12) {
            return 'DMY'; // 28/06/2024
        }

        // RULE 4: If second > 12 → Day second → MDY
        if (second > 12) {
            return 'MDY'; // 06/28/2024
        }

        // Ambiguous - use hints
        if (separator === '-') {
            return 'YMD'; // ISO-like
        } else if (separator === '.') {
            return 'DMY'; // German
        } else if (hasAMPM) {
            return 'MDY'; // US format (most common with 12h)
        }

        // Default to DMY (European format more common)
        return 'DMY';
    }

    /**
     * Parse date string with detected format
     */
    private static parseWithFormat(dateStr: string, format: DateFormatInfo): number {
        // Build moment.js format string
        let datePattern: string;

        switch (format.order) {
            case 'YMD':
                datePattern = format.separator === '-' ? 'YYYY-MM-DD' : 'YYYY/MM/DD';
                break;
            case 'DMY':
                datePattern = format.separator === '.' ? 'DD.MM.YYYY' : 'DD/MM/YYYY';
                break;
            case 'MDY':
                datePattern = 'MM/DD/YYYY';
                break;
        }

        const timePattern = format.timeFormat === '12h'
            ? (format.hasSeconds ? 'h:mm:ss A' : 'h:mm A')
            : (format.hasSeconds ? 'HH:mm:ss' : 'HH:mm');

        // Auto-detect time separator (space, 'T', or ' at ')
        // We don't store it anymore - just try common patterns
        const patterns = [
            `${datePattern} ${timePattern}`,      // Standard space
            `${datePattern}[T]${timePattern}`,    // ISO 8601 T
            `${datePattern}[ at ]${timePattern}`  // English "at"
        ];

        for (const pattern of patterns) {
            const date = moment(dateStr, pattern, true);
            if (date.isValid()) {
                return date.unix();
            }
        }

        // Try without seconds as fallback
        if (format.hasSeconds) {
            const timePatternNoSec = format.timeFormat === '12h' ? 'h:mm A' : 'HH:mm';
            const fallbackPatterns = [
                `${datePattern} ${timePatternNoSec}`,
                `${datePattern}[T]${timePatternNoSec}`,
                `${datePattern}[ at ]${timePatternNoSec}`
            ];

            for (const pattern of fallbackPatterns) {
                const date = moment(dateStr, pattern, true);
                if (date.isValid()) {
                    return date.unix();
                }
            }
        }

        return 0;
    }

    /**
     * Convert any date format to ISO 8601
     * Returns ISO 8601 string or null if parsing fails
     */
    static convertToISO8601(dateStr: string): string | null {
        const unixTime = this.parseDate(dateStr);
        if (unixTime === 0) {
            logger.warn(`convertToISO8601 - parsing returned 0`);
            return null;
        }

        // Convert to ISO 8601 with milliseconds
        return new Date(unixTime * 1000).toISOString();
    }

    /**
     * Detect format from multiple date samples (more reliable)
     * Used for batch processing (e.g., upgrade operations)
     */
    static detectFormatFromSamples(dates: string[]): DateFormatInfo | null {
        if (!dates || dates.length === 0) {
            return null;
        }

        // Try to detect from each sample until we find a decisive one
        for (const dateStr of dates.slice(0, 20)) { // Check up to 20 samples
            const format = this.detectFormat(dateStr);
            if (format) {
                // Verify it's not ambiguous by checking if we have values > 12
                const datePart = dateStr.split(/\s/)[0];
                const parts = datePart.split(format.separator).map(p => parseInt(p, 10));
                
                // If we have a decisive value (> 12 or > 31), use this format
                if (parts.some(p => p > 12)) {
                    return format;
                }
            }
        }

        // If all samples are ambiguous, return the first detected format
        return this.detectFormat(dates[0]);
    }
}

