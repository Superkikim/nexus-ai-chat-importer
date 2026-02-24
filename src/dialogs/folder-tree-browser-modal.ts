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

import { App, Modal, Notice, TFolder } from "obsidian";
import { t } from '../i18n';

/**
 * Tree-based folder browser with fold/unfold navigation
 * Allows browsing existing folders, creating new folders, and selecting a target folder
 */
export class FolderTreeBrowserModal extends Modal {
    private onSubmit: (path: string) => void;
    private validatePath?: (path: string) => { valid: boolean; error?: string };
    private selectedFolder: TFolder | null = null;
    private expandedFolders: Set<string> = new Set();
    private treeContainer!: HTMLElement;
    private createdFolders: Set<string> = new Set(); // Track folders created during this session

    constructor(
        app: App,
        onSubmit: (path: string) => void,
        initialPath?: string,
        validatePath?: (path: string) => { valid: boolean; error?: string }
    ) {
        super(app);
        this.onSubmit = onSubmit;
        this.validatePath = validatePath;

        // Pre-expand and select the initial path if provided
        if (initialPath) {
            const folder = this.app.vault.getAbstractFileByPath(initialPath);
            if (folder instanceof TFolder) {
                this.selectedFolder = folder;
                // Expand all parent folders
                let current = folder.parent;
                while (current && current.path !== "/") {
                    this.expandedFolders.add(current.path);
                    current = current.parent;
                }
                this.expandedFolders.add(folder.path);
            }
        }
    }

    onOpen(): void {
        const { contentEl } = this;
        
        contentEl.createEl("h3", { text: t('folder_browser.title') });

        // Tree container with scroll
        this.treeContainer = contentEl.createDiv({ cls: "nexus-folder-tree-container" });
        this.treeContainer.style.maxHeight = "400px";
        this.treeContainer.style.overflowY = "auto";
        this.treeContainer.style.marginBottom = "20px";
        this.treeContainer.style.border = "1px solid var(--background-modifier-border)";
        this.treeContainer.style.borderRadius = "4px";
        this.treeContainer.style.padding = "8px";

        // Render the tree
        this.renderTree();

        // Buttons
        const buttonContainer = contentEl.createDiv({ cls: "modal-button-container" });
        buttonContainer.style.display = "flex";
        buttonContainer.style.gap = "8px";
        buttonContainer.style.justifyContent = "flex-end";

        const createButton = buttonContainer.createEl("button", { text: t('folder_browser.buttons.create_new_folder') });
        createButton.addEventListener("click", () => this.handleCreateFolder());

        const cancelButton = buttonContainer.createEl("button", { text: t('folder_browser.buttons.cancel') });
        cancelButton.addEventListener("click", () => this.handleCancel());

        const selectButton = buttonContainer.createEl("button", {
            text: t('folder_browser.buttons.select'),
            cls: "mod-cta"
        });
        selectButton.addEventListener("click", () => this.handleSelect());
    }

    private renderTree(): void {
        this.treeContainer.empty();

        // Get vault root
        const root = this.app.vault.getRoot();
        
        // Render vault root as special case
        const rootItem = this.treeContainer.createDiv({ cls: "nexus-tree-item" });
        rootItem.style.display = "flex";
        rootItem.style.alignItems = "center";
        rootItem.style.padding = "4px 8px";
        rootItem.style.cursor = "pointer";
        rootItem.style.borderRadius = "4px";

        if (this.selectedFolder === root) {
            rootItem.style.backgroundColor = "var(--background-modifier-hover)";
        }

        const rootIcon = rootItem.createSpan({ text: "📁 " });
        const rootLabel = rootItem.createSpan({ text: t('folder_browser.vault_root') });
        rootLabel.style.fontWeight = "bold";

        rootItem.addEventListener("click", (e) => {
            e.stopPropagation();
            this.handleFolderClick(root);
        });

        // Render children of root
        this.renderFolderChildren(root, 0);
    }

    private renderFolderChildren(folder: TFolder, depth: number): void {
        const children = folder.children
            .filter(child => child instanceof TFolder)
            .sort((a, b) => a.name.localeCompare(b.name)) as TFolder[];

        for (const child of children) {
            this.renderFolder(child, depth + 1);
        }
    }

