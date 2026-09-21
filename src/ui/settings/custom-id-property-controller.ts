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

// src/ui/settings/custom-id-property-controller.ts
import type { TFile } from "obsidian";
import type {
    CustomIdPropertyOperation,
    CustomIdPropertyService,
} from "../../services/custom-id-property-service";
import {
    checkCustomIdPropertyName,
    resolveCustomIdProperty,
} from "../../utils/custom-id-property";

export type ClearChoice = "remove_plugin" | "remove_all" | "keep" | "cancel";

/** The dialogs the controller asks through. */
export interface CustomIdPropertyUi {
    confirmEnable(
        name: string,
        total: number,
        existing: number,
        overwrite: boolean
    ): Promise<boolean>;
    confirmRename(oldName: string, newName: string): Promise<boolean>;
    chooseClear(name: string): Promise<ClearChoice>;
    /** Apply the operation with progress, then show the summary. */
    run(operation: CustomIdPropertyOperation, files: TFile[]): Promise<void>;
}

export interface CustomIdPropertyStore {
    readonly name: string;
    readonly overwrite: boolean;
    save(name: string): Promise<void>;
}

export interface CommitResult {
    /** What the field must show: the name now in effect. */
    value: string;
    /** Set when the typed name was refused. */
    warning?: "format" | "reserved";
}

/**
 * What happens when the name field is committed (on blur). Kept free of
 * DOM so every path, Cancel included, is tested.
 */
export class CustomIdPropertyController {
    constructor(
        private store: CustomIdPropertyStore,
        private service: Pick<
            CustomIdPropertyService,
            "findConversationNotes" | "countWithProperty"
        >,
        private ui: CustomIdPropertyUi
    ) {}

    async commit(input: string): Promise<CommitResult> {
        const current = resolveCustomIdProperty(this.store.name) ?? "";
        const typed = input.trim();

        if (typed === current) {
            return { value: current };
        }

        if (typed === "") {
            return this.clear(current);
        }

        const check = checkCustomIdPropertyName(typed);
        if (!check.valid) {
            return { value: current, warning: check.reason };
        }

        return current === ""
            ? this.enable(check.name)
            : this.rename(current, check.name);
    }

    private async enable(name: string): Promise<CommitResult> {
        const files = await this.service.findConversationNotes();
        const overwrite = this.store.overwrite;

        if (files.length > 0) {
            const existing = await this.service.countWithProperty(files, name);
            const confirmed = await this.ui.confirmEnable(
                name,
                files.length,
                existing,
                overwrite
            );
            if (!confirmed) {
                return { value: "" };
            }
        }

        await this.store.save(name);
        if (files.length > 0) {
            await this.ui.run({ kind: "add", name, overwrite }, files);
        }
        return { value: name };
    }

    private async rename(from: string, to: string): Promise<CommitResult> {
        const files = await this.service.findConversationNotes();

        if (files.length > 0) {
            const confirmed = await this.ui.confirmRename(from, to);
            if (!confirmed) {
                return { value: from };
            }
        }

        await this.store.save(to);
        if (files.length > 0) {
            await this.ui.run(
                { kind: "rename", from, to, overwrite: this.store.overwrite },
                files
            );
        }
        return { value: to };
    }

    private async clear(name: string): Promise<CommitResult> {
        const files = await this.service.findConversationNotes();
        const withProperty =
            files.length > 0
                ? await this.service.countWithProperty(files, name)
                : 0;

        let choice: ClearChoice = "keep";
        if (withProperty > 0) {
            choice = await this.ui.chooseClear(name);
            if (choice === "cancel") {
                return { value: name };
            }
        }

        await this.store.save("");
        if (choice === "remove_plugin" || choice === "remove_all") {
            await this.ui.run(
                {
                    kind: "remove",
                    name,
                    onlyPluginValue: choice === "remove_plugin",
                },
                files
            );
        }
        return { value: "" };
    }
}
