// utils/string-utils.ts

import { App } from "obsidian";
import { doesFilePathExist, ensureFolderExists } from "./file-utils";
import { formatTimestamp } from "./date-utils";
import { PluginSettings } from "../types";

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
}

export function formatTitle(title: string): string {
    return title.trim() || "Untitled"; // Just trim whitespace; retain spaces and characters for readability
}

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
