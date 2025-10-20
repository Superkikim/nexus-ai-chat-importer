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

    constructor(app: App, onSelect: (folder: TFolder) => void, onCreate: (path: string) => void) {
        super(app);
        this.onSelect = onSelect;
        this.onCreate = onCreate;
        
        this.setPlaceholder("Type to search folders...");
    }

    onOpen(): void {
        super.onOpen();
        
        // Add "Create new folder" button at the bottom
        const buttonContainer = this.modalEl.createDiv({ cls: "modal-button-container" });
        buttonContainer.style.padding = "10px";
        buttonContainer.style.borderTop = "1px solid var(--background-modifier-border)";
        
        const createButton = buttonContainer.createEl("button", {
            text: "Create new folder",
            cls: "mod-cta"
        });
        
        createButton.addEventListener("click", () => {
            this.close();
            this.promptCreateFolder();
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
    }

    onChooseSuggestion(folder: TFolder, _evt: MouseEvent | KeyboardEvent): void {
        this.onSelect(folder);
    }

    private promptCreateFolder(): void {
        const modal = new CreateFolderModal(this.app, async (path: string) => {
            try {
                await this.app.vault.createFolder(path);
                new Notice(`✅ Folder created: ${path}`);
                
                // Get the created folder and pass it to onCreate callback
                const createdFolder = this.app.vault.getAbstractFileByPath(path);
                if (createdFolder instanceof TFolder) {
                    this.onCreate(path);
                }
            } catch (error) {
                if (error.message && error.message.includes("Folder already exists")) {
                    new Notice(`⚠️ Folder already exists: ${path}`);
                    this.onCreate(path); // Still use it
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
    private onSubmit: (path: string) => void;

    constructor(app: App, onSubmit: (path: string) => void) {
        super(app);
        this.onSubmit = onSubmit;
    }

    onOpen(): void {
        const { contentEl } = this;
        
        contentEl.createEl("h3", { text: "Create new folder" });

        const inputContainer = contentEl.createDiv({ cls: "setting-item" });
        inputContainer.style.border = "none";
        inputContainer.style.paddingTop = "0";
        
        const input = inputContainer.createEl("input", {
            type: "text",
            placeholder: "Folder path (e.g., My Folder/Subfolder)"
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
            const path = input.value.trim();
            if (path) {
                this.onSubmit(path);
                this.close();
            } else {
                new Notice("⚠️ Please enter a folder path");
            }
        });

        // Focus input and handle Enter key
        input.focus();
        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                const path = input.value.trim();
                if (path) {
                    this.onSubmit(path);
                    this.close();
                } else {
                    new Notice("⚠️ Please enter a folder path");
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

