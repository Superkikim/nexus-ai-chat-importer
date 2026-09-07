import { logger } from "../logger";
import { classifyArchiveEntries } from "./zip-content-reader";
import { createZipArchiveReader, sliceStoredZipEntry } from "./zip-loader";

const containerLogger = logger.child("ContainerArchive");

/**
 * The conversation archive nested inside an OpenAI account-level ("Privacy
 * Portal") download. The container's own filename is deliberately not matched:
 * OpenAI delivers it under at least two different names for the same product,
 * so it carries no usable signal. This entry name does.
 *
 * The sibling `Files__*-files-NNNN.zip` archive is ignored on purpose: the
 * conversation archive already carries every attachment as a root-level `.dat`,
 * and the observed `Files__` archive held only an unreferenced custom-GPT
 * avatar.
 */
const NESTED_CONVERSATION_ARCHIVE = /-chatgpt-\d+[^/]*\.zip$/i;

function baseName(path: string): string {
    return path.split("/").pop() || path;
}

export interface ContainerExpansionResult {
    /** Selected files, with any recognised container replaced by its contents. */
    files: File[];
    /** Names of the containers that were expanded, for logging. */
    expandedContainers: string[];
}

/** Locates the conversation archives nested inside a container, at any depth. */
export function findNestedConversationArchives(entryPaths: string[]): string[] {
    return entryPaths
        .filter((path) => NESTED_CONVERSATION_ARCHIVE.test(baseName(path)))
        .sort();
}

function makeUniqueName(name: string, used: Set<string>): string {
    if (!used.has(name)) {
        used.add(name);
        return name;
    }

    const extensionIndex = name.toLowerCase().lastIndexOf(".zip");
    const stem = extensionIndex >= 0 ? name.slice(0, extensionIndex) : name;
    const extension = extensionIndex >= 0 ? name.slice(extensionIndex) : "";

    let counter = 2;
    while (used.has(`${stem} (${counter})${extension}`)) {
        counter++;
    }

    const unique = `${stem} (${counter})${extension}`;
    used.add(unique);
    return unique;
}

function renamed(file: File, name: string): File {
    if (file.name === name) return file;
    return new File([file], name, {
        type: file.type,
        lastModified: file.lastModified,
    });
}

/**
 * Attempts to expand one container. Returns `null` to mean "not a container,
 * or not one we can safely expand" — in which case the caller keeps the
 * original file untouched, preserving today's guidance message.
 */
async function expandContainer(
    file: File,
    usedNames: Set<string>
): Promise<File[] | null> {
    let entryPaths: string[];
    try {
        const reader = await createZipArchiveReader(file);
        entryPaths = (await reader.listEntries()).map((entry) => entry.path);
    } catch (error) {
        containerLogger.debug("Could not read archive while probing", {
            fileName: file.name,
            message: error instanceof Error ? error.message : String(error),
        });
        return null;
    }

    // Fast path: an ordinary export classifies straight away and is never
    // scanned for nested archives. Anything unsupported is a candidate:
    // keying off one specific `reason` would miss containers that happen to
    // carry a stray .json alongside their nested archives.
    if (classifyArchiveEntries(entryPaths).supported) {
        return null;
    }

    const conversations = findNestedConversationArchives(entryPaths);
    if (conversations.length === 0) {
        return null;
    }

    // If any archive cannot be read in place the container is left alone rather
    // than imported half-way.
    const sliced: File[] = [];
    for (const entryPath of conversations) {
        const innerFile = await sliceStoredZipEntry(file, entryPath);
        if (!innerFile) {
            containerLogger.info(
                "Container left untouched: conversation archive is not readable in place",
                { fileName: file.name, entryPath }
            );
            return null;
        }
        sliced.push(innerFile);
    }

    // Every conversation archive must be a real, supported export before the
    // container is replaced. A partial match leaves the original guidance in
    // place instead of importing something unexpected.
    for (const innerFile of sliced) {
        try {
            const reader = await createZipArchiveReader(innerFile);
            const innerPaths = (await reader.listEntries()).map(
                (entry) => entry.path
            );
            const innerClassification = classifyArchiveEntries(innerPaths);
            if (!innerClassification.supported) {
                containerLogger.info(
                    "Container left untouched: nested archive is not a supported export",
                    {
                        fileName: file.name,
                        innerName: innerFile.name,
                        reason: innerClassification.reason,
                    }
                );
                return null;
            }
        } catch (error) {
            containerLogger.warn("Failed to validate nested archive", {
                fileName: file.name,
                innerName: innerFile.name,
                message: error instanceof Error ? error.message : String(error),
            });
            return null;
        }
    }

    return sliced.map((innerFile) =>
        renamed(innerFile, makeUniqueName(innerFile.name, usedNames))
    );
}

/**
 * Replaces container archives in a selection with the conversation archives
 * they carry, leaving everything else untouched.
 *
 * Ordinary exports pay only a central-directory read: they classify as
 * supported and are returned as-is without being scanned for nested archives.
 */
export async function expandContainerArchives(
    files: File[]
): Promise<ContainerExpansionResult> {
    const result: File[] = [];
    const expandedContainers: string[] = [];
    const usedNames = new Set<string>();

    for (const file of files) {
        const expanded = await expandContainer(file, usedNames);

        if (!expanded) {
            // Left as-is on purpose: re-wrapping would drop the desktop `path`
            // property and push an ordinary export onto the Blob reader.
            usedNames.add(file.name);
            result.push(file);
            continue;
        }

        containerLogger.info("Expanded container archive", {
            containerName: file.name,
            innerArchives: expanded.map((inner) => inner.name),
        });
        result.push(...expanded);
        expandedContainers.push(file.name);
    }

    return { files: result, expandedContainers };
}
