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


// src/utils.ts
import { App, TFile, TFolder, Vault } from "obsidian";
import { Logger } from "./logger";
import { requestUrl } from "obsidian";
import { MESSAGE_TIMESTAMP_FORMATS, PROVIDER_URLS } from "./config/constants";
import type { MessageTimestampFormat } from "./types/plugin";

// Use window.moment instead of importing from obsidian
const moment = (window as any).moment;

const logger = new Logger();

/**
 * Truncate Unix timestamp to minute precision (remove seconds)
 * Used for comparing conversation timestamps between v1.2.0 (no seconds) and v1.3.0 (with seconds)
 *
 * @param unixTime - Unix timestamp in seconds
 * @returns Unix timestamp truncated to minute precision
 *
 * @example
 * truncateToMinute(1719582647) // 14:30:47 → returns 1719582600 (14:30:00)
 * truncateToMinute(1719582600) // 14:30:00 → returns 1719582600 (14:30:00)
 */
export function truncateToMinute(unixTime: number): number {
    return Math.floor(unixTime / 60) * 60;
}

/**
 * Compare two Unix timestamps with minute precision (ignoring seconds)
 * Returns negative if time1 < time2, positive if time1 > time2, zero if equal
 *
 * @param time1 - First Unix timestamp in seconds
 * @param time2 - Second Unix timestamp in seconds
 * @returns Comparison result (negative/zero/positive)
 *
 * @example
 * compareTimestampsIgnoringSeconds(1719582647, 1719582600) // Both 14:30:xx → returns 0 (equal)
 * compareTimestampsIgnoringSeconds(1719582700, 1719582600) // 14:31 vs 14:30 → returns 60 (positive)
 */
export function compareTimestampsIgnoringSeconds(time1: number, time2: number): number {
    return truncateToMinute(time1) - truncateToMinute(time2);
}

/**
 * Format message timestamp with custom or locale-based format
 * Used for message callouts and note headers
 */
export function formatMessageTimestamp(
    unixTime: number,
    customFormat?: MessageTimestampFormat
): string {
    const date = moment(unixTime * 1000);

    // If no custom format, use locale (default behavior)
    if (!customFormat || customFormat === 'locale') {
        return `${date.format('L')} at ${date.format('LTS')}`;
    }

    // Use custom format
    const format = MESSAGE_TIMESTAMP_FORMATS[customFormat];
    return `${date.format(format.dateFormat)}${format.separator}${date.format(format.timeFormat)}`;
}

/**
 * Format timestamp for legacy uses (prefix, reports)
 * KEPT for backward compatibility
 */
export function formatTimestamp(
    unixTime: number,
    format: "prefix" | "date" | "time"
): string {
    const date = moment(unixTime * 1000);
    switch (format) {
        case "prefix":
            return date.format("YYYYMMDD");
        case "date":
            return date.format("L");
        case "time":
            return date.format("LTS");
    }
}

// Generate subfolder for YYYY MM tree structure
export function generateYearMonthFolder(unixTime: number): string {
    const date = new Date(unixTime * 1000);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    return `${year}/${month}`;
}

export function formatTitle(title: string): string {
    return title.trim() || "Untitled"; // Just trim whitespace; retain spaces and characters for readability
}

