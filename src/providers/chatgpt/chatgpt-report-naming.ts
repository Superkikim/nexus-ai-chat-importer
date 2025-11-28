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


// src/providers/chatgpt/chatgpt-report-naming.ts
import { ReportNamingStrategy } from "../../types/standard";
import { extractReportPrefixFromZip } from "../../utils/report-naming-utils";

export class ChatGPTReportNamingStrategy implements ReportNamingStrategy {
    
    /**
     * Extract date prefix from ChatGPT ZIP filename
     * Examples:
     * - "3b00abafb9222a9580aa7cbb198166ed0c61634222cce9571bb079a2886aeed5-2025-04-25-14-40-42-ff19c2fd898d44d9bc5945ee80c199ca.zip"
     * - "chatgpt-export-2025-04-25.zip"
     * - "conversations-2025-04-25-14-40-42.zip"
     */
    extractReportPrefix(zipFileName: string): string {
        // ChatGPT date pattern: YYYY-MM-DD
        const patterns = [/(\d{4})-(\d{2})-(\d{2})/];
        return extractReportPrefixFromZip(zipFileName, patterns);
    }
    
    /**
     * Get ChatGPT provider name
     */
    getProviderName(): string {
        return "chatgpt";
    }

    getProviderSpecificColumn(): { header: string; getValue: (adapter: any, chat: any) => number } {
        return {
            header: "Attachments",
            getValue: (adapter: any, chat: any) => {
                // Count attachments in ChatGPT conversation
                let attachmentCount = 0;
                if (chat.mapping) {
                    Object.values(chat.mapping).forEach((node: any) => {
                        // Count regular attachments (user uploads)
                        if (node.message?.metadata?.attachments) {
                            attachmentCount += node.message.metadata.attachments.length;
                        }

                        // Count DALL-E images (generated images)
                        if (node.message?.content?.parts) {
                            node.message.content.parts.forEach((part: any) => {
                                if (part.content_type === "image_asset_pointer" &&
                                    part.asset_pointer &&
                                    part.metadata?.dalle &&
                                    part.metadata.dalle !== null) {
                                    attachmentCount++;
                                }
                            });
                        }
                    });
                }
                return attachmentCount;
            }
        };
    }
}