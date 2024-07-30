// utils.ts
import { moment } from "obsidian";

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
            return date.format("LT");
    }
}

export function getYearMonthFolder(unixTime: number): string {
    const date = new Date(unixTime * 1000);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    return `${year}/${month}`;
}

export function formatTitle(title: string): string {
    return title.trim() || "Untitled"; // Just trim whitespace; retain spaces and characters for readability
}

export function getFileName(title: string): string {
  let fileName = formatTitle(title)
      .normalize("NFD") // Normalize to decomposed characters
      .replace(/[\u0300-\u036f]/g, "") // Remove accents/diacritics
      .replace(/[<>:"\/\\|?*\n\r]+/g, "_") // Replaces illegal characters with underscores

  return `${fileName}.md`; // Return formatted filename
}


export async function getUniqueFileName(
    fileName: string,
    folderPath: string,
    vaultAdapter: any
): Promise<string> {
    console.log("[SLICE] fileName received:", fileName); // Add this log

    let uniqueFileName = fileName;
    let counter = 1;

    // Check for the existence of the file
    while (await vaultAdapter.exists(`${folderPath}/${uniqueFileName}`)) {
        // Remove the ".md" extension for adding a counter
        const nameWithoutExtension = uniqueFileName.slice(0, -3);
        uniqueFileName = `${nameWithoutExtension} (${counter++}).md`; // Append counter and retain .md
    }

    return uniqueFileName; // Return the unique file name
}

export async function getFileHash(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function addPrefix(
    filename: string,
    createTime: number,
    settings: PluginSettings
): string {
    console.log("[SLICE] filename passed to addPrefix:", filename); // Log the returned value
    if (settings.addDatePrefix) {
        const createTimeStr = formatTimestamp(createTime, settings.dateFormat); // Use the specified format
        filename = `${createTimeStr} - ${filename}`;
    }
    console.log("[SLICE] Returning prefixed file name:", filename); // Log the returned value
    return filename; // Return the filename, with prefix if applicable
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