    private renderFolder(folder: TFolder, depth: number): void {
        const isExpanded = this.expandedFolders.has(folder.path);
        const isSelected = this.selectedFolder?.path === folder.path;
        const hasChildren = folder.children.some(c => c instanceof TFolder);

        // Folder item
        const item = this.treeContainer.createDiv({ cls: "nexus-tree-item" });
        item.style.display = "flex";
        item.style.alignItems = "center";
        item.style.padding = "4px 8px";
        item.style.paddingLeft = `${depth * 20 + 8}px`;
        item.style.cursor = "pointer";
        item.style.borderRadius = "4px";

        if (isSelected) {
            item.style.backgroundColor = "var(--background-modifier-hover)";
            item.style.fontWeight = "bold";
        }

        // Expand/collapse icon
        const expandIcon = item.createSpan();
        expandIcon.style.width = "16px";
        expandIcon.style.marginRight = "4px";
        
        if (hasChildren) {
            expandIcon.setText(isExpanded ? "▼" : "▶");
        } else {
            expandIcon.setText(" ");
        }

        // Folder icon and name
        item.createSpan({ text: "📁 " });
        item.createSpan({ text: folder.name });

        // Click handler
        item.addEventListener("click", (e) => {
            e.stopPropagation();
            this.handleFolderClick(folder);
        });

        // Hover effect
        item.addEventListener("mouseenter", () => {
            if (!isSelected) {
                item.style.backgroundColor = "var(--background-modifier-hover-light)";
            }
        });
        item.addEventListener("mouseleave", () => {
            if (!isSelected) {
                item.style.backgroundColor = "";
            }
        });

        // Render children if expanded
        if (isExpanded && hasChildren) {
            this.renderFolderChildren(folder, depth);
        }
    }

    private handleFolderClick(folder: TFolder): void {
        const wasExpanded = this.expandedFolders.has(folder.path);
        
        // If clicking the same folder, just toggle expand/collapse
        if (this.selectedFolder?.path === folder.path) {
            if (wasExpanded) {
                this.expandedFolders.delete(folder.path);
                // Collapse all children recursively
                this.collapseAllChildren(folder);
            } else {
                this.expandedFolders.add(folder.path);
            }
        } else {
            // Clicking a different folder
            // Collapse siblings of the new selection at the same level
            if (folder.parent) {
                const siblings = folder.parent.children.filter(c => c instanceof TFolder) as TFolder[];
                for (const sibling of siblings) {
                    if (sibling.path !== folder.path) {
                        this.expandedFolders.delete(sibling.path);
                        this.collapseAllChildren(sibling);
                    }
                }
            }
            
            // Select and expand the new folder
            this.selectedFolder = folder;
            this.expandedFolders.add(folder.path);
        }

        // Re-render the tree
        this.renderTree();
    }

    private collapseAllChildren(folder: TFolder): void {
        for (const child of folder.children) {
            if (child instanceof TFolder) {
                this.expandedFolders.delete(child.path);
                this.collapseAllChildren(child);
            }
        }
    }

