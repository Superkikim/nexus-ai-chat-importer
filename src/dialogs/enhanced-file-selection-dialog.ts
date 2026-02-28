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


// src/dialogs/enhanced-file-selection-dialog.ts
import { App, Modal, Notice, Setting } from "obsidian";
import { FileSelectionResult, ImportMode } from "../types/conversation-selection";
import { formatFileSize } from "../utils/file-utils";
import { t } from '../i18n';

export class EnhancedFileSelectionDialog extends Modal {
    private selectedFiles: File[] = [];
    private importMode: ImportMode = 'all';
    private provider: string;
    private onFileSelectionComplete: (result: FileSelectionResult) => void;
    private dragCounter = 0;
    private lastImportMode: ImportMode | null = null;

    constructor(
        app: App,
        provider: string,
        onFileSelectionComplete: (result: FileSelectionResult) => void,
        private plugin?: any // Plugin instance to access settings
    ) {
        super(app);
        this.provider = provider;
        this.onFileSelectionComplete = onFileSelectionComplete;

        // Set initial import mode based on settings
        this.setInitialImportMode();
    }

    onOpen() {
        const { contentEl, modalEl, titleEl } = this;
        contentEl.empty();

        // Add class to both modal and content
        modalEl.addClass('nexus-file-selection-dialog');
        contentEl.addClass('nexus-file-selection-dialog');

        // Set title in modal title bar
        titleEl.setText(t('file_selection.title', { provider: this.provider.charAt(0).toUpperCase() + this.provider.slice(1) }));

        // Import mode selection
        this.createImportModeSection(contentEl);

        // File selection area
        this.createFileSelectionArea(contentEl);

        // Selected files preview
        this.createFilePreviewArea(contentEl);

        // Action buttons
        this.createActionButtons(contentEl);

        // Add custom styles
        this.addCustomStyles();
    }

    private createImportModeSection(container: HTMLElement) {
        const section = container.createDiv('import-mode-section');
        section.style.marginBottom = "20px";

        const sectionTitle = section.createEl("h3", { text: t('file_selection.import_mode.section_title') });
        sectionTitle.style.marginTop = "0";
        sectionTitle.style.marginBottom = "12px";
        sectionTitle.style.fontSize = "1em";

        // Two options side by side - clean and readable
        const optionsContainer = section.createDiv('import-options-container');
        optionsContainer.style.display = "grid";
        optionsContainer.style.gridTemplateColumns = "1fr 1fr";
        optionsContainer.style.gap = "12px";

        // Import All option
        const allOption = optionsContainer.createDiv('import-option-box');
        allOption.style.padding = "14px 16px";
        allOption.style.border = "1px solid var(--background-modifier-border)";
        allOption.style.borderRadius = "6px";
        allOption.style.cursor = "pointer";
        allOption.style.transition = "all 0.2s";
        allOption.style.display = "flex";
        allOption.style.alignItems = "center";
        allOption.style.gap = "10px";
        allOption.style.backgroundColor = "var(--background-primary)";

        if (this.importMode === 'all') {
            allOption.style.borderColor = "var(--interactive-accent)";
            allOption.style.borderWidth = "2px";
        }

        const allRadio = allOption.createEl("input", { type: "radio" });
        allRadio.name = "importMode";
        allRadio.value = "all";
        allRadio.checked = this.importMode === 'all';
        allRadio.id = "import-all";
        allRadio.addEventListener('change', () => {
            this.importMode = 'all';
            this.updateImportModeDescription();
            this.updateImportModeBoxes();
        });

        const allContent = allOption.createDiv();
        allContent.style.flex = "1";

        const allLabel = allContent.createEl("label");
        allLabel.htmlFor = "import-all";
        allLabel.style.display = "block";
        allLabel.style.fontWeight = "500";
        allLabel.style.marginBottom = "4px";
        allLabel.style.cursor = "pointer";
        allLabel.style.color = "var(--text-normal)";
        allLabel.textContent = t('file_selection.import_mode.all_label');

        const allDesc = allContent.createDiv();
        allDesc.style.fontSize = "0.85em";
        allDesc.style.color = "var(--text-muted)";
        allDesc.textContent = t('file_selection.import_mode.all_description');

        allOption.addEventListener('click', () => {
            allRadio.checked = true;
            this.importMode = 'all';
            this.updateImportModeDescription();
            this.updateImportModeBoxes();
        });

        // Select Specific option
        const selectOption = optionsContainer.createDiv('import-option-box');
        selectOption.style.padding = "14px 16px";
        selectOption.style.border = "1px solid var(--background-modifier-border)";
        selectOption.style.borderRadius = "6px";
        selectOption.style.cursor = "pointer";
        selectOption.style.transition = "all 0.2s";
        selectOption.style.display = "flex";
        selectOption.style.alignItems = "center";
        selectOption.style.gap = "10px";
        selectOption.style.backgroundColor = "var(--background-primary)";

        if (this.importMode === 'selective') {
            selectOption.style.borderColor = "var(--interactive-accent)";
            selectOption.style.borderWidth = "2px";
        }

        const selectRadio = selectOption.createEl("input", { type: "radio" });
        selectRadio.name = "importMode";
        selectRadio.value = "selective";
        selectRadio.checked = this.importMode === 'selective';
        selectRadio.id = "import-selective";
        selectRadio.addEventListener('change', () => {
            this.importMode = 'selective';
            this.updateImportModeDescription();
            this.updateImportModeBoxes();
        });

        const selectContent = selectOption.createDiv();
        selectContent.style.flex = "1";

        const selectLabel = selectContent.createEl("label");
        selectLabel.htmlFor = "import-selective";
        selectLabel.style.display = "block";
        selectLabel.style.fontWeight = "500";
        selectLabel.style.marginBottom = "4px";
        selectLabel.style.cursor = "pointer";
        selectLabel.style.color = "var(--text-normal)";
        selectLabel.textContent = t('file_selection.import_mode.selective_label');

        const selectDesc = selectContent.createDiv();
        selectDesc.style.fontSize = "0.85em";
        selectDesc.style.color = "var(--text-muted)";
        selectDesc.textContent = t('file_selection.import_mode.selective_description');

        selectOption.addEventListener('click', () => {
            selectRadio.checked = true;
            this.importMode = 'selective';
            this.updateImportModeDescription();
            this.updateImportModeBoxes();
        });
    }

