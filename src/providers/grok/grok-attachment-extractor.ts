// SPDX-License-Identifier: GPL-3.0-or-later
//
// Grok stores every file under `prod-mc-asset-server/<asset id>/content`,
// with neither a name nor a type: the type comes from the bytes
// (writeZipEntryToVault), the name from the ids.
//
// An Imagine post's media is the asset named after the post, plus any image
// whose EXIF Artist carries the post id (the variants Grok generated beside
// it, which the export keeps without any other reference).
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
import { readJpegExifArtist } from "../../utils/jpeg-exif";

const ASSET_PATH_RE = /(?:^|\/)prod-mc-asset-server\/+([^/]+)\/content$/;

export class GrokAttachmentExtractor {
    private assetPaths = new WeakMap<ZipArchiveReader, Map<string, string>>();
    private variantsByPost = new WeakMap<
        ZipArchiveReader,
        Map<string, string[]>
    >();

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
                if (attachment.providerMetadata?.imaginePost === true) {
                    processed.push(
                        ...(await this.processImagineMedia(
                            zip,
                            conversationId,
                            attachment,
                            messageId
                        ))
                    );
                } else {
                    processed.push(
                        await this.processAttachment(
                            zip,
                            conversationId,
                            attachment,
                            messageId
                        )
                    );
                }
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

        return this.writeAsset(
            zip,
            zipPath,
            assetId,
            conversationId,
            attachment,
            messageId
        );
    }

    /** The post's own asset, then its variants; a placeholder if neither. */
    private async processImagineMedia(
        zip: ZipArchiveReader,
        conversationId: string,
        attachment: StandardAttachment,
        messageId?: string
    ): Promise<StandardAttachment[]> {
        const postId = attachment.fileId || attachment.fileName;
        const paths = await this.getAssetPaths(zip);
        const assetIds = [
            ...(paths.has(postId) ? [postId] : []),
            ...((await this.getVariantsByPost(zip)).get(postId) ?? []),
        ];

        if (assetIds.length === 0) {
            return [this.missing(attachment)];
        }

        const written: StandardAttachment[] = [];
        for (const assetId of assetIds) {
            written.push(
                await this.writeAsset(
                    zip,
                    paths.get(assetId)!,
                    assetId,
                    conversationId,
                    attachment,
                    messageId
                )
            );
        }
        return written;
    }

    private async writeAsset(
        zip: ZipArchiveReader,
        zipPath: string,
        assetId: string,
        conversationId: string,
        attachment: StandardAttachment,
        messageId?: string
    ): Promise<StandardAttachment> {
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

    /**
     * Post id → ids of the images signed with it, read once per archive, and
     * only when the archive holds an Imagine post to resolve.
     */
    private async getVariantsByPost(
        zip: ZipArchiveReader
    ): Promise<Map<string, string[]>> {
        let variants = this.variantsByPost.get(zip);
        if (variants) return variants;

        variants = new Map();
        for (const [assetId, path] of await this.getAssetPaths(zip)) {
            const entry = zip.get(path);
            if (!entry) continue;
            let artist: string | null = null;
            try {
                artist = readJpegExifArtist(await entry.readBytes());
            } catch (error) {
                this.logger.warn(
                    `Could not read Grok asset metadata: ${path}`,
                    error instanceof Error ? error.message : String(error)
                );
            }
            if (!artist || artist === assetId) continue;
            const list = variants.get(artist) ?? [];
            list.push(assetId);
            variants.set(artist, list);
        }
        for (const list of variants.values()) list.sort();

        this.variantsByPost.set(zip, variants);
        return variants;
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
