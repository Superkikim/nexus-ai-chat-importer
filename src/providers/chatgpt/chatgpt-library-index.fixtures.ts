// SPDX-License-Identifier: GPL-3.0-or-later
//
// Anonymized sample entries mirroring `library_files.json` as observed in a
// ChatGPT export dated 2026-08-03. Field names and shapes are real; ids,
// file names, thread/message ids, and timestamps are fabricated.
//
// Observations from the real export (53 total entries):
//   - `image_gen_generation_id` is set on exactly the entries that are truly
//     assistant-generated images; it is null on every ordinary upload,
//     including uploaded images. It is the strongest generated-image signal.
//   - `library_artifact_type` is null for ordinary uploads. Observed non-null
//     values: "image" (generated image; always paired with a non-null
//     `image_gen_generation_id` in the sample), "report" (assistant-generated
//     document, e.g. a Canvas .docx), and "writing_block" (user-pasted Canvas
//     content already present in the owning message's own attachments list —
//     must not be re-injected).
//   - `library_artifact_subtype` was null on every observed entry.
//   - `library_file_category` is a coarse bucket ("image", "text", "pdf",
//     "other") independent of `library_artifact_type` and is not a reliable
//     generated-content signal on its own (ordinary uploads are also
//     categorized "image").
//   - `origination_message_id` links to the message that produced the file,
//     when that message is included in the export. `origination_thread_id`
//     links to the conversation and is present even when the message id is
//     not resolvable in the export (message omitted).
//   - `id.id` (an object, not a flat field) carries the library-internal id,
//     e.g. "libfile_...", distinct from `file_id` ("file_...", the id that
//     matches the `.dat` entry in the ZIP).
//   - `created_at` is the reliable creation timestamp; `record_creation_time`
//     and `version_created_at` were identical to it in every observed entry
//     and serve as fallbacks when `created_at` is missing or unparsable.
//   - `current_version_number` / `source_version_number` were null on every
//     observed entry in this export (no multi-version library files seen).

export const SANITIZED_GENERATED_IMAGE_ENTRY = {
    id: { id: "libfile_sample0000000000000000001" },
    file_id: "file_sample_generated_image_0001",
    file_name: "Sample generated artwork.png",
    mime_type: "image/png",
    library_file_category: "image",
    library_artifact_type: "image",
    library_artifact_subtype: null,
    origination_message_id: "msg-sample-assistant-0001",
    origination_thread_id: "thread-sample-conversation-0001",
    image_gen_generation_id: "gen-sample-0001",
    created_at: "2026-08-01T10:15:30.000000+00:00",
    record_creation_time: "2026-08-01T10:15:30.000000+00:00",
    version_created_at: "2026-08-01T10:15:30.000000+00:00",
    current_version_number: null,
    source_version_number: null,
};

export const SANITIZED_GENERATED_DOCUMENT_ENTRY = {
    id: { id: "libfile_sample0000000000000000002" },
    file_id: "file_sample_generated_report_0002",
    file_name: "Sample generated report.docx",
    mime_type:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    library_file_category: "other",
    library_artifact_type: "report",
    library_artifact_subtype: null,
    origination_message_id: "msg-sample-assistant-0002",
    origination_thread_id: "thread-sample-conversation-0002",
    image_gen_generation_id: null,
    created_at: "2026-07-15T09:00:00.000000+00:00",
    record_creation_time: "2026-07-15T09:00:00.000000+00:00",
    version_created_at: "2026-07-15T09:00:00.000000+00:00",
    current_version_number: null,
    source_version_number: null,
};

export const SANITIZED_WRITING_BLOCK_ENTRY = {
    id: { id: "libfile_sample0000000000000000003" },
    file_id: "file_sample_writing_block_0003",
    file_name: "Pasted markdown.md",
    mime_type: "text/markdown",
    library_file_category: "text",
    library_artifact_type: "writing_block",
    library_artifact_subtype: null,
    origination_message_id: "msg-sample-user-0003",
    origination_thread_id: "thread-sample-conversation-0003",
    image_gen_generation_id: null,
    created_at: "2026-06-10T08:30:00.000000+00:00",
    record_creation_time: "2026-06-10T08:30:00.000000+00:00",
    version_created_at: "2026-06-10T08:30:00.000000+00:00",
    current_version_number: null,
    source_version_number: null,
};

export const SANITIZED_PLAIN_UPLOAD_ENTRY = {
    id: { id: "libfile_sample0000000000000000004" },
    file_id: "file_sample_plain_upload_0004",
    file_name: "IMG_sample.jpeg",
    mime_type: "image/jpeg",
    library_file_category: "image",
    library_artifact_type: null,
    library_artifact_subtype: null,
    origination_message_id: null,
    origination_thread_id: null,
    image_gen_generation_id: null,
    created_at: "2026-05-01T12:00:00.000000+00:00",
    record_creation_time: "2026-05-01T12:00:00.000000+00:00",
    version_created_at: "2026-05-01T12:00:00.000000+00:00",
    current_version_number: null,
    source_version_number: null,
};

/** Hypothetical future artifact type, not in the current allowlist. */
export const SANITIZED_UNKNOWN_ARTIFACT_TYPE_ENTRY = {
    id: { id: "libfile_sample0000000000000000005" },
    file_id: "file_sample_unknown_artifact_0005",
    file_name: "Sample future artifact.bin",
    mime_type: "application/octet-stream",
    library_file_category: "other",
    library_artifact_type: "future_artifact_type",
    library_artifact_subtype: null,
    origination_message_id: "msg-sample-assistant-0005",
    origination_thread_id: "thread-sample-conversation-0005",
    image_gen_generation_id: null,
    created_at: "2026-08-02T12:00:00.000000+00:00",
    record_creation_time: "2026-08-02T12:00:00.000000+00:00",
    version_created_at: "2026-08-02T12:00:00.000000+00:00",
    current_version_number: null,
    source_version_number: null,
};

/** Entry missing `created_at`, exercising the timestamp fallback chain. */
export const SANITIZED_MISSING_CREATED_AT_ENTRY = {
    id: { id: "libfile_sample0000000000000000006" },
    file_id: "file_sample_missing_created_at_0006",
    file_name: "Sample fallback timestamp.png",
    mime_type: "image/png",
    library_file_category: "image",
    library_artifact_type: "image",
    library_artifact_subtype: null,
    origination_message_id: "msg-sample-assistant-0006",
    origination_thread_id: "thread-sample-conversation-0006",
    image_gen_generation_id: "gen-sample-0006",
    created_at: null,
    record_creation_time: null,
    version_created_at: "2026-08-02T13:00:00.000000+00:00",
    current_version_number: null,
    source_version_number: null,
};

export const SANITIZED_LIBRARY_FILES_SAMPLE = [
    SANITIZED_GENERATED_IMAGE_ENTRY,
    SANITIZED_GENERATED_DOCUMENT_ENTRY,
    SANITIZED_WRITING_BLOCK_ENTRY,
    SANITIZED_PLAIN_UPLOAD_ENTRY,
    SANITIZED_UNKNOWN_ARTIFACT_TYPE_ENTRY,
    SANITIZED_MISSING_CREATED_AT_ENTRY,
];