    private updateImportModeBoxes() {
        const boxes = this.contentEl.querySelectorAll<HTMLElement>('.import-option-box');
        boxes.forEach((box, index) => {
            const isSelected = (index === 0 && this.importMode === 'all') ||
                             (index === 1 && this.importMode === 'selective');

            if (isSelected) {
                box.style.borderColor = "var(--interactive-accent)";
                box.style.borderWidth = "2px";
            } else {
                box.style.borderColor = "var(--background-modifier-border)";
                box.style.borderWidth = "1px";
            }
        });
    }

    private createFileSelectionArea(container: HTMLElement) {
        const section = container.createDiv('file-selection-section');
        section.style.marginBottom = "20px";

        const sectionTitle = section.createEl("h3", { text: t('file_selection.file_area.section_title') });
        sectionTitle.style.marginBottom = "10px";
        sectionTitle.style.fontSize = "1em";

        // Drop zone - more compact
        const dropZone = section.createDiv('drop-zone');
        dropZone.style.border = "2px dashed var(--background-modifier-border)";
        dropZone.style.borderRadius = "8px";
        dropZone.style.padding = "24px 20px";
        dropZone.style.textAlign = "center";
        dropZone.style.cursor = "pointer";
        dropZone.style.transition = "all 0.2s ease";

        const dropIcon = dropZone.createEl("div");
        dropIcon.style.fontSize = "48px";
        dropIcon.style.marginBottom = "15px";
        dropIcon.textContent = "📁";

        const dropText = dropZone.createEl("div");
        dropText.style.fontSize = "16px";
        dropText.style.marginBottom = "10px";

        // Different text for Gemini (supports JSON index)
        if (this.provider === 'gemini') {
            dropText.textContent = t('file_selection.file_area.drop_text_gemini');
        } else {
            dropText.textContent = t('file_selection.file_area.drop_text_default');
        }

        const dropSubtext = dropZone.createEl("div");
        dropSubtext.style.fontSize = "14px";
        dropSubtext.style.color = "var(--text-muted)";

        if (this.provider === 'gemini') {
            dropSubtext.textContent = t('file_selection.file_area.drop_subtext_gemini');
        } else {
            dropSubtext.textContent = t('file_selection.file_area.drop_subtext_default');
        }

        // File input (hidden)
        const fileInput = section.createEl("input", { type: "file" });

        // For Gemini, accept both ZIP and JSON
        if (this.provider === 'gemini') {
            fileInput.accept = ".zip,.json";
        } else {
            fileInput.accept = ".zip";
        }

        fileInput.multiple = true;
        fileInput.style.display = "none";

        // Event handlers
        dropZone.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (e) => this.handleFileSelection(e));

