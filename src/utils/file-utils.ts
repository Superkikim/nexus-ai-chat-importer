// utils/file-utils.ts

import { TFile, TFolder, App } from "obsidian";
import { Logger } from "./logger";
import { formatTimestamp } from "./date-utils";
import { PluginSettings } from "../types";
import { formatTitle } from "./string-utils";

const logger = new Logger();

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
            } catch (error: unknown) {
                // Check if the error is an instance of Error
                if (error instanceof Error) {
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
                } else {
                    // Handle the case where the error is not an instance of Error
                    logger.error(
                        `Failed to create folder: ${currentPath}`,
                        "Unknown error occurred"
                    );
                    return {
                        success: false,
                        error: `Failed to create folder: ${currentPath}. Unknown error occurred`,
                    };
                }
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

export async function writeToFile(
    filePath: string,
    content: string,
    app: App
): Promise<void> {
    try {
        const file = app.vault.getAbstractFileByPath(filePath); // Use filePath to fetch file

        if (file instanceof TFile) {
            // Update existing file
            await app.vault.modify(file, content);
        } else if (file instanceof TFolder) {
            // Handle the case where the path is a folder
            throw new Error(`Cannot write to '${filePath}'; it is a folder.`);
        } else {
            // Create a new file
            await app.vault.create(filePath, content);
        }
    } catch (error: unknown) {
        if (error instanceof Error) {
            // Type guard to handle standard errors
            logger.error(
                `Error creating or modifying file '${filePath}': ${error.message}`
            );
        } else {
            logger.error(
                `Unexpected error when writing to file '${filePath}'.`
            );
        }
        throw error; // Propagate the error
    }
}

export function generateFileName(title: string): string {
    let fileName = formatTitle(title)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[<>:"\/\\|?*\n\r]+/g, "");

    return fileName;
}

export async function generateFilePath(
    title: string,
    createdTime: number,
    prefixFormat: string,
    archivePath: string,
    app: App,
    settings: PluginSettings
): Promise<string> {
    const date = new Date(createdTime * 1000);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");

    const folderPath = `${archivePath}/${year}/${month}`;
    const folderResult = await ensureFolderExists(folderPath, app.vault);
    if (!folderResult.success) {
        throw new Error(
            folderResult.error || "Failed to ensure folder exists."
        );
    }

    let fileName = generateFileName(title) + ".md";

    if (settings.addDatePrefix) {
        const day = String(date.getDate()).padStart(2, "0");
        let prefix = "";

        if (prefixFormat === "YYYY-MM-DD") {
            prefix = `${year}-${month}-${day}`;
        } else if (prefixFormat === "YYYYMMDD") {
            prefix = `${year}${month}${day}`;
        }

        fileName = `${prefix} - ${fileName}`;
    }

    let filePath = `${folderPath}/${fileName}`;

    if (await doesFilePathExist(filePath, app.vault)) {
        filePath = await generateUniqueFileName(filePath, app.vault.adapter);
    }

    return filePath;
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

export function addPrefix(
    filename: string,
    timeStamp: number,
    dateFormat: "prefix" | "date" | "time" // Specify the accepted literal types
): string {
    const timeStampStr = formatTimestamp(timeStamp, dateFormat); // Use the specified format
    if (timeStampStr) {
        filename = `${timeStampStr} - ${filename}`;
    }
    return filename; // Return the filename with prefix if applicable
}

