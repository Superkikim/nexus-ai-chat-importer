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

import { ReportNamingStrategy } from "../../types/standard";
import { extractReportPrefixFromZip } from "../../utils/report-naming-utils";
import { PerplexityConversationFile } from "./perplexity-types";

export class PerplexityReportNamingStrategy implements ReportNamingStrategy {
    extractReportPrefix(zipFileName: string): string {
        const patterns = [/(\d{4})-(\d{2})-(\d{2})/];
        return extractReportPrefixFromZip(zipFileName, patterns);
    }

    getProviderName(): string {
        return "perplexity";
    }

    getProviderSpecificColumn(): { header: string; getValue: (adapter: any, chat: any) => number } {
        return {
            header: "Turns",
            getValue: (_adapter: any, chat: PerplexityConversationFile) =>
                Array.isArray(chat?.conversations) ? chat.conversations.length : 0,
        };
    }
}
