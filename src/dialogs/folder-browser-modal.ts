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

import { App, Modal, Notice } from "obsidian";
import { FolderSuggest } from "../ui/folder-suggest";

/**
 * Modal for selecting/creating a folder with inline base folder + subfolder inputs
 */
export class FolderBrowserModal extends Modal {
    private onSubmit: (path: string) => void;
    private baseFolderInput: HTMLInputElement;
    private subfolderInput: HTMLInputElement;

    constructor(app: App, onSubmit: (path: string) => void) {
        super(app);
        this.onSubmit = onSubmit;
    }

    onOpen(): void {
        const { contentEl } = this;

        contentEl.createEl("h3", { text: "Select Folder Location" });

        // Label
        const label = contentEl.createDiv({ cls: "setting-item-description" });
        label.style.marginBottom = "10px";
        label.setText("Select base folder and type target subfolder:");

        // Inline input container
        const inputRow = contentEl.createDiv();
        inputRow.style.display = "flex";
        inputRow.style.alignItems = "center";
        inputRow.style.gap = "8px";
        inputRow.style.marginBottom = "20px";

        // Base folder input (with autocomplete)
        this.baseFolderInput = inputRow.createEl("input", {
            type: "text",
            placeholder: "Base folder (e.g., Nexus)"
        });
        this.baseFolderInput.style.flex = "1";

        // Add folder autocomplete
        new FolderSuggest(this.app, this.baseFolderInput);

        // Separator
        const separator = inputRow.createEl("span", { text: "/" });
        separator.style.fontSize = "18px";
        separator.style.fontWeight = "bold";
        separator.style.color = "var(--text-muted)";

        // Subfolder input
        this.subfolderInput = inputRow.createEl("input", {
            type: "text",
            placeholder: "Subfolder name (e.g., Reports)"
        });
        this.subfolderInput.style.flex = "1";

        // Buttons
        const buttonContainer = contentEl.createDiv({ cls: "modal-button-container" });

        const cancelButton = buttonContainer.createEl("button", { text: "Cancel" });
        cancelButton.addEventListener("click", () => this.close());

        const proceedButton = buttonContainer.createEl("button", {
            text: "Proceed",
            cls: "mod-cta"
        });
        proceedButton.addEventListener("click", () => this.handleProceed());

        // Focus base folder input
        this.baseFolderInput.focus();

        // Handle Enter key on both inputs
        this.baseFolderInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                this.subfolderInput.focus();
            } else if (e.key === "Escape") {
                this.close();
            }
        });

        this.subfolderInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                this.handleProceed();
            } else if (e.key === "Escape") {
                this.close();
            }
        });
    }

    private async handleProceed(): Promise<void> {
        const baseFolder = this.baseFolderInput.value.trim();
        const subfolder = this.subfolderInput.value.trim();

        // Build full path
        let fullPath = "";
        if (baseFolder && subfolder) {
            // Special case: if base folder is "/" (vault root), don't double the slash
            if (baseFolder === "/") {
                fullPath = subfolder;
            } else {
                fullPath = `${baseFolder}/${subfolder}`;
            }
        } else if (subfolder) {
            // No base folder = vault root
            fullPath = subfolder;
        } else if (baseFolder) {
            // No subfolder = just use base folder
            // Special case: if user selected "/" alone, treat as empty (vault root)
            if (baseFolder === "/") {
                new Notice("⚠️ Please enter a folder name");
                return;
            }
            fullPath = baseFolder;
        } else {
            new Notice("⚠️ Please enter at least a folder name");
            return;
        }

        // Validate path format but don't create the folder yet
        // The folder will be created when files are actually moved
        try {
            // Just check if path is valid (no invalid characters, etc.)
            if (fullPath.includes('\\') || fullPath.includes(':') || fullPath.includes('*') ||
                fullPath.includes('?') || fullPath.includes('"') || fullPath.includes('<') ||
                fullPath.includes('>') || fullPath.includes('|')) {
                new Notice("❌ Invalid folder name: contains illegal characters");
                return;
            }

            this.onSubmit(fullPath);
            this.close();
        } catch (error) {
            new Notice(`❌ Invalid folder path: ${error.message}`);
        }
    }

    onClose(): void {
        const { contentEl } = this;
        contentEl.empty();
    }
}

