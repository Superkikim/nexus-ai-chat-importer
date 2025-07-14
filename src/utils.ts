// src/utils.ts
import { moment, App, TFile } from "obsidian";
import { Logger } from "./logger";
import { requestUrl } from "obsidian";

const logger = new Logger();

export function formatTimestamp(
    // REQUIRE REFACTORING TO SUPPORT OTHER DATE FORMATS THAN UNIXTIME
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
            return date.format("LT");
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

export function addPrefix(
    filename: string,
    timeStamp: number,
    dateFormat: string
): string {
    const timeStampStr = formatTimestamp(timeStamp, dateFormat); // Use the specified format
    if (timeStampStr) {
        filename = `${timeStampStr} - ${filename}`;
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

export function isValidMessage(message: any): boolean {
    return (
        message &&
        typeof message === "object" &&
        message.content &&
        typeof message.content === "object" &&
        Array.isArray(message.content.parts) &&
        message.content.parts.length > 0 &&
        message.content.parts.some(
            (part) => {
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
    conversationId: string
): Promise<boolean> {
    const url = `https://chatgpt.com/c/${conversationId}`;
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

export function old_getConversationId(app: App): string | undefined {
    const activeFile = app.workspace.getActiveFile();
    if (activeFile) {
        const frontmatter =
            app.metadataCache.getFileCache(activeFile)?.frontmatter;
        return frontmatter?.conversation_id;
    }
    return undefined; // Return undefined if there is no active file
}

// REMOVED: getConversationId() - no longer needed (click handler removed)
// REMOVED: getProvider() - no longer needed (click handler removed)

export function isNexusRelated(file: TFile): boolean {
    const frontmatter = app.metadataCache.getFileCache(file)?.frontmatter;
    return frontmatter?.nexus === "nexus-ai-chat-importer"; // Return true if the nexus matches
}

interface CustomError {
    message: string;
    name?: string;
}

interface ChatMessage {
    id: string;
    content?: {
        parts: any[];
        content_type?: string;
    };
}