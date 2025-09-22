// src/dialogs/enhanced-file-selection-dialog.ts
import { App, Modal, Setting } from "obsidian";
import { FileSelectionResult, ImportMode } from "../types/conversation-selection";

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
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('nexus-file-selection-dialog');

        // Title
        const title = contentEl.createEl("h2", { 
            text: `Import ${this.provider.charAt(0).toUpperCase() + this.provider.slice(1)} Conversations` 
        });
        title.style.marginBottom = "20px";

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
        section.style.marginBottom = "25px";
        section.style.padding = "15px";
        section.style.border = "1px solid var(--background-modifier-border)";
        section.style.borderRadius = "8px";

        const sectionTitle = section.createEl("h3", { text: "Import Mode" });
        sectionTitle.style.marginTop = "0";
        sectionTitle.style.marginBottom = "15px";

        // Import All option
        const allOption = section.createDiv('import-option');
        allOption.style.marginBottom = "10px";

        const allRadio = allOption.createEl("input", { type: "radio" });
        allRadio.name = "importMode";
        allRadio.value = "all";
        allRadio.checked = this.importMode === 'all';
        allRadio.id = "import-all";
        allRadio.addEventListener('change', () => {
            this.importMode = 'all';
            this.updateImportModeDescription();
        });

        const allLabel = allOption.createEl("label");
        allLabel.htmlFor = "import-all";
        allLabel.style.marginLeft = "8px";
        allLabel.style.fontWeight = "500";
        allLabel.textContent = "Import All Conversations";

        const allDesc = allOption.createDiv();
        allDesc.style.marginLeft = "24px";
        allDesc.style.fontSize = "0.9em";
        allDesc.style.color = "var(--text-muted)";
        allDesc.textContent = "Import all conversations from the selected files (faster)";

        // Select Specific option
        const selectOption = section.createDiv('import-option');

        const selectRadio = selectOption.createEl("input", { type: "radio" });
        selectRadio.name = "importMode";
        selectRadio.value = "selective";
        selectRadio.checked = this.importMode === 'selective';
        selectRadio.id = "import-selective";
        selectRadio.addEventListener('change', () => {
            this.importMode = 'selective';
            this.updateImportModeDescription();
        });

        const selectLabel = selectOption.createEl("label");
        selectLabel.htmlFor = "import-selective";
        selectLabel.style.marginLeft = "8px";
        selectLabel.style.fontWeight = "500";
        selectLabel.textContent = "Select Specific Conversations";

        const selectDesc = selectOption.createDiv();
        selectDesc.style.marginLeft = "24px";
        selectDesc.style.fontSize = "0.9em";
        selectDesc.style.color = "var(--text-muted)";
        selectDesc.textContent = "Preview and choose which conversations to import";
    }

    private createFileSelectionArea(container: HTMLElement) {
        const section = container.createDiv('file-selection-section');
        section.style.marginBottom = "20px";

        const sectionTitle = section.createEl("h3", { text: "Select Files" });
        sectionTitle.style.marginBottom = "15px";

        // Drop zone
        const dropZone = section.createDiv('drop-zone');
        dropZone.style.border = "2px dashed var(--background-modifier-border)";
        dropZone.style.borderRadius = "8px";
        dropZone.style.padding = "40px 20px";
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
        dropText.textContent = "Drop ZIP files here or click to browse";

        const dropSubtext = dropZone.createEl("div");
        dropSubtext.style.fontSize = "14px";
        dropSubtext.style.color = "var(--text-muted)";
        dropSubtext.textContent = "Supports multiple file selection";

        // File input (hidden)
        const fileInput = section.createEl("input", { type: "file" });
        fileInput.accept = ".zip";
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

        const sectionTitle = section.createEl("h3", { text: "Selected Files" });
        sectionTitle.style.marginBottom = "15px";

        const fileList = section.createDiv('file-list');
        fileList.id = 'file-list';
    }

    private createActionButtons(container: HTMLElement) {
        const buttonContainer = container.createDiv('action-buttons');
        buttonContainer.style.display = "flex";
        buttonContainer.style.justifyContent = "flex-end";
        buttonContainer.style.gap = "10px";
        buttonContainer.style.marginTop = "20px";

        // Cancel button
        const cancelButton = buttonContainer.createEl("button", { text: "Cancel" });
        cancelButton.style.padding = "8px 16px";
        cancelButton.addEventListener('click', () => this.close());

        // Import button
        const importButton = buttonContainer.createEl("button", { text: "Continue" });
        importButton.id = 'import-button';
        importButton.style.padding = "8px 16px";
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
            const files = Array.from(event.dataTransfer.files).filter(file => 
                file.name.toLowerCase().endsWith('.zip')
            );
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
                fileSize.textContent = this.formatFileSize(file.size);
                fileSize.style.fontSize = "0.9em";
                fileSize.style.color = "var(--text-muted)";

                const removeButton = fileItem.createEl("button", { text: "Remove" });
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

    private formatFileSize(bytes: number): string {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    private addCustomStyles() {
        // Add any additional custom styles if needed
        const style = document.createElement('style');
        style.textContent = `
            .nexus-file-selection-dialog .modal-content {
                max-width: 600px;
            }
            .nexus-file-selection-dialog .drop-zone:hover {
                border-color: var(--interactive-accent);
                background-color: var(--background-modifier-hover);
            }
        `;
        document.head.appendChild(style);
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
