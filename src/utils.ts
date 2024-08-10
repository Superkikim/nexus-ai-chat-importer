// utils.ts
import { moment, App } from "obsidian";
import { PluginSettings } from "./types";

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
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[<>:"\/\\|?*\n\r]+/g, "");

    return fileName; // Return the sanitized filename based on title
}

export function addPrefix(
    filename: string,
    timeStamp: number,
    dateFormat: string
): string {
    console.log("[PREFIX] filename before prefix:", filename);
    const timeStampStr = formatTimestamp(timeStamp, dateFormat); // Use the specified format
    if (timeStampStr) {
        filename = `${timeStampStr} - ${filename}`;
    }
    console.log("[PREFIX] Returned:", filename);
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
export async function doesFilePathExist(filePath: string, vault: any): Promise<boolean> {
    const file = vault.getAbstractFileByPath(filePath);
    return file !== null; // Return true if the file exists, false otherwise
}

export async function getFileHash(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function isValidMessage(message: ChatMessage): boolean {
    return (
        message &&
        typeof message === "object" &&
        message.content &&
        typeof message.content === "object" &&
        Array.isArray(message.content.parts) &&
        message.content.parts.length > 0 &&
        message.content.parts.some(
            (part) => typeof part === "string" && part.trim() !== ""
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
            } catch (error: CustomError) {
                if (error.message !== "Folder already exists.") {
                    this.logger.error(
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
        } else if (!(currentFolder instanceof TFolder)) {
            return {
                success: false,
                error: `Path exists but is not a folder: ${currentPath}`,
            };
        }
    }
    return { success: true };
}

export async function checkConversationLink(conversationId: string): Promise<boolean> {
    const url = `https://chatgpt.com/c/${conversationId}`;
    try {
        const response = await fetch(url, { method: "HEAD" });
        
        // Log the response status
        console.log(`Checking link: ${url} - Status: ${response.status}`);
        
        return response.ok; // Returns true for status codes 200-299
    } catch (error) {
        console.error(`Error fetching ${url}:`, error);
        return false; // Return false in case of error (e.g., network issues)
    }
}

export function old_getConversationId(app: App): string | undefined {
    const activeFile = app.workspace.getActiveFile();
    if (activeFile) {
      const frontmatter = app.metadataCache.getFileCache(activeFile)?.frontmatter;
      return frontmatter?.conversation_id;
    }
    return undefined; // Return undefined if there is no active file
}

export function getConversationId(file: TFile): string | undefined {
    const frontmatter = app.metadataCache.getFileCache(file)?.frontmatter; // Use the passed file
    return frontmatter?.conversation_id; // Return the conversation_id from frontmatter
}

export function getProvider(file: TFile): string | undefined {
    const frontmatter = app.metadataCache.getFileCache(file)?.frontmatter; // Use the passed file
    return frontmatter?.provider; // Return the provider from frontmatter
}

export function isNexusRelated(file: TFile): boolean {
    const frontmatter = app.metadataCache.getFileCache(file)?.frontmatter; // Use the passed file
    return frontmatter?.nexus === "nexus-ai-chat-importer"; // Return true if the nexus matches
}

// Utility function to check if any currently active files are nexus-related
export function checkAnyNexusFilesActive(app: App): boolean {
    const leaves = app.workspace.getLeavesOfType('markdown');
    for (const leaf of leaves) {
        const file = leaf.view.file;
        if (file) {
            const frontmatter = app.metadataCache.getFileCache(file)?.frontmatter;
            if (frontmatter && frontmatter.nexus) {
                return true;
            }
        }
    }
    return false;
}


    