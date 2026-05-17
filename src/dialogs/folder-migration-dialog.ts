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

// src/dialogs/folder-migration-dialog.ts
import { Modal, Notice } from "obsidian";
import type NexusAiChatImporterPlugin from "../main";
import { t } from "../i18n";

/**
 * Dialog to ask user if they want to migrate files when changing folder location
 */
export class FolderMigrationDialog extends Modal {
    private onComplete: (action: "move" | "keep" | "cancel") => Promise<void>;
    private oldPath: string;
    private newPath: string;
    private folderType: string;

    constructor(
        plugin: NexusAiChatImporterPlugin,
        oldPath: string,
        newPath: string,
        folderType: string,
        onComplete: (action: "move" | "keep" | "cancel") => Promise<void>
    ) {
        super(plugin.app);
        this.oldPath = oldPath;
        this.newPath = newPath;
        this.folderType = folderType;
        this.onComplete = onComplete;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        // Title
        contentEl.createEl("h2", {
            text: t("folder_migration.title"),
            cls: "nexus-migration-title",
        });

        // Message
        const messageContainer = contentEl.createDiv({
            cls: "nexus-migration-message",
        });

        messageContainer.createEl("p", {
            text: t("folder_migration.message_intro", {
                folder_type: this.folderType,
            }),
        });

        const pathContainer = messageContainer.createDiv({
            cls: "nexus-migration-paths",
        });
        pathContainer.createEl("div", {
            text: t("folder_migration.path_from", { path: this.oldPath }),
            cls: "nexus-migration-path-old",
        });
        pathContainer.createEl("div", {
            text: t("folder_migration.path_to", { path: this.newPath }),
            cls: "nexus-migration-path-new",
        });

        messageContainer.createEl("p", {
            text: t("folder_migration.question"),
        });

        // Warning box
        const warningBox = contentEl.createDiv({
            cls: "nexus-migration-warning",
        });
        warningBox.createEl("strong", {
            text: t("folder_migration.warning.title"),
        });
        warningBox.createEl("p", {
            text: t("folder_migration.warning.text"),
        });

        // Buttons (3 options: Cancel, Keep, Move)
        const buttonContainer = contentEl.createDiv({
            cls: "nexus-migration-buttons",
        });

        // Cancel button (left)
        const cancelButton = buttonContainer.createEl("button", {
            text: t("folder_migration.buttons.cancel"),
            cls: "nexus-migration-button-cancel",
        });
        cancelButton.addEventListener("click", () => {
            void (async () => {
                this.close();
                try {
                    await this.onComplete("cancel");
                    new Notice(
                        t("folder_migration.notices.change_cancelled_reverted")
                    );
                } catch (error) {
                    new Notice(
                        t("folder_migration.notices.failed_revert", {
                            error:
                                error instanceof Error
                                    ? error.message
                                    : String(error),
                        })
                    );
                }
            })();
        });

        // Keep button (middle)
        const keepButton = buttonContainer.createEl("button", {
            text: t("folder_migration.buttons.keep"),
            cls: "nexus-migration-button-keep",
        });
        keepButton.addEventListener("click", () => {
            void (async () => {
                this.close();
                try {
                    await this.onComplete("keep");
                    new Notice(
                        t(
                            "folder_migration.notices.setting_updated_files_remain",
                            {
                                path: this.oldPath,
                            }
                        )
                    );
                } catch (error) {
                    new Notice(
                        t("folder_migration.notices.failed_update", {
                            error:
                                error instanceof Error
                                    ? error.message
                                    : String(error),
                        })
                    );
                }
            })();
        });

        // Move button (right, primary action)
        const moveButton = buttonContainer.createEl("button", {
            text: t("folder_migration.buttons.move"),
            cls: "mod-cta nexus-migration-button-move",
        });
        moveButton.addEventListener("click", () => {
            void (async () => {
                this.close();
                try {
                    await this.onComplete("move");
                    new Notice(
                        t("folder_migration.notices.files_moved", {
                            path: this.newPath,
                        })
                    );
                } catch (error) {
                    new Notice(
                        t("folder_migration.notices.failed_move", {
                            error:
                                error instanceof Error
                                    ? error.message
                                    : String(error),
                        })
                    );
                }
            })();
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
