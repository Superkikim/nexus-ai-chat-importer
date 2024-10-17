import { App, TFile } from "obsidian"; // Import necessary types from the Obsidian API
import crypto from "crypto"; // Node.js crypto module for hashing
import { CatalogEntry } from "../types"; // Import CatalogEntry type

/**
 * Handles file-related operations within the Obsidian application.
 */
class FileManager {
    private app: App;

    /**
     * Initializes the FileManager with the provided Obsidian app instance.
     * @param app The Obsidian app instance.
     */
    constructor(app: App) {
        this.app = app;
    }

    /**
     * Generates a SHA-256 hash for the specified file.
     * @param filePath The path of the file to hash.
     * @returns A promise that resolves to the file hash.
     */
    async generateFileHash(filePath: string): Promise<string> {
        const file = this.app.vault.getAbstractFileByPath(filePath);
        if (file instanceof TFile) {
            const fileBuffer = await this.app.vault.read(file); // Read file content using Obsidian API
            const hash = crypto.createHash("sha256");
            hash.update(fileBuffer);
            return hash.digest("hex");
        }
        throw new Error("File not found or not a valid file.");
    }

    /**
     * Checks if the given entry is managed by comparing the file hash.
     * @param entry The catalog entry to check.
     * @param currentFileHash The current hash of the file.
     * @returns True if the file is managed, otherwise false.
     */
    isFileManaged(entry: CatalogEntry, currentFileHash: string): boolean {
        return entry.fileHash === currentFileHash;
    }

    /**
     * Creates a file with the specified path and content.
     * @param filePath The path where the new file should be created.
     * @param content The content to write to the new file.
     */
    async createFile(filePath: string, content: string): Promise<void> {
        await this.app.vault.create(filePath, content); // Create the file using Obsidian's Vault API
    }
}

export { FileManager }; // Export the FileManager class
