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


// src/utils/report-naming-utils.ts

/**
 * Get current date in standardized format for import reports
 * 
 * @returns Date string in format YYYY.MM.DD
 * 
 * @example
 * getCurrentImportDate() // "2025.04.25"
 */
export function getCurrentImportDate(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}.${month}.${day}`;
}

/**
 * Extract archive date from filename using provided regex patterns
 * 
 * @param fileName - Name of the ZIP file
 * @param patterns - Array of regex patterns to try (in order)
 * @returns Date string in format YYYY.MM.DD, or null if no match
 * 
 * @example
 * const patterns = [/(\d{4})-(\d{2})-(\d{2})/];
 * extractArchiveDateFromFilename("export-2025-04-25.zip", patterns)
 * // Returns: "2025.04.25"
 */
export function extractArchiveDateFromFilename(
    fileName: string,
    patterns: RegExp[]
): string | null {
    for (const pattern of patterns) {
        const match = fileName.match(pattern);
        if (match && match.length >= 4) {
            const [, year, month, day] = match;
            return `${year}.${month}.${day}`;
        }
    }
    return null;
}

/**
 * Generate standardized report prefix
 * Format: imported-YYYY.MM.DD-archive-YYYY.MM.DD
 * 
 * @param importDate - Date of import in YYYY.MM.DD format
 * @param archiveDate - Date from archive filename in YYYY.MM.DD format
 * @returns Report prefix string
 * 
 * @example
 * generateReportPrefix("2025.04.25", "2025.04.20")
 * // Returns: "imported-2025.04.25-archive-2025.04.20"
 */
export function generateReportPrefix(
    importDate: string,
    archiveDate: string
): string {
    return `imported-${importDate}-archive-${archiveDate}`;
}

/**
 * Extract report prefix from ZIP filename using patterns
 * This is the main function used by ReportNamingStrategy implementations
 * 
 * @param zipFileName - Name of the ZIP file
 * @param patterns - Array of regex patterns to try for date extraction
 * @returns Report prefix in format "imported-YYYY.MM.DD-archive-YYYY.MM.DD"
 * 
 * @example
 * const patterns = [/(\d{4})-(\d{2})-(\d{2})/];
 * extractReportPrefixFromZip("export-2025-04-25.zip", patterns)
 * // Returns: "imported-2025.04.25-archive-2025.04.25"
 */
export function extractReportPrefixFromZip(
    zipFileName: string,
    patterns: RegExp[]
): string {
    const importDate = getCurrentImportDate();
    const archiveDate = extractArchiveDateFromFilename(zipFileName, patterns);
    
    // Use import date as fallback if no archive date found
    const finalArchiveDate = archiveDate || importDate;
    
    return generateReportPrefix(importDate, finalArchiveDate);
}

