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

// src/services/custom-id-property-service.ts
import type { App, TFile } from "obsidian";
import {
    NoteEditOutcome,
    NoteEditResult,
    removeCustomIdProperty,
    renameCustomIdProperty,
    setCustomIdProperty,
} from "../utils/custom-id-property";
import { getErrorMessage } from "../utils";

/** What to do to existing conversation notes after the setting changed. */
export type CustomIdPropertyOperation =
    | { kind: "add"; name: string; overwrite: boolean }
    | { kind: "rename"; from: string; to: string; overwrite: boolean }
    | { kind: "remove"; name: string; onlyPluginValue: boolean };

export interface CustomIdPropertySummary {
    added: number;
    overwritten: number;
    renamed: number;
    removed: number;
    skipped: number;
    failed: number;
    failures: Array<{ path: string; message: string }>;
}

export type ProgressCallback = (
    done: number,
    total: number,
    path: string
) => void;

/** Apply one operation to one note's content. Throws when it cannot. */
export function applyCustomIdPropertyOperation(
    content: string,
    operation: CustomIdPropertyOperation
): NoteEditResult {
    switch (operation.kind) {
        case "add":
            return setCustomIdProperty(
                content,
                operation.name,
                operation.overwrite
            );
        case "rename":
            return renameCustomIdProperty(
                content,
                operation.from,
                operation.to,
                operation.overwrite
            );
        case "remove":
            return removeCustomIdProperty(
                content,
                operation.name,
                operation.onlyPluginValue
            );
    }
}

export function emptySummary(): CustomIdPropertySummary {
    return {
        added: 0,
        overwritten: 0,
        renamed: 0,
        removed: 0,
        skipped: 0,
        failed: 0,
        failures: [],
    };
}

/**
 * Finds conversation notes through the metadata cache (a vault can hold
 * thousands of them) and edits them one at a time.
 */
export class CustomIdPropertyService {
    constructor(private app: App, private pluginId: string) {}

    /**
     * Notes carrying `nexus: <plugin id>` and a `conversation_id`. Claude
     * artifact notes carry both too, and are not conversation notes.
     */
    findConversationNotes(): TFile[] {
        return this.app.vault.getMarkdownFiles().filter((file) => {
            const frontmatter =
                this.app.metadataCache.getFileCache(file)?.frontmatter;
            return (
                !!frontmatter &&
                frontmatter.nexus === this.pluginId &&
                frontmatter.conversation_id !== undefined &&
                frontmatter.conversation_id !== null &&
                frontmatter.artifact_id === undefined
            );
        });
    }

    /** How many of `files` already have a property called `name`. */
    countWithProperty(files: TFile[], name: string): number {
        return files.filter((file) => {
            const frontmatter =
                this.app.metadataCache.getFileCache(file)?.frontmatter;
            return (
                !!frontmatter &&
                Object.prototype.hasOwnProperty.call(frontmatter, name)
            );
        }).length;
    }

    /**
     * Apply `operation` to every file, sequentially. A note that fails is
     * counted and reported; it never stops the others.
     */
    async run(
        files: TFile[],
        operation: CustomIdPropertyOperation,
        onProgress?: ProgressCallback
    ): Promise<CustomIdPropertySummary> {
        const summary = emptySummary();

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            onProgress?.(i, files.length, file.path);
            try {
                // A note with nothing to change is not written: no new
                // modification time, nothing for a sync service to upload.
                const before = await this.app.vault.read(file);
                let outcome: NoteEditOutcome = applyCustomIdPropertyOperation(
                    before,
                    operation
                ).outcome;
                if (outcome === "skipped") {
                    summary.skipped++;
                    continue;
                }
                await this.app.vault.process(file, (content) => {
                    const result = applyCustomIdPropertyOperation(
                        content,
                        operation
                    );
                    outcome = result.outcome;
                    return result.content;
                });
                summary[outcome]++;
            } catch (error: unknown) {
                summary.failed++;
                summary.failures.push({
                    path: file.path,
                    message: getErrorMessage(error),
                });
            }
        }

        onProgress?.(files.length, files.length, "");
        return summary;
    }
}
