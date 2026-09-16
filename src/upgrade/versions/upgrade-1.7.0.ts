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
import {
    VersionUpgrade,
    UpgradeOperation,
    UpgradeContext,
    OperationResult,
} from "../upgrade-interface";
import { showDialog } from "../../dialogs";
import { OversizedNotesRepairer } from "../shared/oversized-notes-repairer";
import { t } from "../../i18n";

/**
 * Offers to repair the notes an older version wrote with lines too long for
 * Obsidian — see OversizedNotesRepairer for why. This first pass asks before
 * touching anything; from 1.7.1 the same repair runs unconditionally instead,
 * since declining here just leaves the vault degraded and a backup already
 * makes it reversible.
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
            },
            "info"
        );

        if (!accepted) {
            return {
                success: true,
                message: `Declined: ${heavy.length} note(s) left as they are.`,
            };
        }

        return this.repairer.repair(context, heavy);
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