export function generateFileName(title: string): string {
    let fileName = formatTitle(title)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
        .replace(/[<>:"\/\\|?*\n\r]+/g, "") // Remove invalid filesystem characters
        .replace(/\.{2,}/g, ".") // Replace multiple dots with single dot
        .trim();

    // CRITICAL: Remove special characters from the beginning
    // This fixes issues like ".htaccess" becoming an invisible file
    fileName = fileName.replace(/^[^\w\d\s]+/, ""); // Remove non-alphanumeric at start
    
    // Clean up any remaining problematic patterns
    fileName = fileName
        .replace(/\s+/g, " ") // Normalize spaces
        .trim();

    // Ensure we have a valid filename
    if (!fileName || fileName.length === 0) {
        fileName = "Untitled";
    }

    // Ensure filename doesn't start with a dot (hidden files)
    if (fileName.startsWith(".")) {
        fileName = fileName.substring(1);
    }

    // Final safety check - if still empty after cleaning
    if (!fileName || fileName.length === 0) {
        fileName = "Untitled";
    }

    return fileName;
}

/**
 * @deprecated Use generateConversationFileName instead
 */
export function addPrefix(
    filename: string,
    timeStamp: number,
    dateFormat: string
): string {
    const prefix = createDatePrefix(timeStamp, dateFormat);
    if (prefix) {
        filename = `${prefix} - ${filename}`;
    }
    return filename; // Return the filename with prefix if applicable
}

export function createDatePrefix(
    timeStamp: number,
    dateFormat: string
): string {
    const date = new Date(timeStamp * 1000); // Convert Unix timestamp to Date
    let prefix = "";

    // Format the date based on the specified format
    if (dateFormat === "YYYY-MM-DD") {
        prefix = date.toISOString().split("T")[0]; // Format as YYYY-MM-DD
    } else if (dateFormat === "YYYYMMDD") {
        prefix = date.toISOString().split("T")[0].replace(/-/g, ""); // Remove dashes for YYYYMMDD
    }

    return prefix;
}

export async function generateUniqueFileName(
    filePath: string,
    vaultAdapter: any
): Promise<string> {
    let uniqueFileName = filePath;

    // Extract the base name and extension
    const baseName = filePath.replace(/\.md$/, ""); // Remove the .md extension for unique name generation
    let counter = 1;

    // Check for existence and generate unique names
    while (await vaultAdapter.exists(uniqueFileName)) {
        // Create a new name with counter appended
        uniqueFileName = `${baseName} (${counter++}).md`; // Append the counter and keep .md
    }

    return uniqueFileName; // Return the unique file name
}

// Function to check if the full file path exists
export async function doesFilePathExist(
    filePath: string,
    vault: any
): Promise<boolean> {
    const file = vault.getAbstractFileByPath(filePath);
    return file !== null; // Return true if the file exists, false otherwise
}

export async function getFileHash(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Generate the exact filename that would be used for a conversation
 * This matches the logic in ConversationProcessor.generateFilePathForChat
 */
export function generateConversationFileName(
    chatTitle: string,
    createTime: number,
    addDatePrefix: boolean,
    dateFormat: string
): string {
    const date = new Date(createTime * 1000);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");

    let fileName = generateFileName(chatTitle);

    if (addDatePrefix) {
        const day = String(date.getDate()).padStart(2, "0");
        let prefix = "";
        if (dateFormat === "YYYY-MM-DD") {
            prefix = `${year}-${month}-${day}`;
        } else if (dateFormat === "YYYYMMDD") {
            prefix = `${year}${month}${day}`;
        }
        fileName = `${prefix} - ${fileName}`;
    }

    return fileName;
}

/**
 * Generate safe alias for frontmatter use
 * Sanitizes titles to be safe for YAML frontmatter while preserving readability
 * Returns either a safe unquoted string or a properly quoted string when necessary
 */
export function generateSafeAlias(title: string): string {
    if (!title || typeof title !== 'string') {
        return "Untitled";
    }

    // Check if starts with YAML special characters BEFORE any sanitization
    const startsWithYamlSpecial =
        title.startsWith('#') ||
        title.startsWith('&') ||
        title.startsWith('*') ||
        title.startsWith('!') ||
        title.startsWith('|') ||
        title.startsWith('>') ||
        title.startsWith('%') ||
        title.startsWith('@') ||
        title.startsWith('`');

    // Start with the title and apply minimal sanitization
    let cleanName = title
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
        .replace(/[<>\/\\|?*\n\r]+/g, "") // Remove invalid filesystem characters (keep quotes and colons)
        .replace(/\.{2,}/g, ".") // Replace multiple dots with single dot
        .trim();

    // Remove special characters from the beginning (for filesystem safety)
    // But we'll remember if we had YAML special chars for quoting decision
    cleanName = cleanName.replace(/^[^\w\d\s"']+/, "");

    // Clean up any remaining problematic patterns
    cleanName = cleanName
        .replace(/\s+/g, " ") // Normalize spaces
        .trim();

    // Ensure we have a valid alias
    if (!cleanName || cleanName.length === 0) {
        cleanName = "Untitled";
    }

    // Ensure alias doesn't start with a dot (can cause issues in frontmatter)
    if (cleanName.startsWith(".")) {
        cleanName = cleanName.substring(1);
    }

    // Final safety check
    if (!cleanName || cleanName.length === 0) {
        cleanName = "Untitled";
    }

    // Check if we need quotes (YAML reserved words or values that could be misinterpreted)
    const needsQuotes =
        // YAML reserved words
        /^(true|false|null|yes|no|on|off|\d+|\d*\.\d+)$/i.test(cleanName) ||

        // Contains quotes
        cleanName.includes('"') ||

        // Contains colon (CRITICAL: prevents YAML key-value interpretation)
        cleanName.includes(':') ||

        // Contains square brackets or curly braces (YAML flow collections)
        cleanName.includes('[') ||
        cleanName.includes(']') ||
        cleanName.includes('{') ||
        cleanName.includes('}') ||

        // Started with YAML special characters (before sanitization)
        startsWithYamlSpecial ||

        // Contains newlines or tabs (safety check)
        cleanName.includes('\n') ||
        cleanName.includes('\r') ||
        cleanName.includes('\t');

    if (needsQuotes) {
        // Use single quotes and escape any single quotes in the content
        return `'${cleanName.replace(/'/g, "''")}'`;
    }

    return cleanName;
}

export function isValidMessage(message: any): boolean {
    return (
        message &&
        typeof message === "object" &&
        message.content &&
        typeof message.content === "object" &&
        Array.isArray(message.content.parts) &&
        message.content.parts.length > 0 &&
        message.content.parts.some(
            (part: any) => {
                // Handle simple string parts
                if (typeof part === "string" && part.trim() !== "") {
                    return true;
                }
                // Handle object parts with content_type
                if (typeof part === "object" && part !== null) {
                    // Audio transcription parts
                    if (part.content_type === "audio_transcription" && part.text && part.text.trim() !== "") {
                        return true;
                    }
                    // Text parts with content_type
                    if (part.content_type === "text" && part.text && part.text.trim() !== "") {
                        return true;
                    }
                    // Multimodal text parts
                    if (part.content_type === "multimodal_text" && part.text && part.text.trim() !== "") {
                        return true;
                    }
                }
                return false;
            }
        )
    );
}

export interface CustomError {
    message: string;
}

export function isCustomError(error: any): error is CustomError {
    return error && typeof error.message === "string"; // Check if error has a 'message' property
}

export async function ensureFolderExists(
    folderPath: string,
    vault: any
): Promise<{ success: boolean; error?: string }> {
    const folders = folderPath.split("/").filter((p) => p.length);
    let currentPath = "";

    for (const folder of folders) {
        currentPath += folder + "/";
        const currentFolder = vault.getAbstractFileByPath(currentPath);

        if (!currentFolder) {
            try {
                await vault.createFolder(currentPath);
            } catch (error: any) {
                if (error.message !== "Folder already exists.") {
                    logger.error(
                        `Failed to create folder: ${currentPath}`,
                        error.message
                    );
                    return {
                        success: false,
                        error: `Failed to create folder: ${currentPath}. Reason: ${error.message}`,
                    };
                }
                // If folder already exists, continue silently
            }
        }
    }
    return { success: true };
}

export async function checkConversationLink(
    conversationId: string,
    provider: string = 'chatgpt'
): Promise<boolean> {
    // Generate provider-specific URL using centralized constants
    let url: string;
    switch (provider) {
        case 'chatgpt':
            url = PROVIDER_URLS.CHATGPT.CHAT(conversationId);
            break;
        case 'claude':
            url = PROVIDER_URLS.CLAUDE.CHAT(conversationId);
            break;
        default:
            logger.error(`Unknown provider for link checking: ${provider}`);
            return false;
    }

    try {
        const response = await requestUrl({
            url: url,
            method: "HEAD",
        });

        return response.status >= 200 && response.status < 300; // Returns true for status codes 200-299
    } catch (error) {
        logger.error(`Error fetching ${url}:`, error);
        return false; // Return false in case of error (e.g., network issues)
    }
}

export function isNexusRelated(file: TFile, app: App): boolean {
    const frontmatter = app.metadataCache.getFileCache(file)?.frontmatter;
    return frontmatter?.nexus === "nexus-ai-chat-importer"; // Return true if the nexus matches
}

/**
 * Result of a folder merge operation
 */
export interface FolderMergeResult {
    success: boolean;
    moved: number;
    skipped: number;
    errors: number;
    errorDetails?: string[];
}

/**
 * Move and merge folders - moves all files from oldFolder to newPath RECURSIVELY
 * If files already exist in destination, they are skipped (not overwritten)
 *
 * @param oldFolder - The source folder to move from
 * @param newPath - The destination path
 * @param vault - The Obsidian vault instance
 * @param onProgress - Optional callback for progress updates
 * @returns Result with counts of moved, skipped, and error files
 */
export async function moveAndMergeFolders(
    oldFolder: TFolder,
    newPath: string,
    vault: Vault,
    onProgress?: (current: number, total: number) => void
): Promise<FolderMergeResult> {
    let moved = 0;
    let skipped = 0;
    let errors = 0;
    const errorDetails: string[] = [];
    const foldersToDelete: TFolder[] = []; // Track folders to delete after moving files

    // Count total files to move for progress tracking
    let totalFiles = 0;
    let processedFiles = 0;

    function countFiles(folder: TFolder): number {
        let count = 0;
        for (const child of folder.children) {
            if (child instanceof TFolder) {
                count += countFiles(child);
            } else {
                count++;
            }
        }
        return count;
    }

    totalFiles = countFiles(oldFolder);

    /**
     * Recursively move all files from a folder
     */
    async function moveRecursive(sourceFolder: TFolder, destPath: string): Promise<void> {
        // Ensure destination folder exists
        try {
            await vault.createFolder(destPath);
        } catch (error: any) {
            if (!error.message?.includes("Folder already exists")) {
                throw error;
            }
            // Folder exists, that's fine - we're merging
        }

        // Mark THIS folder for deletion BEFORE processing children
        // This ensures parent folders are added to the list before their children
        // When we reverse the list later, children will be deleted before parents
        foldersToDelete.push(sourceFolder);

        // Process all children
        for (const child of [...sourceFolder.children]) { // Copy array to avoid modification during iteration
            const childNewPath = `${destPath}/${child.name}`;

            if (child instanceof TFolder) {
                // Recursively process subfolder
                await moveRecursive(child, childNewPath);
            } else {
                // It's a file
                try {
                    // Check if destination already exists
                    const exists = await vault.adapter.exists(childNewPath);

                    if (exists) {
                        // Skip existing files to avoid overwriting
                        skipped++;
                        processedFiles++;
                        if (onProgress) {
                            onProgress(processedFiles, totalFiles);
                        }
                        continue;
                    }

                    // Destination doesn't exist, safe to move
                    await vault.rename(child, childNewPath);
                    moved++;
                    processedFiles++;
                    if (onProgress) {
                        onProgress(processedFiles, totalFiles);
                    }
                } catch (error: any) {
                    const errorMsg = `Failed to move ${child.path}: ${error.message || String(error)}`;
                    logger.error(`[moveAndMergeFolders] ${errorMsg}`);
                    errorDetails.push(errorMsg);
                    errors++;
                    processedFiles++;
                    if (onProgress) {
                        onProgress(processedFiles, totalFiles);
                    }
                }
            }
        }
    }

    try {
        await moveRecursive(oldFolder, newPath);

        // Delete folders bottom-up (deepest first)
        // Reverse the array so we delete children before parents
        for (const folder of foldersToDelete.reverse()) {
            try {
                // Check if folder still exists before trying to delete
                const exists = await vault.adapter.exists(folder.path);
                if (!exists) {
                    continue;
                }

                // Check if folder is actually empty using low-level API
                // folder.children might be stale after moving files
                const folderContents = await vault.adapter.list(folder.path);

                // Filter out hidden files (like .DS_Store on macOS)
                const visibleFiles = folderContents.files.filter(f => {
                    const fileName = f.split('/').pop() || '';
                    return !fileName.startsWith('.');
                });

                const isEmpty = visibleFiles.length === 0 && folderContents.folders.length === 0;

                if (isEmpty) {
                    // Folder is empty (or only contains hidden files), safe to delete
                    // rmdir with recursive=true will handle hidden files
                    await vault.adapter.rmdir(folder.path, true);
                } else {
                    logger.warn(`[moveAndMergeFolders] ⚠️ Folder not empty, skipping deletion: ${folder.path} (${visibleFiles.length} files, ${folderContents.folders.length} folders)`);
                }
            } catch (error: any) {
                // Folder might have already been deleted, or might not exist
                // This is not a critical error - just log it
                const errorMsg = error.message || String(error);
                if (!errorMsg.includes("does not exist") && !errorMsg.includes("ENOENT")) {
                    logger.warn(`[moveAndMergeFolders] ❌ Could not delete folder ${folder.path}: ${errorMsg}`);
                }
            }
        }

        // Delete empty parent folders recursively
        // Start from the original folder's parent and go up
        let currentFolder = oldFolder.parent;
        while (currentFolder && currentFolder.path !== "/") {
            try {
                // Check if folder still exists
                const exists = await vault.adapter.exists(currentFolder.path);
                if (!exists) {
                    break;
                }

                // Check if folder is actually empty using low-level API
                const folderContents = await vault.adapter.list(currentFolder.path);

                // Filter out hidden files (like .DS_Store on macOS)
                const visibleFiles = folderContents.files.filter(f => {
                    const fileName = f.split('/').pop() || '';
                    return !fileName.startsWith('.');
                });

                const isEmpty = visibleFiles.length === 0 && folderContents.folders.length === 0;

                if (isEmpty) {
                    // Folder is empty (or only contains hidden files), safe to delete
                    // rmdir with recursive=true will handle hidden files
                    await vault.adapter.rmdir(currentFolder.path, true);
                    // Move up to the next parent
                    currentFolder = currentFolder.parent;
                } else {
                    // Parent folder is not empty - stop here
                    break;
                }
            } catch (error: any) {
                // Parent folder error - stop here
                break;
            }
        }

        return {
            success: errors === 0,
            moved,
            skipped,
            errors,
            errorDetails: errorDetails.length > 0 ? errorDetails : undefined
        };
    } catch (error: any) {
        logger.error(`Failed to merge folders:`, error);
        return {
            success: false,
            moved,
            skipped,
            errors: errors + 1,
            errorDetails: [`Critical error: ${error.message || String(error)}`]
        };
    }
}