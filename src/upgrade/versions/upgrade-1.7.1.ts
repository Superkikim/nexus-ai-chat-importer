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
import { Notice } from "obsidian";
import {
    VersionUpgrade,
    UpgradeOperation,
    UpgradeContext,
    OperationResult,
} from "../upgrade-interface";
import { OversizedNotesRepairer } from "../shared/oversized-notes-repairer";

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

        const result = await this.repairer.repair(context, heavy);
        if (result.success) {
            new Notice(
                `Nexus repaired ${heavy.length} note(s) that were slowing your vault down. A backup of each was made beside it.`,
                8000
            );
        }
        return result;
    }
}

/**
 * Version 1.7.1 Upgrade Definition
 */
export class Upgrade171 extends VersionUpgrade {
    readonly version = "1.7.1";

    readonly automaticOperations: UpgradeOperation[] = [
        new RepairOversizedNotesOperation(),
    ];

    readonly manualOperations: UpgradeOperation[] = [];
}
