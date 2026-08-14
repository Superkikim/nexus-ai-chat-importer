// SPDX-License-Identifier: GPL-3.0-or-later
//
// ChatGPT library-file index (2026 export format).
//
// The new export ships a "library_files.json" describing files held in the
// user's file library / knowledge store: user uploads AND assistant-generated
// content (Canvas documents, generated images). Each entry links back to a
// message via "origination_message_id" and to a conversation via
// "origination_thread_id" rather than the usual message "metadata.attachments"
// array — so generated content is otherwise invisible to the converter. This
// index lets the adapter (and, downstream, the reconciler) attach those files
// to the message or conversation that produced them.
//
// This module is the single place that interprets raw library_files.json
// fields. Every other module must consume ChatGPTLibraryEntry / the indexes
// below rather than reading raw record fields itself.

import { ZipArchiveReader } from "../../utils/zip-loader";
import { ScopedLogger, logger } from "../../logger";

const LIBRARY_INDEX_FILE = "library_files.json";

const libraryLogger: ScopedLogger = logger.child("ChatGPTLibraryIndex");

/**
 * Known `library_artifact_type` values that identify assistant-generated
 * documents (e.g. a Canvas .docx). Kept as an explicit allowlist rather than
 * inferred from MIME type.
 */
const GENERATED_DOCUMENT_ARTIFACT_TYPES = new Set(["report"]);

/**
 * Known `library_artifact_type` values that are neither a generated document
 * nor (by themselves) a generated image signal. Present so an unrecognized
 * future type can be told apart from a value we already understand and have
 * deliberately chosen not to inject.
 *
 * - "writing_block": user-pasted Canvas content, already present in the
 *   owning message's own attachments — re-injecting it would duplicate it.
 * - "image": present on generated images, but only `image_gen_generation_id`
 *   is treated as the reliable signal (see classifyChatGPTLibraryArtifact).
 */
const KNOWN_NON_GENERATED_ARTIFACT_TYPES = new Set(["writing_block", "image"]);

/** One file described by library_files.json, normalized. */
export interface ChatGPTLibraryEntry {
    /** Library-internal id, e.g. "libfile_...", from the raw `id.id` field. */
    libraryFileId?: string;
    /** File id, e.g. "file_0000000044c071f491e2d28bb4f6a09f" (matches "<id>.dat" in the ZIP). */
    fileId: string;
    /** Original file name, e.g. "lettre_opposition_isabelle_bally.docx". */
    fileName: string;
    /** MIME type when present. */
    mimeType?: string;
    /** Payload size in bytes, when the export reports it. */
    fileSize?: number;
    /** Library category/artifact type, e.g. "report" for generated documents. */
    artifactType?: string;
    /** Library artifact subtype, when the export provides one. */
    artifactSubtype?: string;
    /** Coarse library category, e.g. "image", "text", "pdf", "other". */
    category?: string;
    /** Message that produced/owns this file, when known. */
    originationMessageId?: string;
    /** Conversation that owns this file, when known (present even if the
     * originating message itself was omitted from the export). */
    originationThreadId?: string;
    /** Generation identifier for assistant-generated images. Presence is the
     * strongest signal that this entry is a generated image. */
    imageGenerationId?: string;
    /** Creation time in epoch milliseconds, when parseable. */
    createdAt?: number;
    /** Current version number, when the export tracks file versions. */
    currentVersionNumber?: number;
    /** Source version number, when the export tracks file versions. */
    sourceVersionNumber?: number;
}

/**
 * Index built from library_files.json. Maps origination message id,
 * origination conversation id, and file id to their library entries.
 */
export interface ChatGPTLibraryIndex {
    byOriginationMessageId: Map<string, ChatGPTLibraryEntry[]>;
    byOriginationThreadId: Map<string, ChatGPTLibraryEntry[]>;
    byFileId: Map<string, ChatGPTLibraryEntry>;
}

/** Supported artifact classifications used to decide whether an entry
 * belongs in the reconciliation pipeline. */
export type ChatGPTLibraryArtifactKind =
    | "generated_image"
    | "generated_document"
    | "unsupported";

function readString(
    record: Record<string, unknown>,
    key: string
): string | undefined {
    const value = record[key];
    return typeof value === "string" && value ? value : undefined;
}

function readNumber(
    record: Record<string, unknown>,
    key: string
): number | undefined {
    const value = record[key];
    return typeof value === "number" ? value : undefined;
}

function readLibraryFileId(
    record: Record<string, unknown>
): string | undefined {
    const idField = record.id;
    if (typeof idField !== "object" || idField === null) return undefined;
    const nested = (idField as Record<string, unknown>).id;
    return typeof nested === "string" && nested ? nested : undefined;
}

