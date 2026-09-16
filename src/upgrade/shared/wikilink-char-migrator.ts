/**
 * Nexus AI Chat Importer - Obsidian Plugin
 * Copyright (C) 2024 Akim Sissaoui
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

// src/upgrade/shared/wikilink-char-migrator.ts
import { TFile } from "obsidian";
import { UpgradeContext, OperationResult } from "../upgrade-interface";
import {
    CONVERSATION_NOTE_FILENAME_MAX_BYTES,
    generateUniqueFileName,
} from "../../utils";
import {
    hasWikilinkStructuralChars,
    substituteWikilinkStructuralChars,
} from "../../utils/wikilink-safe-name";
import { LinkUpdateService } from "../../services/link-update-service";

export interface WikilinkCharScanResult {
    conversationFiles: TFile[];
    attachmentFiles: TFile[];
}

/**
 * Finds and fixes notes and attachments written (by an older version of the
 * plugin, or by 1.7.1 before this migration ran once) with `#`, `^`, `[` or
 * `]` in their filename — characters Obsidian cannot resolve inside a
 * wikilink, so every `[[path]]` pointing at one of these files is
 * permanently broken. See issue #83.
 *
 * Renaming alone isn't enough: every link that pointed at the old name has
 * to be repaired too — index/summary reports, Claude artifact frontmatter
 * cross-links, and the attachment embeds inside conversation notes
 * themselves.
 *
 * Shared by the 1.7.1 upgrade operation and (via `scan`) its own `canRun`
 * check, so the operation naturally stops offering itself once nothing is
 * left to fix — no separate "already ran" flag needed.
 */
export class WikilinkCharMigrator {
    /** Notes and attachments whose filename still needs fixing. */
    async scan(context: UpgradeContext): Promise<WikilinkCharScanResult> {
        const { plugin } = context;
        const conversationFolder =
            plugin.settings.conversationFolder || "Nexus/Conversations";
        const attachmentFolder =
            plugin.settings.attachmentFolder || "Nexus/Attachments";

        const conversationFiles = plugin.app.vault
            .getMarkdownFiles()
            .filter(
                (file) =>
                    file.path.startsWith(`${conversationFolder}/`) &&
                    hasWikilinkStructuralChars(file.basename)
            );

        const attachmentFiles = plugin.app.vault
            .getFiles()
            .filter(
                (file) =>
                    file.path.startsWith(`${attachmentFolder}/`) &&
                    hasWikilinkStructuralChars(file.basename)
            );

        return { conversationFiles, attachmentFiles };
    }

    /**
     * Renames every file `scan` found, then repairs the links that pointed
     * at its old name. Conversation notes and attachments are renamed
     * first, in full, before any relinking starts — a rename can still fail
     * (a same-folder case-only collision, a permission error), and relinking
     * needs the final old→new map regardless of which renames succeeded.
     */
    async migrate(
        context: UpgradeContext,
        scanResult: WikilinkCharScanResult
    ): Promise<OperationResult> {
        const { plugin } = context;
        const vault = plugin.app.vault;
        const details: string[] = [];

        const conversationRenames: Array<{
            oldPath: string;
            newPath: string;
        }> = [];
        const attachmentRenames: Array<{
            oldPath: string;
            newPath: string;
        }> = [];
        let renamed = 0;
        let failed = 0;

        const rename = async (
            file: TFile,
            maxBytes: number | undefined,
            into: Array<{ oldPath: string; newPath: string }>,
            label: "note" | "attachment"
        ) => {
            const oldPath = file.path;
            const folder = oldPath.slice(0, oldPath.lastIndexOf("/"));
            const newBaseName = substituteWikilinkStructuralChars(
                file.basename
            );
            const extension = file.extension ? `.${file.extension}` : "";
            const candidatePath = `${folder}/${newBaseName}${extension}`;

            try {
                const uniquePath = await generateUniqueFileName(
                    candidatePath,
                    vault.adapter,
                    maxBytes
                );
                await vault.rename(file, uniquePath);
                into.push({ oldPath, newPath: uniquePath });
                renamed++;
                details.push(`${label}: ${oldPath} → ${uniquePath}`);
            } catch (error) {
                failed++;
                const message =
                    error instanceof Error ? error.message : String(error);
                details.push(`Failed (${label}): ${oldPath} — ${message}`);
                plugin.logger.error(
                    `Failed to rename ${oldPath} to ${candidatePath}:`,
                    error
                );
            }
        };

        for (const file of scanResult.conversationFiles) {
            await rename(
                file,
                CONVERSATION_NOTE_FILENAME_MAX_BYTES,
                conversationRenames,
                "note"
            );
        }

        for (const file of scanResult.attachmentFiles) {
            await rename(file, undefined, attachmentRenames, "attachment");
        }

        if (renamed === 0) {
            return {
                success: failed === 0,
                message:
                    failed > 0
                        ? `${failed} rename(s) failed; nothing else to do.`
                        : "No affected note or attachment found.",
                details,
            };
        }

        // Relink. Conversation renames touch index reports and Claude
        // artifact "**Conversation:**" back-links; attachment renames touch
        // the embeds inside conversation notes. `updateConversationLinks`
        // and `updateAttachmentLinksBatch` both assume a folder-prefix
        // rename (they require a `/...` remainder after the matched path),
        // which never matches an individually renamed file — hence the
        // dedicated exact-path method, run once per rename kind across the
        // right file set.
        const linkUpdateService = new LinkUpdateService(plugin);
        const fixedReportPaths = new Set<string>();
        const fixedNotePaths = new Set<string>();
        let linksFixed = 0;

        if (conversationRenames.length > 0) {
            const [reportFiles, artifactFiles] = await Promise.all([
                linkUpdateService.getReportFiles(),
                linkUpdateService.getClaudeArtifactFiles(),
            ]);
            const stats = await linkUpdateService.updateExactPathLinksBatch(
                conversationRenames,
                [...reportFiles, ...artifactFiles],
                undefined,
                undefined,
                "conversation"
            );
            linksFixed += stats.conversationLinksUpdated;
            for (const path of stats.modifiedFilePaths ?? []) {
                fixedReportPaths.add(path);
            }
        }

        if (attachmentRenames.length > 0) {
            const conversationFiles =
                await linkUpdateService.getConversationFiles();
            const stats = await linkUpdateService.updateExactPathLinksBatch(
                attachmentRenames,
                conversationFiles
            );
            linksFixed += stats.attachmentLinksUpdated;
            for (const path of stats.modifiedFilePaths ?? []) {
                fixedNotePaths.add(path);
            }
        }

        if (fixedReportPaths.size > 0) {
            details.push(`Links fixed in: ${[...fixedReportPaths].join(", ")}`);
        }
        if (fixedNotePaths.size > 0) {
            details.push(
                `Attachment embeds fixed in: ${[...fixedNotePaths].join(", ")}`
            );
        }

        const summary =
            `Renamed ${conversationRenames.length} note(s) and ${attachmentRenames.length} attachment(s)` +
            (failed > 0 ? `, ${failed} failure(s)` : "") +
            `. Fixed ${linksFixed} link(s) across ${
                fixedReportPaths.size + fixedNotePaths.size
            } file(s).`;

        return {
            success: failed === 0,
            message: summary,
            details,
        };
    }
}
