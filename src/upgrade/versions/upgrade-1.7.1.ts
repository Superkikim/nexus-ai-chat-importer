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

// src/upgrade/versions/upgrade-1.7.1.ts
import {
    VersionUpgrade,
    UpgradeOperation,
    UpgradeContext,
    OperationResult,
} from "../upgrade-interface";
import {
    OversizedNotesRepairer,
    BACKUP_SUFFIX,
} from "../shared/oversized-notes-repairer";
import { WikilinkCharMigrator } from "../shared/wikilink-char-migrator";

/**
 * Renames the `.md` backups the 1.7.0 repair wrote before it moved to
 * `.md.bak`. A `.md` backup still holds the oversized line it was made to
 * preserve, so it was indexed by Obsidian exactly like the note it backs
 * up — quietly re-introducing the slowdown the repair exists to fix.
 *
 * Must run before RepairOversizedNotesOperation in this version's operation
 * list: renaming first removes these files from `getMarkdownFiles()`
 * entirely (wrong extension), so the repair's scan can never mistake a
 * backup for a note that still needs repairing. Relying on the backup's
 * `.md` name matching a pattern would be the same protection, but weaker.
 */
class RenameOldBackupsOperation extends UpgradeOperation {
    readonly id = "rename-oversized-backups";
    readonly name = "Move old note backups out of Obsidian's index";
    readonly description =
        "Renames pre-1.7.0 backup notes from .md to .md.bak so Obsidian stops indexing them.";
    readonly type = "automatic" as const;

    async execute(context: UpgradeContext): Promise<OperationResult> {
        const { plugin } = context;
        const oldBackups = plugin.app.vault
            .getMarkdownFiles()
            .filter((file) => file.basename.endsWith(BACKUP_SUFFIX));

        if (oldBackups.length === 0) {
            return {
                success: true,
                message: "No .md-format backup found.",
            };
        }

        const details: string[] = [];
        let renamed = 0;
        let failed = 0;

        for (const file of oldBackups) {
            const bakName = `${file.name}.bak`;
            const newPath = `${file.path}.bak`;
            const folder = file.path.slice(0, file.path.lastIndexOf("/"));

            // The conversation note this backup sits beside — a real, open-able
            // file, unlike the .bak itself. Linking to it is how the report
            // points at the folder: click through to the note, and the backup
            // is right there next to it in the file explorer.
            const noteBasename = file.basename.slice(
                0,
                file.basename.length - BACKUP_SUFFIX.length
            );
            const notePath = `${folder}/${noteBasename}.md`;
            const noteExists =
                !!plugin.app.vault.getAbstractFileByPath(notePath);
            const noteTitle = noteBasename.replace(/\|/g, "\\|");
            const location = noteExists
                ? `[[${notePath}\\|${noteTitle}]]`
                : folder;

            try {
                await plugin.app.vault.rename(file, newPath);
                renamed++;
                details.push(`**${bakName}** — same folder as ${location}`);
            } catch (error) {
                failed++;
                details.push(
                    `Failed: ${file.path} — ${
                        error instanceof Error ? error.message : String(error)
                    }`
                );
            }
        }

        return {
            success: failed === 0,
            message:
                `Renamed ${renamed} backup(s), ${failed} failure(s). These are backups from an earlier repair. They were still ` +
                "`.md` files carrying the same oversized line as the note they protect, so Obsidian kept indexing them and the slowdown persisted. Each has been renamed with a `.bak` suffix so Obsidian stops scanning it.",
            details,
        };
    }
}

/**
 * Repairs the notes an older version wrote with lines too long for Obsidian —
 * unconditionally this time. The 1.7.0 upgrade asked first; anyone who
 * declined, was never asked (upgrading from an even older version), or hit
 * the dialog getting stuck (fixed alongside this) is still carrying notes
 * that degrade indexing across the whole vault. The plugin wrote that
 * problem, a backup is made per note before it is touched, and the repair is
 * a no-op when there is nothing to fix — there is no good reason left to
 * make this optional.
 */
class RepairOversizedNotesOperation extends UpgradeOperation {
    readonly id = "repair-oversized-notes";
    readonly name = "Repair notes that slow Obsidian down";
    readonly description =
        "Moves oversized pasted content out of existing notes and into files beside them.";
    readonly type = "automatic" as const;

    private readonly repairer = new OversizedNotesRepairer();

    async execute(context: UpgradeContext): Promise<OperationResult> {
        const heavy = await this.repairer.scan(context);

        if (heavy.length === 0) {
            return {
                success: true,
                message: "No note holds an oversized line.",
            };
        }

        return this.repairer.repair(context, heavy);
    }
}

/**
 * Renames notes and attachments written with `#`, `^`, `[` or `]` in their
 * filename — characters Obsidian cannot resolve inside a wikilink, so every
 * `[[path]]` pointing at one of these files is permanently broken — and
 * repairs the links in index reports, Claude artifact frontmatter, and
 * attachment embeds inside conversation notes that pointed at the old name.
 *
 * The character is substituted, not deleted (`C#` stays distinguishable
 * from `C`, unlike a blanket strip), and only the physical filename
 * changes: a conversation's displayed title (`aliases:`, the `# Title:`
 * heading) is untouched, since link generation never reads it. See
 * issue #83.
 */
class MigrateWikilinkStructuralCharsOperation extends UpgradeOperation {
    readonly id = "migrate-wikilink-structural-chars";
    readonly name = "Fix notes and attachments with broken wikilinks";
    readonly description =
        "Renames notes and attachments containing #, ^, [ or ] and repairs the links that pointed at them.";
    readonly type = "automatic" as const;

    private readonly migrator = new WikilinkCharMigrator();

    async execute(context: UpgradeContext): Promise<OperationResult> {
        const scanResult = await this.migrator.scan(context);

        if (
            scanResult.conversationFiles.length === 0 &&
            scanResult.attachmentFiles.length === 0
        ) {
            return {
                success: true,
                message:
                    "No note or attachment name holds a wikilink-structural character.",
            };
        }

        return this.migrator.migrate(context, scanResult);
    }
}

/**
 * Version 1.7.1 Upgrade Definition
 *
 * Operation order matters: the backup rename must run before the repair
 * scan (see RenameOldBackupsOperation).
 */
export class Upgrade171 extends VersionUpgrade {
    readonly version = "1.7.1";

    readonly automaticOperations: UpgradeOperation[] = [
        new RenameOldBackupsOperation(),
        new RepairOversizedNotesOperation(),
        new MigrateWikilinkStructuralCharsOperation(),
    ];

    readonly manualOperations: UpgradeOperation[] = [];
}
