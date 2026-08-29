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

// src/upgrade/versions/upgrade-1.7.0.ts
import { TFile } from "obsidian";
import {
    VersionUpgrade,
    UpgradeOperation,
    UpgradeContext,
    OperationResult,
} from "../upgrade-interface";
import { showDialog } from "../../dialogs";
import { ensureFolderExists } from "../../utils";
import { resolveAttachmentTarget } from "../../utils/attachment-target";
import {
    beautify,
    contentFileName,
    detectKind,
    LONG_LINE_CHARS,
} from "../../services/long-content-extractor";
import { t } from "../../i18n";

/** Only a note this large can hold such a line; the rest are never opened. */
const MIN_NOTE_BYTES_TO_SCAN = 40 * 1024;

const BACKUP_SUFFIX = " (pre-1.7.0 backup)";

interface HeavyNote {
    file: TFile;
    provider: string;
    conversationId: string;
    longestLine: number;
}

function frontmatterValue(content: string, key: string): string {
    const match = content.match(new RegExp(`^${key}: (.*)$`, "m"));
    return match ? match[1].trim().replace(/^["']|["']$/g, "") : "";
}

/**
 * Repairs the notes an older version wrote with lines too long for Obsidian.
 *
 * From 1.7.0 the import moves such content to a file beside the conversation,
 * but notes already in the vault keep it — and one of them is enough to slow
 * indexing across the whole vault. Re-importing every export would fix them;
 * this does it without asking the user to still have the archives.
 *
 * The file it writes is named after its content, exactly as the import names
 * it, so a later re-import recognises the same file instead of writing a
 * second copy: the repair survives a rebuild rather than being undone by it.
 */
class RepairOversizedNotesOperation extends UpgradeOperation {
    readonly id = "repair-oversized-notes";
    readonly name = "Repair notes that slow Obsidian down";
    readonly description =
        "Moves oversized pasted content out of existing notes and into files beside them.";
    readonly type = "automatic" as const;

    async execute(context: UpgradeContext): Promise<OperationResult> {
        const heavy = await this.scan(context);

        if (heavy.length === 0) {
            return {
                success: true,
                message: "No note holds an oversized line.",
            };
        }

        const accepted = await showDialog(
            context.plugin.app,
            "confirmation",
            t("upgrade.repair_notes.title"),
            [
                t("upgrade.repair_notes.intro", {
                    count: String(heavy.length),
                }),
                heavy
                    .slice(0, 10)
                    .map((note) => `• ${note.file.basename}`)
                    .join("\n") +
                    (heavy.length > 10
                        ? `\n${t("upgrade.repair_notes.and_more", {
                              count: String(heavy.length - 10),
                          })}`
                        : ""),
                t("upgrade.repair_notes.what_happens"),
            ],
            t("upgrade.repair_notes.backup_note"),
            {
                button1: t("upgrade.repair_notes.buttons.repair"),
                button2: t("upgrade.repair_notes.buttons.ignore"),
            }
        );

        if (!accepted) {
            return {
                success: true,
                message: `Declined: ${heavy.length} note(s) left as they are.`,
            };
        }

        return this.repair(context, heavy);
    }

    /** Notes holding a line long enough to slow the vault down. */
    private async scan(context: UpgradeContext): Promise<HeavyNote[]> {
        const { plugin } = context;
        const conversationFolder =
            plugin.settings.conversationFolder ||
            plugin.settings.archiveFolder ||
            "Nexus/Conversations";

        const candidates = plugin.app.vault
            .getMarkdownFiles()
            .filter(
                (file) =>
                    file.path.startsWith(`${conversationFolder}/`) &&
                    !file.basename.endsWith(BACKUP_SUFFIX) &&
                    file.stat.size > MIN_NOTE_BYTES_TO_SCAN
            );

        const heavy: HeavyNote[] = [];
        for (let i = 0; i < candidates.length; i++) {
            const file = candidates[i];
            if (i % 50 === 0) {
                context.onProgress?.(
                    Math.round((i / Math.max(1, candidates.length)) * 40),
                    `Checking note ${i + 1} of ${candidates.length}...`
                );
            }

            try {
                const content = await plugin.app.vault.cachedRead(file);
                const longest = content
                    .split("\n")
                    .reduce((max, line) => Math.max(max, line.length), 0);
                if (longest < LONG_LINE_CHARS) continue;

                heavy.push({
                    file,
                    provider:
                        frontmatterValue(content, "provider") || "unknown",
                    conversationId: frontmatterValue(
                        content,
                        "conversation_id"
                    ),
                    longestLine: longest,
                });
            } catch {
                // A note we cannot read is a note we cannot repair.
                continue;
            }
        }

        return heavy.sort((a, b) => b.longestLine - a.longestLine);
    }

    private async repair(
        context: UpgradeContext,
        heavy: HeavyNote[]
    ): Promise<OperationResult> {
        const { plugin } = context;
        const details: string[] = [];
        let repaired = 0;
        let filesWritten = 0;
        let failed = 0;

        for (let i = 0; i < heavy.length; i++) {
            const note = heavy[i];
            context.onProgress?.(
                40 + Math.round(((i + 1) / heavy.length) * 55),
                `Repairing ${note.file.basename}...`
            );

            try {
                const original = await plugin.app.vault.read(note.file);
                const folder = `${plugin.settings.attachmentFolder}/${note.provider}/documents/${note.file.basename}`;
                const folderResult = await ensureFolderExists(
                    folder,
                    plugin.app.vault
                );
                if (!folderResult.success) {
                    throw new Error(folderResult.error || "folder unavailable");
                }

                const rewritten = await this.rewriteNote(
                    context,
                    original,
                    folder
                );
                if (rewritten.written === 0) {
                    details.push(
                        `Skipped: ${note.file.path} (nothing to move)`
                    );
                    continue;
                }

                await this.backup(context, note, original);
                await plugin.app.vault.modify(note.file, rewritten.content);

                repaired++;
                filesWritten += rewritten.written;
                details.push(
                    `Repaired: ${note.file.path} (${rewritten.written} file(s))`
                );
            } catch (error) {
                failed++;
                details.push(
                    `Failed: ${note.file.path} — ${
                        error instanceof Error ? error.message : String(error)
                    }`
                );
            }
        }

        return {
            success: failed === 0,
            message: `Repaired ${repaired} note(s), moving ${filesWritten} block(s) into files. ${failed} failure(s).`,
            details,
        };
    }

    /**
     * The note with its oversized lines replaced, in the shape the importer
     * would have produced: a link inside the attachment callout it was already
     * in, or a collapsed callout of its own when the line sat in the message.
     */
    private async rewriteNote(
        context: UpgradeContext,
        content: string,
        folder: string
    ): Promise<{ content: string; written: number }> {
        const lines = content.split("\n");
        const out: string[] = [];
        let written = 0;

        for (const line of lines) {
            if (line.length < LONG_LINE_CHARS) {
                out.push(line);
                continue;
            }

            const insideCallout = line.startsWith(">> ");
            const payload = insideCallout
                ? line.slice(3)
                : line.startsWith("> ")
                ? line.slice(2)
                : line;

            const path = await this.writeFile(context, payload, folder);
            if (!path) {
                out.push(line);
                continue;
            }

            written++;
            if (insideCallout) {
                out.push(`>> [[${path}]]`);
                continue;
            }

            const name = path.slice(path.lastIndexOf("/") + 1);
            out.push(
                `> >[!nexus_attachment]- **${name}** (${name.slice(
                    name.lastIndexOf(".") + 1
                )})`,
                "> >",
                `> > [[${path}]]`
            );
        }

        return { content: out.join("\n"), written };
    }

    private async writeFile(
        context: UpgradeContext,
        payload: string,
        folder: string
    ): Promise<string | null> {
        const { plugin } = context;
        try {
            const kind = detectKind(payload);
            const body = beautify(payload, kind);
            const path = await resolveAttachmentTarget(
                plugin.app.vault.adapter,
                `${folder}/${contentFileName(body, kind)}`,
                new TextEncoder().encode(body)
            );

            if (!(await plugin.app.vault.adapter.exists(path))) {
                await plugin.app.vault.create(path, body);
            }
            return path;
        } catch {
            return null;
        }
    }

    /**
     * The untouched note, kept beside itself.
     *
     * Its conversation id is suffixed so the plugin never mistakes the copy
     * for the conversation: two notes claiming one id would collide on the
     * next import, and the backup is meant to be forgettable, not dangerous.
     */
    private async backup(
        context: UpgradeContext,
        note: HeavyNote,
        original: string
    ): Promise<void> {
        const { plugin } = context;
        const folder = note.file.path.slice(0, note.file.path.lastIndexOf("/"));
        const path = `${folder}/${note.file.basename}${BACKUP_SUFFIX}.md`;

        if (plugin.app.vault.getAbstractFileByPath(path)) return;

        const content = note.conversationId
            ? original.replace(
                  new RegExp(`^conversation_id: .*$`, "m"),
                  `conversation_id: ${note.conversationId}-pre-1.7.0-backup`
              )
            : original;

        await plugin.app.vault.create(path, content);
    }
}

/**
 * Version 1.7.0 Upgrade Definition
 * Repairs the notes an earlier version made too heavy for Obsidian.
 */
export class Upgrade170 extends VersionUpgrade {
    readonly version = "1.7.0";

    readonly automaticOperations: UpgradeOperation[] = [
        new RepairOversizedNotesOperation(),
    ];

    readonly manualOperations: UpgradeOperation[] = [];
}
