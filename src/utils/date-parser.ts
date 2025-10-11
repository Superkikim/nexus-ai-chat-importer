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

/**
 * Date format information
 */
export interface DateFormatInfo {
    separator: '/' | '-' | '.';
    order: 'YMD' | 'DMY' | 'MDY';
    timeFormat: '12h' | '24h';
    timeSeparator: string; // ' at ' or ' '
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
     */
    static parseDate(dateStr: string): number {
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
                console.warn(`Could not detect date format: ${dateStr}`);
                return 0;
            }

            const parsed = this.parseWithFormat(dateStr, format);
            if (parsed === 0) {
                console.warn(`Could not parse date: ${dateStr}`);
            }
            
            return parsed;

        } catch (error) {
            console.warn(`Date parsing error for "${dateStr}":`, error);
            return 0;
        }
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
                timeSeparator: dateStr.includes('T') ? 'T' : ' ',
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

        // Determine time separator
        const timeSeparator = dateStr.includes(' at ') ? ' at ' : ' ';

        // Check if has seconds
        const timePart = dateStr.split(timeSeparator)[1] || '';
        const hasSeconds = timePart.split(':').length >= 3;

        // Extract date part (before time)
        const datePart = dateStr.split(/\s/)[0];
        const parts = datePart.split(separator).map(p => parseInt(p, 10));

        if (parts.length !== 3 || parts.some(isNaN)) {
            return null;
        }

        // Detect order (YMD, DMY, MDY)
        const order = this.detectOrder(parts, separator);

        return {
            separator,
            order,
            timeFormat,
            timeSeparator,
            hasSeconds
        };
    }

    /**
     * Detect date component order (YMD, DMY, MDY)
     */
    private static detectOrder(parts: number[], separator: string): 'YMD' | 'DMY' | 'MDY' {
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
            // Ambiguous (both ≤ 12), use separator as hint
            if (separator === '.') {
                return 'DMY'; // German format
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

        // Ambiguous - use separator as hint
        if (separator === '-') {
            return 'YMD'; // ISO-like
        } else if (separator === '.') {
            return 'DMY'; // German
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

        // Handle ISO 8601 'T' separator
        const separator = format.timeSeparator === 'T' ? '[T]' : format.timeSeparator;
        const fullPattern = `${datePattern}${separator}${timePattern}`;

        const date = moment(dateStr, fullPattern, true);

        if (!date.isValid()) {
            // Try without seconds as fallback
            if (format.hasSeconds) {
                const timePatternNoSec = format.timeFormat === '12h' ? 'h:mm A' : 'HH:mm';
                const fallbackPattern = `${datePattern}${separator}${timePatternNoSec}`;
                const fallbackDate = moment(dateStr, fallbackPattern, true);
                
                if (fallbackDate.isValid()) {
                    return fallbackDate.unix();
                }
            }
            return 0;
        }

        return date.unix();
    }

    /**
     * Convert any date format to ISO 8601
     * Returns ISO 8601 string or null if parsing fails
     */
    static convertToISO8601(dateStr: string): string | null {
        const unixTime = this.parseDate(dateStr);
        if (unixTime === 0) {
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

