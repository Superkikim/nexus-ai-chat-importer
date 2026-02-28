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

// src/utils/zip-content-reader.ts
// Shared utility for extracting raw conversations from a JSZip object.
// Used by both ImportService and ConversationMetadataExtractor to avoid duplication.

import JSZip from "jszip";
import { NexusAiChatImporterError } from "../models/errors";
import { StreamingJsonArrayParser } from "./streaming-json-array-parser";

/**
 * Detect Gemini My Activity JSON files in a Google Takeout archive.
 *
 * We intentionally avoid relying on localized folder names like
 * "My Activity" / "Mon activité". Instead we only assume that:
 * - The first path segment is literally "Takeout";
 * - The third segment (index 2) contains the word "Gemini" in any language
 *   (e.g. "Gemini Apps", "Applications Gemini", ...);
 * - The target JSON lives directly under that folder.
 *
 * Examples:
 *   Takeout/My Activity/Gemini Apps/My Activity.json
 *   Takeout/Mon activité/Applications Gemini/MonActivité.json
 */
export function findGeminiActivityJsonFiles(fileNames: string[]): string[] {
    const geminiJsonFiles: string[] = [];

    for (const name of fileNames) {
        if (!name.toLowerCase().endsWith(".json")) continue;

        const segments = name.split("/");
        if (segments.length >= 3 && segments[0] === "Takeout") {
            const thirdLevel = segments[2];
            if (thirdLevel.toLowerCase().includes("gemini")) {
                geminiJsonFiles.push(name);
            }
        }
    }

    return geminiJsonFiles;
}

/**
 * Result returned by extractRawConversations.
 * uncompressedBytes is the total size (in characters) of the conversation JSON
 * strings read — useful for archive-mode decisions in the caller.
 */
export interface RawConversationExtractionResult {
    conversations: any[];
    uncompressedBytes: number;
}

/**
 * Extract raw conversation data from a JSZip object, provider-agnostic.
 *
 * Detection order:
 *   1. Le Chat   — files matching /^chat-[a-f0-9-]+\.json$/
 *   2. Gemini    — Google Takeout folder with "Gemini" in path
 *   3. ChatGPT new format — conversations-NNN.json (numbered files)
 *   4. ChatGPT/Claude legacy — single conversations.json
 *
 * Throws NexusAiChatImporterError with a user-facing message on any failure.
 */
export async function extractRawConversations(
    zip: JSZip
): Promise<RawConversationExtractionResult> {
    const fileNames = Object.keys(zip.files);

    // ── 1. Le Chat format ────────────────────────────────────────────────────
    const leChatFiles = fileNames.filter(name => /^chat-[a-f0-9-]+\.json$/.test(name));

    if (leChatFiles.length > 0) {
        const conversations: any[] = [];
        let uncompressedBytes = 0;

        for (const fileName of leChatFiles) {
            const f = zip.file(fileName);
            if (!f) continue;
            const content = await f.async("string");
            uncompressedBytes += content.length;
            conversations.push(JSON.parse(content));
        }

        return { conversations, uncompressedBytes };
    }

    // ── 2. Gemini format ─────────────────────────────────────────────────────
    const geminiJsonFiles = findGeminiActivityJsonFiles(fileNames);
    if (geminiJsonFiles.length > 0) {
        const activityFilePath = geminiJsonFiles[0];
        const activityFile = zip.file(activityFilePath);
        if (!activityFile) {
            throw new NexusAiChatImporterError(
                "Missing Gemini activity JSON",
                "The ZIP file appears to contain a Gemini folder but the My Activity JSON file is missing."
            );
        }

        const activityJson = await activityFile.async("string");

        try {
            const conversations: any[] = [];
            for (const entry of StreamingJsonArrayParser.streamConversations(activityJson)) {
                conversations.push(entry);
            }

            if (conversations.length === 0) {
                throw new NexusAiChatImporterError(
                    "Empty Gemini export",
                    "No entries found in the Gemini My Activity JSON file."
                );
            }

            return { conversations, uncompressedBytes: activityJson.length };
        } catch (error) {
            if (error instanceof NexusAiChatImporterError) throw error;
            throw new NexusAiChatImporterError(
                "Invalid Gemini My Activity JSON structure",
                "The Gemini My Activity JSON file does not contain a valid array of activity entries."
            );
        }
    }

    // ── 3. ChatGPT new format: numbered conversations files ──────────────────
    const numberedConvFiles = fileNames
        .filter(n => /^conversations-\d+\.json$/.test(n))
        .sort();

    if (numberedConvFiles.length > 0) {
        const conversations: any[] = [];
        let uncompressedBytes = 0;

        for (const fileName of numberedConvFiles) {
            const f = zip.file(fileName);
            if (!f) continue;
            const json = await f.async("string");
            uncompressedBytes += json.length;
            for (const conv of StreamingJsonArrayParser.streamConversations(json)) {
                conversations.push(conv);
            }
        }

        if (conversations.length === 0) {
            throw new NexusAiChatImporterError(
                "No conversations found",
                "The numbered conversation files (conversations-NNN.json) are all empty."
            );
        }

        return { conversations, uncompressedBytes };
    }

    // ── 4. ChatGPT / Claude legacy format: single conversations.json ─────────
    const conversationsFile = zip.file("conversations.json");
    if (!conversationsFile) {
        throw new NexusAiChatImporterError(
            "Missing conversations.json",
            "The ZIP file does not contain a conversations.json file, chat-{uuid}.json files, or a Gemini My Activity JSON file."
        );
    }

    const conversationsJson = await conversationsFile.async("string");

    try {
        const conversations: any[] = [];
        for (const conv of StreamingJsonArrayParser.streamConversations(conversationsJson)) {
            conversations.push(conv);
        }

        if (conversations.length === 0) {
            throw new NexusAiChatImporterError(
                "No conversations found",
                "The conversations.json file exists but contains no conversations."
            );
        }

        return { conversations, uncompressedBytes: conversationsJson.length };
    } catch (error) {
        if (error instanceof NexusAiChatImporterError) throw error;
        throw new NexusAiChatImporterError(
            "Invalid conversations.json structure",
            "The conversations.json file does not contain a valid conversation array."
        );
    }
}
