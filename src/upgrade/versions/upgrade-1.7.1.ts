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
            const newPath = `${file.path}.bak`;
            try {
                await plugin.app.vault.rename(file, newPath);
                renamed++;
                const title = file.basename.replace(/\|/g, "\\|");
                details.push(
                    `Renamed: [[${newPath}\\|${title}]] — was still a .md file holding the oversized line it backs up, so Obsidian kept indexing it`
                );
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
            message: `Renamed ${renamed} backup(s) from .md to .md.bak. ${failed} failure(s).`,
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
    ];

    readonly manualOperations: UpgradeOperation[] = [];
}