    private async handleCreateFolder(): Promise<void> {
        if (!this.selectedFolder) {
            new Notice(t('folder_browser.notices.select_parent_first'));
            return;
        }

        // Prompt for folder name
        const folderName = await this.promptForFolderName();
        if (!folderName) {
            return;
        }

        // Validate folder name
        if (folderName.includes('/') || folderName.includes('\\') || 
            folderName.includes(':') || folderName.includes('*') ||
            folderName.includes('?') || folderName.includes('"') || 
            folderName.includes('<') || folderName.includes('>') || 
            folderName.includes('|')) {
            new Notice(t('folder_browser.notices.invalid_name'));
            return;
        }

        // Build full path
        const parentPath = this.selectedFolder.path === "/" ? "" : this.selectedFolder.path;
        const newFolderPath = parentPath ? `${parentPath}/${folderName}` : folderName;

        // Check if folder already exists
        const exists = this.app.vault.getAbstractFileByPath(newFolderPath);
        if (exists) {
            new Notice(t('folder_browser.notices.already_exists'));
            return;
        }

        // Validate the path BEFORE creating the folder
        if (this.validatePath) {
            const validation = this.validatePath(newFolderPath);
            if (!validation.valid) {
                new Notice(t('folder_browser.notices.invalid_location', { error: validation.error ?? "Invalid folder location" }));
                return;
            }
        }

        // Create the folder
        try {
            await this.app.vault.createFolder(newFolderPath);

            // Track this folder as created during this session
            this.createdFolders.add(newFolderPath);

            new Notice(t('folder_browser.notices.created_success', { name: folderName }));

            // Expand parent and select the new folder
            this.expandedFolders.add(this.selectedFolder.path);
            const newFolder = this.app.vault.getAbstractFileByPath(newFolderPath);
            if (newFolder instanceof TFolder) {
                this.selectedFolder = newFolder;
                this.expandedFolders.add(newFolder.path);
            }

            // Re-render the tree
            this.renderTree();
        } catch (error: any) {
            new Notice(t('folder_browser.notices.create_failed', { error: error.message }));
        }
    }

    private promptForFolderName(): Promise<string | null> {
        return new Promise((resolve) => {
            const modal = new Modal(this.app);
            modal.titleEl.setText(t('folder_browser.create_folder_dialog.title'));

            const inputContainer = modal.contentEl.createDiv();
            inputContainer.style.marginBottom = "20px";

            inputContainer.createEl("label", { text: t('folder_browser.create_folder_dialog.folder_name_label') });
            const input = inputContainer.createEl("input", { type: "text" });
            input.style.width = "100%";
            input.style.marginTop = "8px";

            const buttonContainer = modal.contentEl.createDiv({ cls: "modal-button-container" });

            const cancelButton = buttonContainer.createEl("button", { text: t('folder_browser.create_folder_dialog.buttons.cancel') });
            cancelButton.addEventListener("click", () => {
                modal.close();
                resolve(null);
            });

            const createButton = buttonContainer.createEl("button", {
                text: t('folder_browser.create_folder_dialog.buttons.create'),
                cls: "mod-cta"
            });
            createButton.addEventListener("click", () => {
                const value = input.value.trim();
                modal.close();
                resolve(value || null);
            });

            input.addEventListener("keydown", (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    const value = input.value.trim();
                    modal.close();
                    resolve(value || null);
                } else if (e.key === "Escape") {
                    modal.close();
                    resolve(null);
                }
            });

            modal.open();
            input.focus();
        });
    }

    private handleSelect(): void {
        if (!this.selectedFolder) {
            new Notice(t('folder_browser.notices.select_first'));
            return;
        }

        const path = this.selectedFolder.path === "/" ? "" : this.selectedFolder.path;

        // Validate the path before submitting
        if (this.validatePath) {
            const validation = this.validatePath(path);
            if (!validation.valid) {
                new Notice(t('folder_browser.notices.invalid_location', { error: validation.error ?? "Invalid folder location" }));
                return;
            }
        }

        // Clear created folders list since user is selecting a folder
        this.createdFolders.clear();

        this.onSubmit(path);
        this.close();
    }

    private async handleCancel(): Promise<void> {
        // Delete all empty folders created during this session
        await this.cleanupCreatedFolders();
        this.close();
    }

    private async cleanupCreatedFolders(): Promise<void> {
        // Sort folders by depth (deepest first) to delete children before parents
        const sortedFolders = Array.from(this.createdFolders).sort((a, b) => {
            const depthA = a.split('/').length;
            const depthB = b.split('/').length;
            return depthB - depthA; // Descending order
        });

        for (const folderPath of sortedFolders) {
            try {
                const folder = this.app.vault.getAbstractFileByPath(folderPath);
                if (folder instanceof TFolder && folder.children.length === 0) {
                    await this.app.vault.delete(folder);
                }
            } catch (error) {
                // Silently ignore errors (folder might have been deleted already)
            }
        }
    }

    onClose(): void {
        const { contentEl } = this;
        contentEl.empty();
    }
}

