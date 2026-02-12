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


// src/services/archive-mode-decider.ts

/**
 * Import mode for a ZIP archive.
 *
 * - "normal": regular imports where in-memory parsing is acceptable
 * - "large-archive": streaming should be preferred and UX should
 *   communicate that the archive is unusually big
 */
export type ArchiveMode = "normal" | "large-archive";

export interface ArchiveSizeContext {
    /** Size of the ZIP file on disk (compressed), in bytes. */
    zipSizeBytes: number;
    /**
     * Optional size of the uncompressed conversations.json content in bytes.
     * This is only known after JSZip has decompressed the file once.
     */
    conversationsUncompressedBytes?: number;
}

export interface ArchiveModeDecision {
    mode: ArchiveMode;
    /** Short machine-friendly reason string for logging / telemetry. */
    reason: "within-threshold" | "zip-too-large" | "uncompressed-too-large";
}

/**
 * Thresholds are intentionally conservative and can be tuned later.
 * They are centralized here so ImportService and ConversationMetadataExtractor
 * use the same logic.
 */
export const ZIP_LARGE_ARCHIVE_THRESHOLD_BYTES = 100 * 1024 * 1024; // 100 MB
export const UNCOMPRESSED_LARGE_ARCHIVE_THRESHOLD_BYTES = 250 * 1024 * 1024; // 250 MB

/**
 * Decide whether an archive should be treated as "large".
 *
 * - If we know the uncompressed conversations.json size and it crosses
 *   the uncompressed threshold, we always select large-archive mode.
 * - Otherwise we fall back to ZIP size as a coarse early indicator.
 */
export function decideArchiveMode(context: ArchiveSizeContext): ArchiveModeDecision {
    const { zipSizeBytes, conversationsUncompressedBytes } = context;

    if (
        typeof conversationsUncompressedBytes === "number" &&
        conversationsUncompressedBytes >= UNCOMPRESSED_LARGE_ARCHIVE_THRESHOLD_BYTES
    ) {
        return {
            mode: "large-archive",
            reason: "uncompressed-too-large",
        };
    }

    if (zipSizeBytes >= ZIP_LARGE_ARCHIVE_THRESHOLD_BYTES) {
        return {
            mode: "large-archive",
            reason: "zip-too-large",
        };
    }

    return {
        mode: "normal",
        reason: "within-threshold",
    };
}

