// SPDX-License-Identifier: GPL-3.0-or-later
//
// Grok stores every file under `prod-mc-asset-server/<asset id>/content`,
// with neither a name nor a type: the type comes from the bytes
// (writeZipEntryToVault), the name from the ids.
//
// An asset the export does not carry keeps a visible placeholder: a missing
// upload links to the conversation, a missing Imagine media to its post.

import { StandardAttachment } from "../../types/standard";
import { ensureFolderExists } from "../../utils";
import { getFileCategory } from "../../utils/file-utils";
import { Logger } from "../../logger";
import type NexusAiChatImporterPlugin from "../../main";
import { ZipArchiveReader, writeZipEntryToVault } from "../../utils/zip-loader";
import { resolveAttachmentTarget } from "../../utils/attachment-target";
import { createMissingGeneratedImageAttachment } from "../../utils/generated-image-placeholder";

const ASSET_PATH_RE = /(?:^|\/)prod-mc-asset-server\/+([^/]+)\/content$/;

export class GrokAttachmentExtractor {
    private assetPaths = new WeakMap<ZipArchiveReader, Map<string, string>>();

    constructor(
        private plugin: NexusAiChatImporterPlugin,
        private logger: Logger
    ) {}

    async extractAttachments(
        zip: ZipArchiveReader,
        conversationId: string,
        attachments: StandardAttachment[],
        messageId?: string
    ): Promise<StandardAttachment[]> {
        const processed: StandardAttachment[] = [];

        for (const attachment of attachments) {
            try {
                processed.push(
                    await this.processAttachment(
                        zip,
                        conversationId,
                        attachment,
                        messageId
                    )
                );
            } catch (error) {
                const message =
                    error instanceof Error ? error.message : String(error);
                this.logger.error(
                    `Failed to process Grok attachment: ${attachment.fileName} (conversation: ${conversationId})`,
                    message
                );
                processed.push({
                    ...attachment,
                    status: {
                        processed: false,
                        found: false,
                        reason: "extraction_failed",
                        note: `Processing failed: ${message}`,
                    },
                });
            }
        }

        return processed;
    }

    private async processAttachment(
        zip: ZipArchiveReader,
        conversationId: string,
        attachment: StandardAttachment,
        messageId?: string
    ): Promise<StandardAttachment> {
        const assetId = attachment.fileId || attachment.fileName;
        const zipPath = (await this.getAssetPaths(zip)).get(assetId);

        if (!zipPath) {
            return this.missing(attachment);
        }

        const entry = zip.get(zipPath);
        if (!entry) {
            throw new Error(`Asset entry disappeared from ZIP: ${zipPath}`);
        }

        const baseName = `grok_${conversationId.substring(0, 8)}_${(
            messageId || "unknown"
        ).substring(0, 8)}_${assetId.substring(0, 8)}`;

        const writeResult = await writeZipEntryToVault(
            entry,
            async (detection, bytes) => {
                const fileName = detection.detectedExtension
                    ? `${baseName}.${detection.detectedExtension}`
                    : baseName;
                const folder = `${
                    this.plugin.settings.attachmentFolder
                }/grok/${getFileCategory(
                    fileName,
                    detection.detectedMimeType
                )}`;
                await ensureFolderExists(folder, this.plugin.app.vault);
                return resolveAttachmentTarget(
                    this.plugin.app.vault.adapter,
                    `${folder}/${fileName}`,
                    bytes
                );
            },
            this.plugin.app.vault
        );

        return {
            ...attachment,
            fileName: writeResult.targetPath.split("/").pop() ?? baseName,
            fileType: writeResult.detectedMimeType ?? attachment.fileType,
            fileSize: writeResult.byteLength,
            url: writeResult.targetPath,
            status: {
                processed: true,
                found: true,
                localPath: writeResult.targetPath,
            },
        };
    }

    /** A missing asset keeps a placeholder linking where it can be seen. */
    private missing(attachment: StandardAttachment): StandardAttachment {
        const imagine = attachment.providerMetadata?.imaginePost === true;
        if (imagine) {
            const isVideo = attachment.providerMetadata?.mediaType === "video";
            return {
                ...createMissingGeneratedImageAttachment(undefined, {
                    sourceUrl: attachment.url,
                    label: isVideo ? "Generated video" : "Generated image",
                    note: "This export did not include the Imagine media.",
                }),
                generationPrompt: attachment.generationPrompt,
            };
        }

        return {
            ...attachment,
            status: {
                processed: false,
                found: false,
                reason: "missing_from_export",
                note: `Asset not found in ZIP: ${attachment.fileId}`,
            },
        };
    }

    /** Asset id → ZIP path, listed once per archive. */
    private async getAssetPaths(
        zip: ZipArchiveReader
    ): Promise<Map<string, string>> {
        let paths = this.assetPaths.get(zip);
        if (!paths) {
            paths = new Map();
            for (const entry of await zip.listEntries()) {
                const match = entry.path.match(ASSET_PATH_RE);
                if (match) paths.set(match[1], entry.path);
            }
            this.assetPaths.set(zip, paths);
        }
        return paths;
    }
}
