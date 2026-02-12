import JSZip from "jszip";
import { Logger } from "../logger";

/**
 * Information about where an attachment file is located across multiple ZIPs
 */
export interface AttachmentLocation {
    /** Index of the ZIP file in the files array */
    zipIndex: number;
    /** Path of the file within the ZIP */
    path: string;
    /** Size of the file in bytes */
    size: number;
    /** Name of the source ZIP file */
    zipFileName: string;
}

/**
 * Map of file IDs to their locations across multiple ZIPs
 * Key: fileId (extracted from filename or asset_pointer)
 * Value: Array of locations (newest first, for fallback)
 */
export type AttachmentMap = Map<string, AttachmentLocation[]>;

/**
 * Service to build a map of attachment availability across multiple ZIP files
 * This enables fallback to older ZIPs when recent exports are missing files
 */
export class AttachmentMapBuilder {
    constructor(private logger: Logger) {}

    /**
     * Scan all ZIP files and build a map of available attachments
     * Processes ZIPs in order (oldest to newest) so newer versions are at the end
     */
    async buildAttachmentMap(files: File[]): Promise<AttachmentMap> {
        const attachmentMap: AttachmentMap = new Map();
        const JSZipModule = (await import('jszip')).default;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];

            try {
                const zip = new JSZipModule();
                const zipContent = await zip.loadAsync(file);

                // Scan all files in the ZIP
                for (const [path, zipFile] of Object.entries(zipContent.files)) {
                    if (zipFile.dir) continue;

                    // Extract potential file IDs from the path
                    const fileIds = this.extractFileIds(path);

                    for (const fileId of fileIds) {
                        if (!attachmentMap.has(fileId)) {
                            attachmentMap.set(fileId, []);
                        }

                        const locations = attachmentMap.get(fileId)!;
                        
                        // Add this location (will be in chronological order)
                        locations.push({
                            zipIndex: i,
                            path: path,
                            size: (zipFile as any)._data?.uncompressedSize || 0,
                            zipFileName: file.name
                        });
                    }
                }
            } catch (error) {
                this.logger.error(`Failed to scan attachments in ${file.name}:`, error);
            }
        }

        return attachmentMap;
    }

    /**
     * Extract all possible file IDs from a file path
     * Handles various ChatGPT export formats:
     * - file_XXXXX.dat → ["file_XXXXX", "XXXXX"]
     * - user-xxx/file_XXXXX-uuid.png → ["file_XXXXX", "XXXXX"]
     * - dalle-generations/xxx.png → ["xxx"]
     */
    private extractFileIds(path: string): string[] {
        const fileIds: string[] = [];
        const fileName = path.split('/').pop() || '';

        // Pattern 1: file_XXXXX.dat or file_XXXXX-uuid.ext
        const filePattern = /file_([a-f0-9]+)/i;
        const fileMatch = fileName.match(filePattern);
        if (fileMatch) {
            fileIds.push(`file_${fileMatch[1]}`); // Full ID with prefix
            fileIds.push(fileMatch[1]); // ID without prefix
        }

        // Pattern 2: XXXXX.dat (just the hash)
        const hashPattern = /^([a-f0-9]{32,})(?:[-.]|$)/i;
        const hashMatch = fileName.match(hashPattern);
        if (hashMatch && !fileMatch) { // Don't duplicate if already matched above
            fileIds.push(hashMatch[1]);
        }

        // Pattern 3: Full filename as ID (for exact matches)
        const baseFileName = fileName.replace(/\.(dat|png|jpg|jpeg|gif|webp)$/i, '');
        if (baseFileName && !fileIds.includes(baseFileName)) {
            fileIds.push(baseFileName);
        }

        return fileIds;
    }

    /**
     * Find the best location for a file ID
     * Returns the NEWEST available location (last in array)
     * Falls back to older locations if needed
     */
    findBestLocation(attachmentMap: AttachmentMap, fileId: string): AttachmentLocation | null {
        const locations = attachmentMap.get(fileId);
        if (!locations || locations.length === 0) {
            return null;
        }

        // Return the newest location (last in chronological order)
        return locations[locations.length - 1];
    }

    /**
     * Find all locations for a file ID (for debugging/logging)
     */
    findAllLocations(attachmentMap: AttachmentMap, fileId: string): AttachmentLocation[] {
        return attachmentMap.get(fileId) || [];
    }
}

