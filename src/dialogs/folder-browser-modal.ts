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

import { App, Modal, SuggestModal, TFolder, Notice } from "obsidian";

/**
 * Modal for browsing and selecting folders in the vault
 * Includes a "Create new folder" button
 */
export class FolderBrowserModal extends SuggestModal<TFolder> {
    private onSelect: (folder: TFolder) => void;
    private onCreate: (path: string) => void;
    private selectedFolder: TFolder | null = null;
    private selectedEl: HTMLElement | null = null;

    constructor(app: App, onSelect: (folder: TFolder) => void, onCreate: (path: string) => void) {
        super(app);
        this.onSelect = onSelect;
        this.onCreate = onCreate;

        this.setPlaceholder("Type to search folders...");
    }

    onOpen(): void {
        super.onOpen();

        // Add buttons at the bottom
        const buttonContainer = this.modalEl.createDiv({ cls: "modal-button-container" });
        buttonContainer.style.padding = "10px";
        buttonContainer.style.borderTop = "1px solid var(--background-modifier-border)";
        buttonContainer.style.display = "flex";
        buttonContainer.style.gap = "10px";

        // Button 1: Select folder
        const selectButton = buttonContainer.createEl("button", {
            text: "Select this folder",
            cls: "mod-cta"
        });
        selectButton.addEventListener("click", () => {
            if (this.selectedFolder) {
                this.onSelect(this.selectedFolder);
                this.close();
            } else {
                new Notice("⚠️ Please select a folder first");
            }
        });

        // Button 2: Create subfolder
        const createButton = buttonContainer.createEl("button", {
            text: "Create subfolder here"
        });
        createButton.addEventListener("click", () => {
            const parentPath = this.selectedFolder?.path || "";
            this.close();
            this.promptCreateFolder(parentPath);
        });
    }

    getSuggestions(query: string): TFolder[] {
        const folders = this.app.vault.getAllLoadedFiles()
            .filter((f): f is TFolder => f instanceof TFolder);

        if (!query) {
            return folders.slice(0, 100); // Show first 100 folders when no query
        }

        const lowerQuery = query.toLowerCase();
        return folders
            .filter(f => f.path.toLowerCase().includes(lowerQuery))
            .slice(0, 100); // Limit to 100 results
    }

    renderSuggestion(folder: TFolder, el: HTMLElement): void {
        el.createEl("div", { text: folder.path, cls: "suggestion-content" });

        // Add click handler to track selection
        el.addEventListener("click", () => {
            // Remove previous selection highlight
            if (this.selectedEl) {
                this.selectedEl.style.backgroundColor = "";
            }

            // Highlight this element
            el.style.backgroundColor = "var(--background-modifier-hover)";
            this.selectedEl = el;
            this.selectedFolder = folder;
        });
    }

    onChooseSuggestion(folder: TFolder, _evt: MouseEvent | KeyboardEvent): void {
        this.selectedFolder = folder;
        // Don't close immediately - let user choose between "Select" or "Create subfolder"
    }

    private promptCreateFolder(parentPath: string): void {
        const modal = new CreateFolderModal(this.app, parentPath, async (subfolderName: string) => {
            const fullPath = parentPath ? `${parentPath}/${subfolderName}` : subfolderName;

            try {
                await this.app.vault.createFolder(fullPath);
                new Notice(`✅ Folder created: ${fullPath}`);

                // Pass the created path to onCreate callback (don't create it again!)
                this.onCreate(fullPath);
            } catch (error) {
                if (error.message && error.message.includes("Folder already exists")) {
                    new Notice(`⚠️ Folder already exists: ${fullPath}`);
                    this.onCreate(fullPath); // Still use it
                } else {
                    new Notice(`❌ Failed to create folder: ${error.message}`);
                }
            }
        });
        modal.open();
    }
}

/**
 * Modal for creating a new folder
 */
class CreateFolderModal extends Modal {
    private onSubmit: (subfolderName: string) => void;
    private parentPath: string;

    constructor(app: App, parentPath: string, onSubmit: (subfolderName: string) => void) {
        super(app);
        this.parentPath = parentPath;
        this.onSubmit = onSubmit;
    }

    onOpen(): void {
        const { contentEl } = this;

        contentEl.createEl("h3", { text: "Create new subfolder" });

        // Show parent path
        if (this.parentPath) {
            const parentInfo = contentEl.createDiv({ cls: "setting-item-description" });
            parentInfo.style.marginBottom = "10px";
            parentInfo.setText(`Parent folder: ${this.parentPath}`);
        } else {
            const parentInfo = contentEl.createDiv({ cls: "setting-item-description" });
            parentInfo.style.marginBottom = "10px";
            parentInfo.setText(`Creating folder at vault root`);
        }

        const inputContainer = contentEl.createDiv({ cls: "setting-item" });
        inputContainer.style.border = "none";
        inputContainer.style.paddingTop = "0";

        const input = inputContainer.createEl("input", {
            type: "text",
            placeholder: "Subfolder name (e.g., Reports)"
        });
        input.style.width = "100%";
        input.style.marginBottom = "20px";

        const buttonContainer = contentEl.createDiv({ cls: "modal-button-container" });

        const cancelButton = buttonContainer.createEl("button", { text: "Cancel" });
        cancelButton.addEventListener("click", () => this.close());

        const createButton = buttonContainer.createEl("button", {
            text: "Create",
            cls: "mod-cta"
        });
        createButton.addEventListener("click", () => {
            const subfolderName = input.value.trim();
            if (subfolderName) {
                this.onSubmit(subfolderName);
                this.close();
            } else {
                new Notice("⚠️ Please enter a subfolder name");
            }
        });

        // Focus input and handle Enter key
        input.focus();
        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                const subfolderName = input.value.trim();
                if (subfolderName) {
                    this.onSubmit(subfolderName);
                    this.close();
                } else {
                    new Notice("⚠️ Please enter a subfolder name");
                }
            } else if (e.key === "Escape") {
                this.close();
            }
        });
    }

    onClose(): void {
        const { contentEl } = this;
        contentEl.empty();
    }
}