        // Drag and drop handlers
        dropZone.addEventListener('dragover', (e) => this.handleDragOver(e, dropZone));
        dropZone.addEventListener('dragenter', (e) => this.handleDragEnter(e, dropZone));
        dropZone.addEventListener('dragleave', (e) => this.handleDragLeave(e, dropZone));
        dropZone.addEventListener('drop', (e) => this.handleDrop(e, dropZone));
    }

    private createFilePreviewArea(container: HTMLElement) {
        const section = container.createDiv('file-preview-section');
        section.id = 'file-preview-section';
        section.style.marginBottom = "20px";
        section.style.display = "none"; // Hidden initially

        const sectionTitle = section.createEl("h3", { text: t('file_selection.selected_files.section_title') });
        sectionTitle.style.marginBottom = "15px";

        // Scrollable container for file list
        const fileListContainer = section.createDiv('file-list-container');
        fileListContainer.style.maxHeight = "300px";
        fileListContainer.style.overflowY = "auto";
        fileListContainer.style.border = "1px solid var(--background-modifier-border)";
        fileListContainer.style.borderRadius = "6px";
        fileListContainer.style.padding = "8px";

        const fileList = fileListContainer.createDiv('file-list');
        fileList.id = 'file-list';
    }

    private createActionButtons(container: HTMLElement) {
        const buttonContainer = container.createDiv('action-buttons');
        buttonContainer.style.display = "flex";
        buttonContainer.style.justifyContent = "flex-end";
        buttonContainer.style.gap = "10px";
        buttonContainer.style.marginTop = "20px";

        // Cancel button
        const cancelButton = buttonContainer.createEl("button", { text: t('file_selection.buttons.cancel') });
        cancelButton.style.padding = "8px 16px";
        cancelButton.addEventListener('click', () => this.close());

        // Import button
        const importButton = buttonContainer.createEl("button", { text: t('file_selection.buttons.continue') });
        importButton.id = 'import-button';
        importButton.style.padding = "8px 16px";
        importButton.classList.add('mod-cta');
        importButton.disabled = true;
        importButton.addEventListener('click', () => this.handleImport());
    }

    private handleFileSelection(event: Event) {
        const input = event.target as HTMLInputElement;
        if (input.files) {
            const incoming = Array.from(input.files);
            const existingNames = new Set(this.selectedFiles.map(f => f.name));
            const duplicates = incoming.filter(f => existingNames.has(f.name));
            const unique = incoming.filter(f => !existingNames.has(f.name));
            this.selectedFiles = [...this.selectedFiles, ...unique];
            if (duplicates.length > 0) {
                new Notice(`${duplicates.length} duplicate file(s) ignored: ${duplicates.map(f => f.name).join(', ')}`);
            }
            this.updateFilePreview();
            this.updateImportButton();
        }
    }

    private handleDragOver(event: DragEvent, dropZone: HTMLElement) {
        event.preventDefault();
        dropZone.style.borderColor = "var(--interactive-accent)";
        dropZone.style.backgroundColor = "var(--background-modifier-hover)";
    }

    private handleDragEnter(event: DragEvent, dropZone: HTMLElement) {
        event.preventDefault();
        this.dragCounter++;
    }

    private handleDragLeave(event: DragEvent, dropZone: HTMLElement) {
        event.preventDefault();
        this.dragCounter--;
        if (this.dragCounter === 0) {
            dropZone.style.borderColor = "var(--background-modifier-border)";
            dropZone.style.backgroundColor = "transparent";
        }
    }

    private handleDrop(event: DragEvent, dropZone: HTMLElement) {
        event.preventDefault();
        this.dragCounter = 0;
        dropZone.style.borderColor = "var(--background-modifier-border)";
        dropZone.style.backgroundColor = "transparent";

        if (event.dataTransfer?.files) {
            const files = Array.from(event.dataTransfer.files).filter(file => {
                const fileName = file.name.toLowerCase();
                // For Gemini, allow both ZIP and JSON files
                if (this.provider === 'gemini') {
                    return fileName.endsWith('.zip') || fileName.endsWith('.json');
                }
                // For other providers, only ZIP
                return fileName.endsWith('.zip');
            });
            if (files.length > 0) {
                const existingNames = new Set(this.selectedFiles.map(f => f.name));
                const duplicates = files.filter(f => existingNames.has(f.name));
                const unique = files.filter(f => !existingNames.has(f.name));
                this.selectedFiles = [...this.selectedFiles, ...unique];
                if (duplicates.length > 0) {
                    new Notice(`${duplicates.length} duplicate file(s) ignored: ${duplicates.map(f => f.name).join(', ')}`);
                }
                this.updateFilePreview();
                this.updateImportButton();
            }
        }
    }

    private updateFilePreview() {
        const previewSection = this.contentEl.querySelector('#file-preview-section') as HTMLElement;
        const fileList = this.contentEl.querySelector('#file-list') as HTMLElement;

        if (this.selectedFiles.length > 0) {
            previewSection.style.display = "block";
            fileList.empty();

            this.selectedFiles.forEach((file, index) => {
                const fileItem = fileList.createDiv('file-item');
                fileItem.style.display = "flex";
                fileItem.style.justifyContent = "space-between";
                fileItem.style.alignItems = "center";
                fileItem.style.padding = "8px 12px";
                fileItem.style.border = "1px solid var(--background-modifier-border)";
                fileItem.style.borderRadius = "4px";
                fileItem.style.marginBottom = "8px";

                const fileInfo = fileItem.createDiv();
                fileInfo.style.display = "flex";
                fileInfo.style.flexDirection = "column";

                const fileName = fileInfo.createEl("span");
                fileName.textContent = file.name;
                fileName.style.fontWeight = "500";

                const fileSize = fileInfo.createEl("span");
                fileSize.textContent = formatFileSize(file.size);
                fileSize.style.fontSize = "0.9em";
                fileSize.style.color = "var(--text-muted)";

                const removeButton = fileItem.createEl("button", { text: t('file_selection.selected_files.remove_button') });
                removeButton.style.padding = "4px 8px";
                removeButton.style.fontSize = "0.9em";
                removeButton.addEventListener('click', () => this.removeFile(index));
            });
        } else {
            previewSection.style.display = "none";
        }
    }

    private removeFile(index: number) {
        this.selectedFiles.splice(index, 1);
        this.updateFilePreview();
        this.updateImportButton();
    }

    private updateImportButton() {
        const importButton = this.contentEl.querySelector('#import-button') as HTMLButtonElement;
        importButton.disabled = this.selectedFiles.length === 0;
    }

    private updateImportModeDescription() {
        // Could add dynamic description updates here if needed
    }

    private async handleImport() {
        if (this.selectedFiles.length > 0) {
            // Save last import mode if setting is enabled
            if (this.plugin?.settings?.rememberLastImportMode) {
                this.plugin.settings.defaultImportMode = this.importMode;
                await this.plugin.saveSettings();
            }

            const result: FileSelectionResult = {
                files: this.selectedFiles,
                mode: this.importMode,
                provider: this.provider
            };
            this.close();
            this.onFileSelectionComplete(result);
        }
    }

    private setInitialImportMode() {
        if (!this.plugin?.settings) {
            this.importMode = 'all';
            return;
        }

        // Use remembered last choice if enabled, otherwise use default
        if (this.plugin.settings.rememberLastImportMode && this.lastImportMode) {
            this.importMode = this.lastImportMode;
        } else {
            this.importMode = this.plugin.settings.defaultImportMode || 'all';
        }
    }



    private addCustomStyles() {
        const style = document.createElement('style');
        style.textContent = `
            /* Modal sizing - wider and responsive */
            .modal.nexus-file-selection-dialog {
                max-width: min(800px, 90vw) !important;
                width: min(800px, 90vw) !important;
                height: auto !important;
                padding: 0 !important;
            }

            /* Modal title spacing */
            .modal.nexus-file-selection-dialog .modal-title {
                padding: 16px 24px !important;
                margin: 0 !important;
            }

            .modal.nexus-file-selection-dialog .modal-content {
                max-width: 100% !important;
                width: 100% !important;
                max-height: 85vh;
                overflow-y: auto;
                display: flex;
                flex-direction: column;
                padding: 20px 24px 24px 24px;
            }

            /* Import mode boxes hover effect */
            .nexus-file-selection-dialog .import-option-box:hover {
                background-color: var(--background-modifier-hover);
            }

            /* Drop zone hover effect */
            .nexus-file-selection-dialog .drop-zone:hover {
                border-color: var(--interactive-accent);
                background-color: var(--background-modifier-hover);
            }

            /* File list container with custom scrollbar */
            .nexus-file-selection-dialog .file-list-container {
                scrollbar-width: thin;
                scrollbar-color: var(--background-modifier-border) transparent;
            }

            .nexus-file-selection-dialog .file-list-container::-webkit-scrollbar {
                width: 10px;
            }

            .nexus-file-selection-dialog .file-list-container::-webkit-scrollbar-track {
                background: transparent;
            }

            .nexus-file-selection-dialog .file-list-container::-webkit-scrollbar-thumb {
                background-color: var(--background-modifier-border);
                border-radius: 5px;
            }

            .nexus-file-selection-dialog .file-list-container::-webkit-scrollbar-thumb:hover {
                background-color: var(--text-muted);
            }
        `;
        document.head.appendChild(style);
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
