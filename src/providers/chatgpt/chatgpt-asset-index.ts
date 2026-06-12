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

// src/providers/chatgpt/chatgpt-asset-index.ts
import { ZipArchiveReader } from "../../utils/zip-loader";

const ASSET_INDEX_FILE = "conversation_asset_file_names.json";

/**
 * One resolved asset from conversation_asset_file_names.json
 */
export interface ChatGPTAssetEntry {
    /** Physical path of the asset inside the ZIP (e.g. "file-0HDUFW2JaMMvCvhqOQsPCGxF.dat") */
    datPath: string;
    /** Raw index value (e.g. "Screenshot.jpg", "dalle-generations/<uuid>.webp", "<conv-uuid>/audio/<uuid>.wav") */
    originalName: string;
    /** Basename of originalName, suitable as a vault filename (may lack an extension) */
    displayName: string;
    /** True when the index value points to a DALL-E generation */
    isDalle: boolean;
    /** True when the index value points to a voice recording (skipped on import) */
    isAudio: boolean;
}

/**
 * Index built from conversation_asset_file_names.json (new 2026 ChatGPT export
 * format). Maps every fileId — with and without its "file-"/"file_" prefix —
 * to the .dat entry that contains the asset payload.
 */
export interface ChatGPTAssetIndex {
    byFileId: Map<string, ChatGPTAssetEntry>;
}

/**
 * Load and parse conversation_asset_file_names.json from a ChatGPT export ZIP.
 *
 * Returns null for old-format exports (file absent) or unparseable content,
 * so callers can treat "no index" as "use legacy lookup strategies".
 */
export async function buildChatGPTAssetIndex(
    zip: ZipArchiveReader
): Promise<ChatGPTAssetIndex | null> {
    const entry = zip.get(ASSET_INDEX_FILE);
    if (!entry) {
        return null;
    }

    let mapping: Record<string, string>;
    try {
        const parsed: unknown = JSON.parse(await entry.readText());
        if (
            typeof parsed !== "object" ||
            parsed === null ||
            Array.isArray(parsed)
        ) {
            return null;
        }
        mapping = parsed as Record<string, string>;
    } catch {
        return null;
    }

    const byFileId = new Map<string, ChatGPTAssetEntry>();

    for (const [datPath, originalName] of Object.entries(mapping)) {
        if (typeof originalName !== "string") continue;

        const fileId = datPath.replace(/\.dat$/i, "");
        if (!fileId) continue;

        const displayName = originalName.split("/").pop() || originalName;
        const assetEntry: ChatGPTAssetEntry = {
            datPath,
            originalName,
            displayName,
            isDalle: originalName.startsWith("dalle-generations/"),
            isAudio:
                /(^|\/)audio\//i.test(originalName) ||
                /\.wav$/i.test(originalName),
        };

        if (!byFileId.has(fileId)) {
            byFileId.set(fileId, assetEntry);
        }

        // Also index the bare id without the "file-"/"file_" prefix so lookups
        // by either form succeed (asset_pointer ids keep the prefix, but some
        // legacy code paths strip it).
        if (/^file[-_]/.test(fileId)) {
            const bareId = fileId.substring(5);
            if (bareId && !byFileId.has(bareId)) {
                byFileId.set(bareId, assetEntry);
            }
        }
    }

    return { byFileId };
}
