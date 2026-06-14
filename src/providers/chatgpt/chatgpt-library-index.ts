// SPDX-License-Identifier: GPL-3.0-or-later
//
// ChatGPT library-file index (2026 export format).
//
// The new export ships a "library_files.json" describing files held in the
// user's file library / knowledge store: user uploads AND assistant-generated
// Canvas artifacts (documents, reports). Each entry links back to a message via
// "origination_message_id" rather than the usual message "metadata.attachments"
// array — so Canvas-generated documents (e.g. a generated .docx) are otherwise
// invisible to the converter. This index lets the adapter attach those files to
// the message that produced them.

import { ZipArchiveReader } from "../../utils/zip-loader";

const LIBRARY_INDEX_FILE = "library_files.json";

/** One file described by library_files.json. */
export interface ChatGPTLibraryEntry {
    /** File id, e.g. "file_0000000044c071f491e2d28bb4f6a09f" (matches "<id>.dat" in the ZIP). */
    fileId: string;
    /** Original file name, e.g. "lettre_opposition_isabelle_bally.docx". */
    fileName: string;
    /** MIME type when present. */
    mimeType?: string;
    /** Library category/artifact type, e.g. "report" for generated documents. */
    artifactType?: string;
    /** Message that produced/owns this file, when known. */
    originationMessageId?: string;
}

/**
 * Index built from library_files.json. Maps origination message id and file id
 * to their library entries.
 */
export interface ChatGPTLibraryIndex {
    byOriginationMessageId: Map<string, ChatGPTLibraryEntry[]>;
    byFileId: Map<string, ChatGPTLibraryEntry>;
}

/**
 * Load and parse library_files.json from a ChatGPT export ZIP.
 *
 * Returns null for old-format exports (file absent) or unparseable content, so
 * callers treat "no library index" as "nothing extra to inject".
 */
export async function buildChatGPTLibraryIndex(
    zip: ZipArchiveReader
): Promise<ChatGPTLibraryIndex | null> {
    const entry = zip.get(LIBRARY_INDEX_FILE);
    if (!entry) {
        return null;
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(await entry.readText());
    } catch {
        return null;
    }

    if (!Array.isArray(parsed)) {
        return null;
    }

    const byOriginationMessageId = new Map<string, ChatGPTLibraryEntry[]>();
    const byFileId = new Map<string, ChatGPTLibraryEntry>();

    for (const raw of parsed) {
        if (typeof raw !== "object" || raw === null) continue;
        const record = raw as Record<string, unknown>;

        const fileId = record.file_id;
        const fileName = record.file_name;
        if (typeof fileId !== "string" || !fileId) continue;
        if (typeof fileName !== "string" || !fileName) continue;

        const libEntry: ChatGPTLibraryEntry = {
            fileId,
            fileName,
            mimeType:
                typeof record.mime_type === "string"
                    ? record.mime_type
                    : undefined,
            artifactType:
                typeof record.library_artifact_type === "string"
                    ? record.library_artifact_type
                    : undefined,
            originationMessageId:
                typeof record.origination_message_id === "string"
                    ? record.origination_message_id
                    : undefined,
        };

        if (!byFileId.has(fileId)) {
            byFileId.set(fileId, libEntry);
        }

        if (libEntry.originationMessageId) {
            const list =
                byOriginationMessageId.get(libEntry.originationMessageId) ?? [];
            list.push(libEntry);
            byOriginationMessageId.set(libEntry.originationMessageId, list);
        }
    }

    return { byOriginationMessageId, byFileId };
}
