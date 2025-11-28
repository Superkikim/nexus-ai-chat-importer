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


// src/utils/report-naming-utils.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
    getCurrentImportDate,
    extractArchiveDateFromFilename,
    generateReportPrefix,
    extractReportPrefixFromZip
} from './report-naming-utils';

describe('getCurrentImportDate', () => {
    beforeEach(() => {
        // Reset date mocks before each test
        vi.useRealTimers();
    });

    it('should return current date in YYYY.MM.DD format', () => {
        // Mock a specific date: 2025-04-25 14:30:00
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2025-04-25T14:30:00Z'));

        const result = getCurrentImportDate();
        expect(result).toBe('2025.04.25');

        vi.useRealTimers();
    });

    it('should pad single-digit months and days with zero', () => {
        // Mock date: 2025-01-05
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2025-01-05T10:00:00Z'));

        const result = getCurrentImportDate();
        expect(result).toBe('2025.01.05');

        vi.useRealTimers();
    });

    it('should handle end of year correctly', () => {
        // Mock date: 2024-12-31 (use local time to avoid timezone issues)
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2024, 11, 31, 12, 0, 0)); // Month is 0-indexed

        const result = getCurrentImportDate();
        expect(result).toBe('2024.12.31');

        vi.useRealTimers();
    });
});

describe('extractArchiveDateFromFilename', () => {
    it('should extract date from filename with YYYY-MM-DD pattern', () => {
        const patterns = [/(\d{4})-(\d{2})-(\d{2})/];
        const fileName = 'chatgpt-export-2025-04-25.zip';

        const result = extractArchiveDateFromFilename(fileName, patterns);
        expect(result).toBe('2025.04.25');
    });

    it('should extract date from complex ChatGPT filename', () => {
        const patterns = [/(\d{4})-(\d{2})-(\d{2})/];
        const fileName = '3b00abafb9222a9580aa7cbb198166ed0c61634222cce9571bb079a2886aeed5-2025-04-25-14-40-42-ff19c2fd898d44d9bc5945ee80c199ca.zip';

        const result = extractArchiveDateFromFilename(fileName, patterns);
        expect(result).toBe('2025.04.25');
    });

    it('should extract date from Claude batch filename', () => {
        const patterns = [
            /data-(\d{4})-(\d{2})-(\d{2})-\d{2}-\d{2}-\d{2}-batch-\d{4}/,
            /(\d{4})-(\d{2})-(\d{2})/
        ];
        const fileName = 'data-2025-04-20-10-30-45-batch-0001.zip';

        const result = extractArchiveDateFromFilename(fileName, patterns);
        expect(result).toBe('2025.04.20');
    });

    it('should try patterns in order and use first match', () => {
        const patterns = [
            /specific-(\d{4})-(\d{2})-(\d{2})/,  // Won't match
            /(\d{4})-(\d{2})-(\d{2})/            // Will match
        ];
        const fileName = 'export-2025-04-25.zip';

        const result = extractArchiveDateFromFilename(fileName, patterns);
        expect(result).toBe('2025.04.25');
    });

    it('should return null if no pattern matches', () => {
        const patterns = [/(\d{4})-(\d{2})-(\d{2})/];
        const fileName = 'no-date-in-this-filename.zip';

        const result = extractArchiveDateFromFilename(fileName, patterns);
        expect(result).toBeNull();
    });

    it('should return null for empty filename', () => {
        const patterns = [/(\d{4})-(\d{2})-(\d{2})/];
        const result = extractArchiveDateFromFilename('', patterns);
        expect(result).toBeNull();
    });

    it('should return null for empty patterns array', () => {
        const result = extractArchiveDateFromFilename('export-2025-04-25.zip', []);
        expect(result).toBeNull();
    });

    it('should handle pattern with insufficient capture groups', () => {
        const patterns = [/(\d{4})-(\d{2})/];  // Only 2 groups instead of 3
        const fileName = 'export-2025-04.zip';

        const result = extractArchiveDateFromFilename(fileName, patterns);
        expect(result).toBeNull();
    });
});