/** Parse an ISO 8601 timestamp string to epoch milliseconds, or undefined. */
function parseTimestamp(value: unknown): number | undefined {
    if (typeof value !== "string" || !value) return undefined;
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? undefined : parsed;
}

/**
 * Resolve the entry's creation time, falling back through the export's
 * redundant timestamp fields when the primary one is missing or unparsable.
 */
function readCreatedAt(record: Record<string, unknown>): number | undefined {
    return (
        parseTimestamp(record.created_at) ??
        parseTimestamp(record.record_creation_time) ??
        parseTimestamp(record.version_created_at) ??
        parseTimestamp(record.file_processed_time)
    );
}

function normalizeLibraryEntry(raw: unknown): ChatGPTLibraryEntry | null {
    if (typeof raw !== "object" || raw === null) return null;
    const record = raw as Record<string, unknown>;

    const fileId = readString(record, "file_id");
    const fileName = readString(record, "file_name");
    if (!fileId || !fileName) return null;

    return {
        libraryFileId: readLibraryFileId(record),
        fileId,
        fileName,
        mimeType: readString(record, "mime_type"),
        fileSize: readNumber(record, "file_size_bytes"),
        artifactType: readString(record, "library_artifact_type"),
        artifactSubtype: readString(record, "library_artifact_subtype"),
        category: readString(record, "library_file_category"),
        originationMessageId: readString(record, "origination_message_id"),
        originationThreadId: readString(record, "origination_thread_id"),
        imageGenerationId: readString(record, "image_gen_generation_id"),
        createdAt: readCreatedAt(record),
        currentVersionNumber: readNumber(record, "current_version_number"),
        sourceVersionNumber: readNumber(record, "source_version_number"),
    };
}

/**
 * Classify a normalized library entry into the kinds the reconciliation
 * pipeline supports. Explicit rules only — no guessing from MIME type or
 * file name.
 *
 * - `library_artifact_type === "report"` is a known generated-document type.
 * - A present `imageGenerationId` is the strong generated-image signal,
 *   independent of artifact type (ordinary uploads never carry one).
 * - Known non-generated types ("writing_block", plain uploads, and "image"
 *   without a generation id) are "unsupported" without logging — they are
 *   understood, not unknown.
 * - Any other non-null artifact type is logged at debug level and treated as
 *   "unsupported" so an import never fails on a future/unrecognized type.
 */
export function classifyChatGPTLibraryArtifact(
    entry: ChatGPTLibraryEntry,
    log: ScopedLogger = libraryLogger
): ChatGPTLibraryArtifactKind {
    if (
        entry.artifactType &&
        GENERATED_DOCUMENT_ARTIFACT_TYPES.has(entry.artifactType)
    ) {
        return "generated_document";
    }

    if (entry.imageGenerationId) {
        return "generated_image";
    }

    if (!entry.artifactType) {
        return "unsupported";
    }

    if (KNOWN_NON_GENERATED_ARTIFACT_TYPES.has(entry.artifactType)) {
        return "unsupported";
    }

    log.debug("Unknown ChatGPT library artifact type ignored", {
        artifactType: entry.artifactType,
        fileId: entry.fileId,
    });
    return "unsupported";
}

/**
 * Load and parse library_files.json from a ChatGPT export ZIP.
 *
 * Returns null for old-format exports (file absent) or unparseable content, so
 * callers treat "no library index" as "nothing extra to inject". Building the
 * index never reads file payloads (`.dat` entries).
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
    const byOriginationThreadId = new Map<string, ChatGPTLibraryEntry[]>();
    const byFileId = new Map<string, ChatGPTLibraryEntry>();

    for (const raw of parsed) {
        const libEntry = normalizeLibraryEntry(raw);
        if (!libEntry) continue;

        if (!byFileId.has(libEntry.fileId)) {
            byFileId.set(libEntry.fileId, libEntry);
        }

        if (libEntry.originationMessageId) {
            const list =
                byOriginationMessageId.get(libEntry.originationMessageId) ?? [];
            list.push(libEntry);
            byOriginationMessageId.set(libEntry.originationMessageId, list);
        }

        if (libEntry.originationThreadId) {
            const list =
                byOriginationThreadId.get(libEntry.originationThreadId) ?? [];
            list.push(libEntry);
            byOriginationThreadId.set(libEntry.originationThreadId, list);
        }
    }

    return { byOriginationMessageId, byOriginationThreadId, byFileId };
}
