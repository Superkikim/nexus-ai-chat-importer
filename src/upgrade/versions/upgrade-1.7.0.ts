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
import { Notice, TFile } from "obsidian";
import {
    VersionUpgrade,
    UpgradeOperation,
    UpgradeContext,
    OperationResult,
} from "../upgrade-interface";
import { ensureFolderExists } from "../../utils";
import { t } from "../../i18n";

/**
 * A single line this long makes Obsidian's parser crawl over the whole vault,
 * not just the note holding it. Well past anything prose or code produces.
 */
const OVERLONG_LINE_CHARS = 20_000;

/** Only notes this large can hold such a line; the rest are never opened. */
const MIN_NOTE_BYTES_TO_SCAN = 40 * 1024;

const REPORT_FILE_NAME = "Nexus 1.7.0 - notes to rebuild.md";

interface HeavyNote {
    path: string;
    title: string;
    provider: string;
    conversationId: string;
    createTime: string;
    longestLine: number;
    /** True when the long line sits in an attachment callout, which a rebuild extracts. */
    fixableByRebuild: boolean;
}

function frontmatterValue(content: string, key: string): string {
    const match = content.match(new RegExp(`^${key}: (.*)$`, "m"));
    return match ? match[1].trim().replace(/^["']|["']$/g, "") : "";
}

/**
 * Report the notes whose lines are long enough to slow Obsidian down.
 *
 * Read-only on purpose. Extracting the content would mean cutting a block out
 * of the middle of a note and un-prefixing it line by line — surgery on the
 * user's own files, unprompted, at startup. The import path already does the
 * job safely because it works from the export rather than the note, so this
 * operation names the conversations and lets the user rebuild the ones they
 * want.
 */
class ReportOversizedNotesOperation extends UpgradeOperation {
    readonly id = "report-oversized-notes";
    readonly name = "Find notes that slow Obsidian down";
    readonly description =
        "Lists conversations whose notes hold very long lines, so they can be rebuilt from their export.";
    readonly type = "automatic" as const;

    async execute(context: UpgradeContext): Promise<OperationResult> {
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
                    file.stat.size > MIN_NOTE_BYTES_TO_SCAN
            );

        const heavy: HeavyNote[] = [];
        for (let i = 0; i < candidates.length; i++) {
            const file = candidates[i];
            if (i % 50 === 0) {
                context.onProgress?.(
                    Math.round((i / Math.max(1, candidates.length)) * 90),
                    `Checking note ${i + 1} of ${candidates.length}...`
                );
            }

            try {
                const note = await this.inspect(plugin, file);
                if (note) heavy.push(note);
            } catch {
                // A note we cannot read is a note we cannot advise on.
                continue;
            }
        }

        if (heavy.length === 0) {
            return {
                success: true,
                message: `Scanned ${candidates.length} large note(s); none holds an oversized line.`,
            };
        }

        const reportPath = await this.writeReport(context, heavy);
        const rebuildable = heavy.filter((n) => n.fixableByRebuild).length;

        if (rebuildable > 0) {
            new Notice(
                t("upgrade.oversized_notes.notice", {
                    count: String(rebuildable),
                }),
                10000
            );
        }

        return {
            success: true,
            message: `Found ${heavy.length} note(s) with oversized lines, ${rebuildable} fixable by a rebuild. Listed in ${reportPath}.`,
            details: heavy.map((n) => n.path),
        };
    }

    private async inspect(
        plugin: UpgradeContext["plugin"],
        file: TFile
    ): Promise<HeavyNote | null> {
        const content = await plugin.app.vault.cachedRead(file);
        const lines = content.split("\n");

        let longest = "";
        for (const line of lines) {
            if (line.length > longest.length) longest = line;
        }
        if (longest.length < OVERLONG_LINE_CHARS) return null;

        return {
            path: file.path,
            title: file.basename,
            provider: frontmatterValue(content, "provider") || "unknown",
            conversationId: frontmatterValue(content, "conversation_id"),
            createTime: frontmatterValue(content, "create_time"),
            longestLine: longest.length,
            // ">>" is the attachment callout: its content came from the export
            // and a rebuild moves it to a file. A single ">" is the message
            // itself — text typed or pasted into the chat, which no rebuild
            // can shorten.
            fixableByRebuild: longest.startsWith(">>"),
        };
    }

    private async writeReport(
        context: UpgradeContext,
        heavy: HeavyNote[]
    ): Promise<string> {
        const { plugin } = context;
        const folder = plugin.settings.reportFolder || "Nexus/Reports";
        await ensureFolderExists(folder, plugin.app.vault);
        const path = `${folder}/${REPORT_FILE_NAME}`;

        const rebuildable = heavy
            .filter((n) => n.fixableByRebuild)
            .sort((a, b) => b.longestLine - a.longestLine);
        const others = heavy
            .filter((n) => !n.fixableByRebuild)
            .sort((a, b) => b.longestLine - a.longestLine);

        const lines: string[] = [
            "---",
            "nexus: nexus-ai-chat-importer",
            'reportType: upgrade-1.7.0',
            "---",
            "",
            "# Notes that slow Obsidian down",
            "",
            "A very long line makes Obsidian's parser slow across the whole vault,",
            "not only in the note holding it. Nexus 1.7.0 no longer writes them:",
            "attached text over 20 KB is stored as a file beside the conversation",
            "and linked from the note.",
            "",
        ];

        if (rebuildable.length > 0) {
            lines.push(
                "## Rebuild these",
                "",
                "Re-import the export these came from, in **Select Specific**, tick",
                "**Rebuild selected notes if they exist**, and select them. Their",
                "attached text moves out of the note.",
                "",
                "| Conversation | Provider | Date | Longest line |",
                "| --- | --- | --- | ---: |"
            );
            for (const note of rebuildable) {
                lines.push(
                    `| [[${note.path}\\|${note.title}]] | ${note.provider} | ${
                        note.createTime.slice(0, 10) || "—"
                    } | ${note.longestLine.toLocaleString("en-US")} |`
                );
            }
            lines.push("");
        }

        if (others.length > 0) {
            lines.push(
                "## Nothing to do",
                "",
                "These carry their long line in the conversation itself — text pasted",
                "into the chat rather than attached to it. A rebuild produces the same",
                "note, so they are listed only so you know where they are.",
                "",
                "| Conversation | Provider | Date | Longest line |",
                "| --- | --- | --- | ---: |"
            );
            for (const note of others) {
                lines.push(
                    `| [[${note.path}\\|${note.title}]] | ${note.provider} | ${
                        note.createTime.slice(0, 10) || "—"
                    } | ${note.longestLine.toLocaleString("en-US")} |`
                );
            }
            lines.push("");
        }

        const existing = plugin.app.vault.getAbstractFileByPath(path);
        const body = lines.join("\n");
        if (existing instanceof TFile) {
            await plugin.app.vault.modify(existing, body);
        } else {
            await plugin.app.vault.create(path, body);
        }

        return path;
    }
}

/**
 * Version 1.7.0 Upgrade Definition
 * Points out the notes an earlier version made too heavy for Obsidian.
 */
export class Upgrade170 extends VersionUpgrade {
    readonly version = "1.7.0";

    readonly automaticOperations: UpgradeOperation[] = [
        new ReportOversizedNotesOperation(),
    ];

    readonly manualOperations: UpgradeOperation[] = [];
}