describe('generateReportPrefix', () => {
    it('should generate correct report prefix format', () => {
        const result = generateReportPrefix('2025.04.25', '2025.04.20');
        expect(result).toBe('imported-2025.04.25-archive-2025.04.20');
    });

    it('should handle same import and archive dates', () => {
        const result = generateReportPrefix('2025.04.25', '2025.04.25');
        expect(result).toBe('imported-2025.04.25-archive-2025.04.25');
    });

    it('should handle different years', () => {
        const result = generateReportPrefix('2025.01.15', '2024.12.31');
        expect(result).toBe('imported-2025.01.15-archive-2024.12.31');
    });
});

describe('extractReportPrefixFromZip', () => {
    beforeEach(() => {
        vi.useRealTimers();
    });

    it('should extract prefix from ChatGPT filename', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2025-04-25T14:30:00Z'));

        const patterns = [/(\d{4})-(\d{2})-(\d{2})/];
        const fileName = 'chatgpt-export-2025-04-20.zip';

        const result = extractReportPrefixFromZip(fileName, patterns);
        expect(result).toBe('imported-2025.04.25-archive-2025.04.20');

        vi.useRealTimers();
    });

    it('should extract prefix from Claude batch filename', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2025-04-25T14:30:00Z'));

        const patterns = [
            /data-(\d{4})-(\d{2})-(\d{2})-\d{2}-\d{2}-\d{2}-batch-\d{4}/,
            /(\d{4})-(\d{2})-(\d{2})/
        ];
        const fileName = 'data-2025-04-20-10-30-45-batch-0001.zip';

        const result = extractReportPrefixFromZip(fileName, patterns);
        expect(result).toBe('imported-2025.04.25-archive-2025.04.20');

        vi.useRealTimers();
    });

    it('should use import date as fallback when no archive date found', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2025-04-25T14:30:00Z'));

        const patterns = [/(\d{4})-(\d{2})-(\d{2})/];
        const fileName = 'no-date-in-filename.zip';

        const result = extractReportPrefixFromZip(fileName, patterns);
        expect(result).toBe('imported-2025.04.25-archive-2025.04.25');

        vi.useRealTimers();
    });

    it('should handle complex ChatGPT filename with timestamp', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2025-04-25T14:30:00Z'));

        const patterns = [/(\d{4})-(\d{2})-(\d{2})/];
        const fileName = '3b00abafb9222a9580aa7cbb198166ed0c61634222cce9571bb079a2886aeed5-2025-04-20-14-40-42-ff19c2fd898d44d9bc5945ee80c199ca.zip';

        const result = extractReportPrefixFromZip(fileName, patterns);
        expect(result).toBe('imported-2025.04.25-archive-2025.04.20');

        vi.useRealTimers();
    });

    it('should prioritize more specific patterns', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2025-04-25T14:30:00Z'));

        const patterns = [
            /data-(\d{4})-(\d{2})-(\d{2})-\d{2}-\d{2}-\d{2}-batch-\d{4}/,  // More specific
            /(\d{4})-(\d{2})-(\d{2})/                                       // Generic
        ];
        const fileName = 'data-2025-04-20-10-30-45-batch-0001.zip';

        const result = extractReportPrefixFromZip(fileName, patterns);
        // Should match the more specific pattern first
        expect(result).toBe('imported-2025.04.25-archive-2025.04.20');

        vi.useRealTimers();
    });

    it('should handle legacy Claude format', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2025-04-25T14:30:00Z'));

        const patterns = [
            /data-(\d{4})-(\d{2})-(\d{2})-\d{2}-\d{2}-\d{2}-batch-\d{4}/,
            /(\d{4})-(\d{2})-(\d{2})/
        ];
        const fileName = 'claude-export-2025-04-20.zip';

        const result = extractReportPrefixFromZip(fileName, patterns);
        expect(result).toBe('imported-2025.04.25-archive-2025.04.20');

        vi.useRealTimers();
    });
});

