// SPDX-License-Identifier: GPL-3.0-or-later
//
// Converts a normalized ChatGPT library entry into a StandardAttachment.
//
// This is the ONLY place that builds attachments from library_files.json
// entries. Final rendering stays the responsibility of the shared formatter
// and the ChatGPT attachment extractor — this module only produces the
// attachment model (including, for generated images, the same callout
// template legacy DALL-E imports use, so both render identically).

import { StandardAttachment } from "../../types/standard";
import { sanitizeFileName } from "../../utils/file-utils";
import {
    ChatGPTLibraryArtifactKind,
    ChatGPTLibraryEntry,
} from "./chatgpt-library-index";

/**
 * Generated-image callout template shared with legacy DALL-E imports.
 *
 * The `{{FILENAME}}` / `{{FILETYPE}}` / `{{FILESIZE}}` / `{{URL}}` tokens are
 * substituted by ChatGPTAttachmentExtractor once the payload is written to the
 * vault, and replaced by an "Image Not Found" callout when it is not. Keep this
 * byte-identical to ChatGPTDalleProcessor.createDalleAttachment() — the
 * extractor matches the attachment half with a regex.
 */
function buildGeneratedImageContent(prompt: string): string {
    const formattedPrompt = prompt.split("\n").join("\n>> ");
    return `>>[!nexus_prompt] **Image prompt**
>> \`\`\`
>> ${formattedPrompt}
>> \`\`\`
>
>>[!nexus_attachment] **{{FILENAME}}** ({{FILETYPE}}) - {{FILESIZE}}
>> ![[{{URL}}]]`;
}

/**
 * Build a StandardAttachment for a supported library entry.
 *
 * @param entry - normalized library entry
 * @param kind - classification from classifyChatGPTLibraryArtifact()
 * @param prompt - generation prompt, when one could be associated safely
 *
 * Library-internal identifiers are kept in `providerMetadata` (used for
 * deduplication) and never surface in rendered note text.
 */
export function createLibraryAttachment(
    entry: ChatGPTLibraryEntry,
    kind: Exclude<ChatGPTLibraryArtifactKind, "unsupported">,
    prompt?: string
): StandardAttachment {
    // Library names can carry a path-like prefix; keep only the base name.
    const baseName = entry.fileName.split("/").pop() || entry.fileName;

    const attachment: StandardAttachment = {
        fileName: sanitizeFileName(baseName),
        fileType: entry.mimeType || "application/octet-stream",
        fileId: entry.fileId,
        providerMetadata: {
            library: {
                libraryFileId: entry.libraryFileId,
                artifactType: entry.artifactType,
                imageGenerationId: entry.imageGenerationId,
            },
        },
    };

    if (entry.fileSize !== undefined) {
        attachment.fileSize = entry.fileSize;
    }

    if (kind === "generated_image") {
        attachment.attachmentType = "generated_image";
        const trimmed = (prompt || "").trim();
        if (trimmed) {
            attachment.generationPrompt = trimmed;
            attachment.extractedContent = buildGeneratedImageContent(trimmed);
        }
        // Without a prompt we intentionally leave extractedContent unset so the
        // shared formatter renders the standard attachment callout (real file
        // name, type, size and an embedded image) — same as legacy DALL-E
        // images that carry no prompt.
    }

    // Generated documents deliberately carry no extractedContent: the shared
    // formatter renders name, type, size and an Obsidian link to the extracted
    // file, which is the existing Canvas-report presentation.

    return attachment;
}
