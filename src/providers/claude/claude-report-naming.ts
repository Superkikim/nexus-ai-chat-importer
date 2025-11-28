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
import { extractReportPrefixFromZip } from "../../utils/report-naming-utils";

export class ClaudeReportNamingStrategy implements ReportNamingStrategy {
    getProviderName(): string {
        return "claude";
    }

    extractReportPrefix(zipFileName: string): string {
        // Claude date patterns (in priority order)
        const patterns = [
            // Pattern 1: data-YYYY-MM-DD-HH-MM-SS-batch-NNNN.zip
            /data-(\d{4})-(\d{2})-(\d{2})-\d{2}-\d{2}-\d{2}-batch-\d{4}/,
            // Pattern 2: Legacy Claude format (generic YYYY-MM-DD)
            /(\d{4})-(\d{2})-(\d{2})/
        ];
        return extractReportPrefixFromZip(zipFileName, patterns);
    }

    getProviderSpecificColumn(): { header: string; getValue: (adapter: any, chat: any) => number } {
        return {
            header: "Artifacts",
            getValue: (adapter: any, chat: any) => adapter.countArtifacts ? adapter.countArtifacts(chat) : 0
        };
    }
}
