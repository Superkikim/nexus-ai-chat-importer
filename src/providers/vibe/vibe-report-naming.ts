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
import {
    getCurrentImportDate,
    generateReportPrefix,
} from "../../utils/report-naming-utils";
import { MistralVibeConversation } from "./vibe-types";

/**
 * Report naming strategy for Mistral Vibe (formerly Le Chat)
 */
export class MistralVibeReportNamingStrategy implements ReportNamingStrategy {
    /**
     * Extract date prefix from Mistral Vibe ZIP filename
     *
     * Mistral Vibe ZIP format: chat-export-{timestamp}.zip
     * Example: chat-export-1760124530481.zip
     *
     * The timestamp is in milliseconds since Unix epoch.
     */
    extractReportPrefix(zipFileName: string): string {
        const importDate = getCurrentImportDate();

        // Pattern: chat-export-{timestamp}.zip
        const timestampPattern = /chat-export-(\d{10,13})/;
        const match = zipFileName.match(timestampPattern);

        if (match) {
            const timestamp = parseInt(match[1]);
            // Convert to Date (timestamp is in milliseconds)
            const date = new Date(timestamp);

            // Format as YYYY.MM.DD
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, "0");
            const day = String(date.getDate()).padStart(2, "0");
            const archiveDate = `${year}.${month}.${day}`;

            return generateReportPrefix(importDate, archiveDate);
        }

        // Fallback: use current date for both import and archive
        return generateReportPrefix(importDate, importDate);
    }

    /**
     * Get Mistral Vibe provider name
     */
    getProviderName(): string {
        return "vibe";
    }

    /**
     * Provider-specific column: Attachments
     * Counts the number of file attachments (images, documents) in the conversation
     */
    getProviderSpecificColumn(): {
        header: string;
        getValue: (adapter: unknown, chat: unknown) => number;
    } {
        return {
            header: "Attachments",
            getValue: (_adapter: unknown, chat: unknown) => {
                const vibeChat = chat as MistralVibeConversation;
                let attachmentCount = 0;

                if (!Array.isArray(vibeChat)) {
                    return 0;
                }

                // Count file attachments in all messages
                for (const message of vibeChat) {
                    if (message.files && Array.isArray(message.files)) {
                        attachmentCount += message.files.length;
                    }
                }

                return attachmentCount;
            },
        };
    }
}
