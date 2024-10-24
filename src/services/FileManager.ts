import { App, TFile } from "obsidian";
import crypto from "crypto";
import { CatalogEntry } from "../types";
import JSZip from "jszip";

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
        try {
            const file = this.app.vault.getAbstractFileByPath(filePath);
            if (file instanceof TFile) {
                const fileBuffer = await this.app.vault.read(file);
                const hash = crypto.createHash("sha256");
                hash.update(fileBuffer);
                return hash.digest("hex");
            } else {
                throw new Error(
                    "The specified path does not point to a valid file."
                );
            }
        } catch (error: any) {
            throw new Error(
                `Error generating file hash for '${filePath}': ${error.message}`
            );
        }
    }

    /**
     * Checks if the given entry is managed by comparing the file hash.
     * @param entry The catalog entry to check.
     * @param currentFileHash The current hash of the file.
     * @returns True if the file is managed, otherwise false.
     */
    isFileManaged(entry: CatalogEntry, currentFileHash: string): boolean {
        try {
            return entry.fileHash === currentFileHash;
        } catch (error: any) {
            throw new Error(
                `Error checking if file is managed: ${error.message}`
            );
        }
    }

    /**
     * Creates a file with the specified path as empty.
     * @param filePath The path where the new file should be created.
     */
    async createFile(filePath: string): Promise<void> {
        try {
            await this.app.vault.create(filePath, "");
        } catch (error: any) {
            throw new Error(
                `Error creating file at '${filePath}': ${error.message}`
            );
        }
    }

    /**
     * Reads the content of a file from the Obsidian vault.
     * @param filePath The path to the file to be read.
     * @returns A promise that resolves to the content of the file.
     */
    async readFile(filePath: string): Promise<string> {
        try {
            const file = this.app.vault.getAbstractFileByPath(filePath);
            if (file instanceof TFile) {
                return await this.app.vault.read(file);
            } else {
                throw new Error(
                    "The specified path does not point to a valid file."
                );
            }
        } catch (error: any) {
            throw new Error(
                `Error reading file at '${filePath}': ${error.message}`
            );
        }
    }

    /**
     * Lists the names of all files contained within a ZIP file.
     * @param file The File object representing the ZIP file.
     * @returns A promise that resolves to an array of file names in the ZIP.
     */
    async listZipFileContents(file: File): Promise<string[]> {
        const zip = new JSZip();
        try {
            const zipFile = await zip.loadAsync(file);
            return Object.keys(zipFile.files);
        } catch (error: any) {
            throw new Error(
                `Error listing ZIP file contents: ${error.message}`
            );
        }
    }

    /**
     * Extracts and parses a specified conversation file from a ZIP file.
     * @param file The File object representing the ZIP file.
     * @param conversationFileName The name of the conversation file to extract.
     * @returns A promise that resolves to the parsed JSON content of the conversation file.
     */
    async extractConversationFileFromZip(
        file: File,
        conversationFileName: string
    ): Promise<any> {
        const zip = new JSZip();
        try {
            const zipFile = await zip.loadAsync(file);
            const conversationFile = zipFile.file(conversationFileName);
            if (conversationFile) {
                const jsonString = await conversationFile.async("string");
                try {
                    return JSON.parse(jsonString);
                } catch (error: any) {
                    throw new Error(
                        `Failed to parse JSON in '${conversationFileName}': ${error.message}`
                    );
                }
            } else {
                throw new Error(
                    `Conversation file '${conversationFileName}' not found in the ZIP.`
                );
            }
        } catch (error: any) {
            throw new Error(
                `Error extracting conversation file from ZIP: ${error.message}`
            );
        }
    }
}

export default FileManager; // Default export
