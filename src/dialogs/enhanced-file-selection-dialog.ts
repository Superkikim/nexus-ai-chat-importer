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
import { App, Modal, Setting } from "obsidian";
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
        const section = container.createDiv('import-mode-section nexus-dialog-section');

        section.createEl("h3", {
            text: t('file_selection.import_mode.section_title'),
            cls: 'nexus-dialog-title',
        });

        // Two options side by side - clean and readable
        const optionsContainer = section.createDiv('import-options-container nexus-import-options-grid');

        // Import All option
        const allOption = optionsContainer.createDiv('import-option-box nexus-option-box');
        allOption.toggleClass('is-selected', this.importMode === 'all');

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

        const allContent = allOption.createDiv({ cls: 'nexus-option-box-content' });

        const allLabel = allContent.createEl("label", { cls: 'nexus-option-box-label' });
        allLabel.htmlFor = "import-all";
        allLabel.textContent = t('file_selection.import_mode.all_label');

        const allDesc = allContent.createDiv({ cls: 'nexus-option-box-description' });
        allDesc.textContent = t('file_selection.import_mode.all_description');

        allOption.addEventListener('click', () => {
            allRadio.checked = true;
            this.importMode = 'all';
            this.updateImportModeDescription();
            this.updateImportModeBoxes();
        });

        // Select Specific option
        const selectOption = optionsContainer.createDiv('import-option-box nexus-option-box');
        selectOption.toggleClass('is-selected', this.importMode === 'selective');

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

        const selectContent = selectOption.createDiv({ cls: 'nexus-option-box-content' });

        const selectLabel = selectContent.createEl("label", { cls: 'nexus-option-box-label' });
        selectLabel.htmlFor = "import-selective";
        selectLabel.textContent = t('file_selection.import_mode.selective_label');

        const selectDesc = selectContent.createDiv({ cls: 'nexus-option-box-description' });
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
            box.toggleClass('is-selected', isSelected);
        });
    }

    private createFileSelectionArea(container: HTMLElement) {
        const section = container.createDiv('file-selection-section nexus-dialog-section');

        section.createEl("h3", {
            text: t('file_selection.file_area.section_title'),
            cls: 'nexus-dialog-title',
        });

        // Drop zone - more compact
        const dropZone = section.createDiv('drop-zone nexus-drop-zone');

        const dropIcon = dropZone.createEl("div", { cls: 'nexus-drop-zone-icon' });
        dropIcon.textContent = "📁";

        const dropText = dropZone.createEl("div", { cls: 'nexus-drop-zone-text' });

        // Different text for Gemini (supports JSON index)
        if (this.provider === 'gemini') {
            dropText.textContent = t('file_selection.file_area.drop_text_gemini');
        } else {
            dropText.textContent = t('file_selection.file_area.drop_text_default');
        }

        const dropSubtext = dropZone.createEl("div", { cls: 'nexus-drop-zone-subtext' });

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
        const section = container.createDiv('file-preview-section nexus-file-preview-section nexus-dialog-section');
        section.id = 'file-preview-section';

        section.createEl("h3", {
            text: t('file_selection.selected_files.section_title'),
            cls: 'nexus-dialog-title',
        });

        // Scrollable container for file list
        const fileListContainer = section.createDiv('file-list-container nexus-file-list-container');

        const fileList = fileListContainer.createDiv('file-list');
        fileList.id = 'file-list';
    }

    private createActionButtons(container: HTMLElement) {
        const buttonContainer = container.createDiv('action-buttons nexus-dialog-actions');

        // Cancel button
        const cancelButton = buttonContainer.createEl("button", { text: t('file_selection.buttons.cancel') });
        cancelButton.addEventListener('click', () => this.close());

        // Import button
        const importButton = buttonContainer.createEl("button", { text: t('file_selection.buttons.continue') });
        importButton.id = 'import-button';
        importButton.classList.add('mod-cta');
        importButton.disabled = true;
        importButton.addEventListener('click', () => this.handleImport());
    }

    private handleFileSelection(event: Event) {
        const input = event.target as HTMLInputElement;
        if (input.files) {
            this.selectedFiles = Array.from(input.files);
            this.updateFilePreview();
            this.updateImportButton();
        }
    }

    private handleDragOver(event: DragEvent, dropZone: HTMLElement) {
        event.preventDefault();
        dropZone.addClass('is-dragover');
    }

    private handleDragEnter(event: DragEvent, dropZone: HTMLElement) {
        event.preventDefault();
        this.dragCounter++;
    }

    private handleDragLeave(event: DragEvent, dropZone: HTMLElement) {
        event.preventDefault();
        this.dragCounter--;
        if (this.dragCounter === 0) {
            dropZone.removeClass('is-dragover');
        }
    }

    private handleDrop(event: DragEvent, dropZone: HTMLElement) {
        event.preventDefault();
        this.dragCounter = 0;
        dropZone.removeClass('is-dragover');

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
                this.selectedFiles = files;
                this.updateFilePreview();
                this.updateImportButton();
            }
        }
    }

    private updateFilePreview() {
        const previewSection = this.contentEl.querySelector('#file-preview-section') as HTMLElement;
        const fileList = this.contentEl.querySelector('#file-list') as HTMLElement;

        if (this.selectedFiles.length > 0) {
            previewSection.addClass('is-visible');
            fileList.empty();

            this.selectedFiles.forEach((file, index) => {
                const fileItem = fileList.createDiv('file-item nexus-file-list-item');

                const fileInfo = fileItem.createDiv({ cls: 'nexus-file-list-item-info' });

                const fileName = fileInfo.createEl("span", { cls: 'nexus-file-list-item-name' });
                fileName.textContent = file.name;

                const fileSize = fileInfo.createEl("span", { cls: 'nexus-file-list-item-size' });
                fileSize.textContent = formatFileSize(file.size);

                const removeButton = fileItem.createEl("button", {
                    text: t('file_selection.selected_files.remove_button'),
                    cls: 'nexus-file-list-remove',
                });
                removeButton.addEventListener('click', () => this.removeFile(index));
            });
        } else {
            previewSection.removeClass('is-visible');
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
            .modal.nexus-file-selection-dialog {
                max-width: min(800px, 90vw) !important;
                width: min(800px, 90vw) !important;
                height: auto !important;
                padding: 0 !important;
            }
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
            @media (max-width: 600px) {
                .modal.nexus-file-selection-dialog .modal-content {
                    padding: 14px 14px 18px 14px;
                }
            }
        `;
        document.head.appendChild(style);
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
