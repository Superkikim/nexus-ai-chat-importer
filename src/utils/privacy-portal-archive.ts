import { createZipArchiveReader, ZipArchiveReader } from "./zip-loader";
import { classifyArchiveEntries } from "./zip-content-reader";

export type ZipReaderFactory = (file: File) => Promise<ZipArchiveReader>;

export interface PrivacyPortalArchiveExpansionResult {
    files: File[];
    expandedContainerNames: string[];
}

const PRIVACY_PORTAL_CONTAINER_PATTERN = /^chatgpt_archive(?:_.+)?\.zip$/i;
const PRIVACY_PORTAL_CONVERSATION_PATTERN =
    /^Conversations_.+-chatgpt-\d+(?: \(\d+\))?\.zip$/i;
const PRIVACY_PORTAL_FILES_PATTERN = /^Files_.+-files-\d+(?: \(\d+\))?\.zip$/i;

function getBaseName(path: string): string {
    return path.split("/").pop() ?? path;
}

function isPrivacyPortalInnerArchive(path: string): boolean {
    const baseName = getBaseName(path);
    return (
        PRIVACY_PORTAL_CONVERSATION_PATTERN.test(baseName) ||
        PRIVACY_PORTAL_FILES_PATTERN.test(baseName)
    );
}

function isConversationArchive(file: File): boolean {
    return PRIVACY_PORTAL_CONVERSATION_PATTERN.test(file.name);
}

export function isOpenAiPrivacyPortalFilesArchive(file: File): boolean {
    return PRIVACY_PORTAL_FILES_PATTERN.test(file.name);
}

export function includeOpenAiPrivacyPortalFileArchives(
    importFiles: File[],
    selectedFiles: File[]
): File[] {
    const result = [...importFiles];
    const includedNames = new Set(importFiles.map((file) => file.name));

    for (const file of selectedFiles) {
        if (
            isOpenAiPrivacyPortalFilesArchive(file) &&
            !includedNames.has(file.name)
        ) {
            result.push(file);
            includedNames.add(file.name);
        }
    }

    return result;
}

function toFilePart(bytes: Uint8Array): ArrayBuffer {
    return bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength
    ) as ArrayBuffer;
}

function makeUniqueFileName(name: string, usedNames: Set<string>): string {
    if (!usedNames.has(name)) {
        usedNames.add(name);
        return name;
    }

    const extensionIndex = name.toLowerCase().lastIndexOf(".zip");
    const stem = extensionIndex >= 0 ? name.slice(0, extensionIndex) : name;
    const extension = extensionIndex >= 0 ? name.slice(extensionIndex) : "";
    let counter = 2;
    let candidate = `${stem} (${counter})${extension}`;
    while (usedNames.has(candidate)) {
        counter++;
        candidate = `${stem} (${counter})${extension}`;
    }

    usedNames.add(candidate);
    return candidate;
}

async function expandPrivacyPortalContainer(
    file: File,
    readerFactory: ZipReaderFactory,
    usedNames: Set<string>
): Promise<File[] | null> {
    if (!PRIVACY_PORTAL_CONTAINER_PATTERN.test(file.name)) {
        return null;
    }

    try {
        const pendingUsedNames = new Set(usedNames);
        const outerReader = await readerFactory(file);
        const entries = await outerReader.listEntries();
        const innerEntries = entries
            .filter((entry) => isPrivacyPortalInnerArchive(entry.path))
            .sort((a, b) => {
                const aConversation = PRIVACY_PORTAL_CONVERSATION_PATTERN.test(
                    getBaseName(a.path)
                );
                const bConversation = PRIVACY_PORTAL_CONVERSATION_PATTERN.test(
                    getBaseName(b.path)
                );
                if (aConversation !== bConversation) {
                    return aConversation ? -1 : 1;
                }
                return a.path.localeCompare(b.path);
            });

        if (innerEntries.length === 0) {
            return null;
        }

        const innerFiles: File[] = [];
        for (const entry of innerEntries) {
            const handle = outerReader.get(entry.path);
            if (!handle) {
                return null;
            }

            const bytes = await handle.readBytes();
            const name = makeUniqueFileName(
                getBaseName(entry.path),
                pendingUsedNames
            );
            innerFiles.push(
                new File([toFilePart(bytes)], name, {
                    type: "application/zip",
                    lastModified: file.lastModified,
                })
            );
        }

        const conversationFiles = innerFiles.filter(isConversationArchive);
        if (conversationFiles.length === 0) {
            return null;
        }

        for (const conversationFile of conversationFiles) {
            const innerReader = await readerFactory(conversationFile);
            const innerEntries = await innerReader.listEntries();
            const classification = classifyArchiveEntries(
                innerEntries.map((entry) => entry.path)
            );
            if (
                !classification.supported ||
                classification.provider !== "chatgpt"
            ) {
                return null;
            }
        }

        for (const innerFile of innerFiles) {
            usedNames.add(innerFile.name);
        }

        return innerFiles;
    } catch {
        return null;
    }
}

export async function expandOpenAiPrivacyPortalArchives(
    files: File[],
    readerFactory: ZipReaderFactory = createZipArchiveReader
): Promise<PrivacyPortalArchiveExpansionResult> {
    const expandedFiles: File[] = [];
    const expandedContainerNames: string[] = [];
    const usedNames = new Set(
        files
            .filter((file) => !PRIVACY_PORTAL_CONTAINER_PATTERN.test(file.name))
            .map((file) => file.name)
    );

    for (const file of files) {
        const innerFiles = await expandPrivacyPortalContainer(
            file,
            readerFactory,
            usedNames
        );
        if (!innerFiles) {
            expandedFiles.push(file);
            usedNames.add(file.name);
            continue;
        }

        expandedFiles.push(...innerFiles);
        expandedContainerNames.push(file.name);
    }

    return {
        files: expandedFiles,
        expandedContainerNames,
    };
}
