import { logger } from "../../logger";
import {
    getLocalFileDataRange,
    readMobileZipEntries,
} from "./mobile-zip-reader";

const nestedZipLogger = logger.child("NestedZip");

/**
 * Wraps a ZIP entry that is *stored* (uncompressed) inside `outer` as a File,
 * without copying its bytes.
 *
 * Container downloads such as the OpenAI Privacy Portal archive embed the real
 * export as a stored entry, so the inner archive's bytes already exist verbatim
 * inside the outer file. Slicing a Blob yields a view rather than a copy, which
 * lets a 200 MB inner archive reach the normal import pipeline at no memory
 * cost.
 *
 * Returns `null` when the entry is missing, compressed, or claims a byte range
 * the outer file cannot satisfy — the bytes would have to be inflated or the
 * archive is malformed, so callers fall back instead of failing.
 */
export async function sliceStoredZipEntry(
    outer: File,
    entryPath: string
): Promise<File | null> {
    let entry;
    try {
        const entries = await readMobileZipEntries(
            outer,
            (name) => name === entryPath
        );
        entry = entries.find((candidate) => candidate.path === entryPath);
    } catch (error) {
        nestedZipLogger.warn("Failed to scan container archive", {
            containerName: outer.name,
            entryPath,
            message: error instanceof Error ? error.message : String(error),
        });
        return null;
    }

    if (!entry) {
        return null;
    }

    // Only stored entries can be addressed in place. Anything compressed would
    // need inflating first, which is exactly the allocation this avoids.
    if (entry.compressionMethod !== 0) {
        nestedZipLogger.info(
            "Nested archive is compressed and cannot be sliced in place",
            {
                containerName: outer.name,
                entryPath,
                compressionMethod: entry.compressionMethod,
            }
        );
        return null;
    }

    let dataStart: number;
    let compressedSize: number;
    try {
        // Reads the *local* header rather than trusting the central directory:
        // the two may declare different extra-field lengths.
        ({ dataStart, compressedSize } = await getLocalFileDataRange(
            outer,
            entry
        ));
    } catch (error) {
        nestedZipLogger.warn("Failed to locate nested archive data", {
            containerName: outer.name,
            entryPath,
            message: error instanceof Error ? error.message : String(error),
        });
        return null;
    }

    if (dataStart < 0 || dataStart + compressedSize > outer.size) {
        nestedZipLogger.warn(
            "Nested archive range falls outside the container",
            {
                containerName: outer.name,
                entryPath,
                dataStart,
                compressedSize,
                containerSize: outer.size,
            }
        );
        return null;
    }

    const fileName = entryPath.split("/").pop() || entryPath;
    return new File(
        [outer.slice(dataStart, dataStart + compressedSize)],
        fileName,
        { type: "application/zip", lastModified: outer.lastModified }
    );
}
