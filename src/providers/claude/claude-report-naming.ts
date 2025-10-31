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


// src/providers/claude/claude-report-naming.ts
import { ReportNamingStrategy } from "../../types/standard";

export class ClaudeReportNamingStrategy implements ReportNamingStrategy {
    getProviderName(): string {
        return "claude";
    }

    extractReportPrefix(zipFileName: string): string {
        // Get current import date
        const now = new Date();
        const importYear = now.getFullYear();
        const importMonth = String(now.getMonth() + 1).padStart(2, '0');
        const importDay = String(now.getDate()).padStart(2, '0');
        const importDate = `${importYear}.${importMonth}.${importDay}`;

        // Try to extract archive date from Claude filename patterns
        // Pattern 1: data-YYYY-MM-DD-HH-MM-SS-batch-NNNN.zip
        const claudeBatchPattern = /data-(\d{4})-(\d{2})-(\d{2})-\d{2}-\d{2}-\d{2}-batch-\d{4}/;
        const batchMatch = zipFileName.match(claudeBatchPattern);

        if (batchMatch) {
            const [, year, month, day] = batchMatch;
            const archiveDate = `${year}.${month}.${day}`;
            return `imported-${importDate}-archive-${archiveDate}`;
        }

        // Pattern 2: Legacy Claude format (no batch suffix)
        const legacyPattern = /(\d{4})-(\d{2})-(\d{2})/;
        const legacyMatch = zipFileName.match(legacyPattern);

        if (legacyMatch) {
            const [, year, month, day] = legacyMatch;
            const archiveDate = `${year}.${month}.${day}`;
            return `imported-${importDate}-archive-${archiveDate}`;
        }

        // Fallback: use current date if no date found in filename
        return `imported-${importDate}-archive-${importDate}`;
    }

    getProviderSpecificColumn(): { header: string; getValue: (adapter: any, chat: any) => number } {
        return {
            header: "Artifacts",
            getValue: (adapter: any, chat: any) => adapter.countArtifacts ? adapter.countArtifacts(chat) : 0
        };
    }
}
