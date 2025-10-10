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


// src/dialogs/conversation-selection-dialog.ts
import { App, Modal, Setting } from "obsidian";
import { ConversationMetadata, AnalysisInfo } from "../services/conversation-metadata-extractor";
import {
    ConversationSelectionResult,
    ConversationSelectionState,
    PaginationSettings,
    SortOptions,
    FilterOptions
} from "../types/conversation-selection";

export class ConversationSelectionDialog extends Modal {
    private state: ConversationSelectionState;
    private onSelectionComplete: (result: ConversationSelectionResult) => void;
    private plugin?: any; // Plugin instance to access settings
    private analysisInfo?: AnalysisInfo; // Information about analysis and filtering

    constructor(
        app: App,
        conversations: ConversationMetadata[],
        onSelectionComplete: (result: ConversationSelectionResult) => void,
        plugin?: any,
        analysisInfo?: AnalysisInfo
    ) {
        super(app);
        this.onSelectionComplete = onSelectionComplete;
        this.plugin = plugin;
        this.analysisInfo = analysisInfo;

        // Get page size from settings (automatically memorized from last use)
        const pageSize = plugin?.settings?.lastConversationsPerPage || 50;

        // Initialize state
        this.state = {
            allConversations: conversations,
            filteredConversations: conversations,
            selectedIds: new Set(),
            pagination: {
                pageSize,
                currentPage: 1,
                totalPages: Math.ceil(conversations.length / pageSize),
                totalItems: conversations.length
            },
            sort: {
                field: 'updateTime',
                direction: 'desc'
            },
            filter: {
                existenceStatus: 'all' // Default to show all conversations
            },
            isLoading: false
        };

        // Auto-select all if setting is enabled
        if (plugin?.settings?.autoSelectAllOnOpen) {
            conversations.forEach(conv => {
                this.state.selectedIds.add(conv.id);
            });
        }

        this.applyFiltersAndSort();
    }

    onOpen() {
        const { contentEl, modalEl, titleEl } = this;
        contentEl.empty();

        // Add class to both modal and content for proper styling
        modalEl.addClass('nexus-conversation-selection-dialog');
        contentEl.addClass('nexus-conversation-selection-dialog');

        // Set title in modal title bar (not in content)
        titleEl.setText("Select Conversations to Import");

        // Summary (4 cartouches)
        this.createSummarySection(contentEl);

        // Controls (single line: Select All, Select None, Search, Show)
        this.createControlsSection(contentEl);

        // Conversation list with sortable headers
        this.createConversationListSection(contentEl);

        // Pagination
        this.createPaginationSection(contentEl);

        // Action buttons
        this.createActionButtons(contentEl);

        // Add custom styles
        this.addCustomStyles();

        // Initial render
        this.renderConversationList();
        this.updateSummary();
        this.updatePagination();
    }

    private createSummarySection(container: HTMLElement) {
        const section = container.createDiv('summary-section');
        section.id = 'conversation-summary';
        section.style.marginBottom = "20px";
        section.style.display = "grid";
        section.style.gridTemplateColumns = "repeat(4, 1fr)";
        section.style.gap = "12px";
        // Content will be updated by updateSummary()
    }

    private createControlsSection(container: HTMLElement) {
        const section = container.createDiv('controls-section');
        section.style.marginBottom = "20px";
        section.style.display = "flex";
        section.style.gap = "12px";
        section.style.alignItems = "center";

        // Select All button
        const selectAllBtn = section.createEl("button", { text: "Select All" });
        selectAllBtn.style.padding = "8px 16px";
        selectAllBtn.style.whiteSpace = "nowrap";
        selectAllBtn.addEventListener('click', () => {
            this.state.filteredConversations.forEach(conv => {
                this.state.selectedIds.add(conv.id);
            });
            this.renderConversationList();
            this.updateSummary();
        });

        // Select None button
        const selectNoneBtn = section.createEl("button", { text: "Select None" });
        selectNoneBtn.style.padding = "8px 16px";
        selectNoneBtn.style.whiteSpace = "nowrap";
        selectNoneBtn.addEventListener('click', () => {
            this.state.selectedIds.clear();
            this.renderConversationList();
            this.updateSummary();
        });

        // Search input
        const searchInput = section.createEl("input", { type: "text" });
        searchInput.placeholder = "Search conversations...";
        searchInput.style.flex = "1";
        searchInput.style.minWidth = "200px";
        searchInput.style.padding = "8px 12px";
        searchInput.style.border = "1px solid var(--background-modifier-border)";
        searchInput.style.borderRadius = "4px";
        searchInput.addEventListener('input', (e) => {
            const target = e.target as HTMLInputElement;
            this.state.filter.searchTerm = target.value;
            this.applyFiltersAndSort();
            this.renderConversationList();
            this.updateSummary();
            this.updatePagination();
        });

        // Filter by status dropdown
        const statusLabel = section.createEl("label");
        statusLabel.textContent = "Status:";
        statusLabel.style.marginRight = "4px";
        statusLabel.style.fontSize = "14px";
        statusLabel.style.whiteSpace = "nowrap";

        const statusSelect = section.createEl("select");
        statusSelect.style.padding = "8px 12px";
        statusSelect.style.paddingRight = "28px";
        statusSelect.style.border = "1px solid var(--background-modifier-border)";
        statusSelect.style.borderRadius = "4px";
        statusSelect.style.fontSize = "14px";
        statusSelect.style.backgroundColor = "var(--background-primary)";
        statusSelect.style.color = "var(--text-normal)";
        statusSelect.classList.add('nexus-custom-select');

        const statusOptions = [
            { value: 'all', text: 'All' },
            { value: 'new', text: 'New' },
            { value: 'updated', text: 'Updated' },
            { value: 'unchanged', text: 'Unchanged' }
        ];

        statusOptions.forEach(option => {
            const optionEl = statusSelect.createEl("option");
            optionEl.value = option.value;
            optionEl.textContent = option.text;
        });

        statusSelect.value = this.state.filter.existenceStatus || 'all';
        statusSelect.addEventListener('change', (e) => {
            const target = e.target as HTMLSelectElement;
            this.state.filter.existenceStatus = target.value as FilterOptions['existenceStatus'];
            this.applyFiltersAndSort();
            this.renderConversationList();
            this.updateSummary();
            this.updatePagination();
        });

        // Page size dropdown
        const pageSizeLabel = section.createEl("label");
        pageSizeLabel.textContent = "Show:";
        pageSizeLabel.style.marginRight = "4px";
        pageSizeLabel.style.fontSize = "14px";
        pageSizeLabel.style.whiteSpace = "nowrap";

        const pageSizeSelect = section.createEl("select");
        pageSizeSelect.style.padding = "8px 12px";
        pageSizeSelect.style.paddingRight = "28px";
        pageSizeSelect.style.border = "1px solid var(--background-modifier-border)";
        pageSizeSelect.style.borderRadius = "4px";
        pageSizeSelect.style.fontSize = "14px";
        pageSizeSelect.style.backgroundColor = "var(--background-primary)";
        pageSizeSelect.style.color = "var(--text-normal)";
        pageSizeSelect.classList.add('nexus-custom-select');

        const pageSizeOptions = [10, 20, 50, 100];
        pageSizeOptions.forEach(size => {
            const optionEl = pageSizeSelect.createEl("option");
            optionEl.value = size.toString();
            optionEl.textContent = size.toString();
        });

        pageSizeSelect.value = this.state.pagination.pageSize.toString();
        pageSizeSelect.addEventListener('change', async (e) => {
            const target = e.target as HTMLSelectElement;
            const newPageSize = parseInt(target.value);
            this.state.pagination.pageSize = newPageSize;
            this.state.pagination.currentPage = 1;

            // Automatically save to settings (memorize user's preference)
            if (this.plugin) {
                this.plugin.settings.lastConversationsPerPage = newPageSize;
                await this.plugin.saveSettings();
            }

            this.updatePagination();
            this.renderConversationList();
        });
    }



    private createConversationListSection(container: HTMLElement) {
        const section = container.createDiv('conversation-list-section');
        section.style.marginBottom = "20px";

        // Table container with scroll
        const tableContainer = section.createDiv('table-container');
        tableContainer.classList.add('nexus-table-container');

        // Table
        const table = tableContainer.createEl("table");
        table.id = 'conversation-table';
        table.style.width = "100%";
        table.style.borderCollapse = "collapse";

        // Table header
        const thead = table.createEl("thead");
        const headerRow = thead.createEl("tr");
        headerRow.style.backgroundColor = "var(--background-secondary)";
        headerRow.style.position = "sticky";
        headerRow.style.top = "0";
        headerRow.style.zIndex = "10";

        const headers = [
            { text: "", width: "40px", sortField: null }, // Checkbox - plus compact
            { text: "Title", width: "45%", sortField: 'title' as const }, // Plus d'espace
            { text: "Created", width: "110px", sortField: 'createTime' as const }, // Réduit
            { text: "Updated", width: "110px", sortField: 'updateTime' as const }, // Réduit
            { text: "Messages", width: "80px", sortField: 'messageCount' as const }, // Réduit
            { text: "Status", width: "100px", sortField: null } // Réduit
        ];

        headers.forEach(header => {
            const th = headerRow.createEl("th");
            th.style.padding = "12px 8px";
            th.style.textAlign = "left";
            th.style.borderBottom = "2px solid var(--background-modifier-border)";
            th.style.fontWeight = "600";
            th.style.backgroundColor = "var(--background-secondary)";
            th.style.userSelect = "none";
            if (header.width !== "auto") {
                th.style.width = header.width;
            }

            // Make sortable headers clickable
            if (header.sortField) {
                th.style.cursor = "pointer";
                th.classList.add('sortable-header');

                // Create header content with sort indicator
                const headerContent = th.createSpan();
                headerContent.textContent = header.text;

                const sortIndicator = th.createSpan();
                sortIndicator.classList.add('sort-indicator');
                sortIndicator.style.marginLeft = "6px";
                sortIndicator.style.fontSize = "0.8em";
                sortIndicator.style.opacity = "0.5";

                // Show current sort state
                if (this.state.sort.field === header.sortField) {
                    sortIndicator.textContent = this.state.sort.direction === 'asc' ? '▲' : '▼';
                    sortIndicator.style.opacity = "1";
                } else {
                    sortIndicator.textContent = '▼';
                }

                // Click handler for sorting
                th.addEventListener('click', () => {
                    if (this.state.sort.field === header.sortField) {
                        // Toggle direction
                        this.state.sort.direction = this.state.sort.direction === 'asc' ? 'desc' : 'asc';
                    } else {
                        // New field, default to desc
                        this.state.sort.field = header.sortField!;
                        this.state.sort.direction = 'desc';
                    }
                    this.applyFiltersAndSort();
                    this.renderConversationList();
                });
            } else {
                th.textContent = header.text;
            }
        });

        // Table body
        const tbody = table.createEl("tbody");
        tbody.id = 'conversation-table-body';
    }

    private createPaginationSection(container: HTMLElement) {
        const section = container.createDiv('pagination-section');
        section.id = 'pagination-section';
        section.style.marginBottom = "20px";
        section.style.display = "flex";
        section.style.justifyContent = "space-between";
        section.style.alignItems = "center";

        // Page info
        const pageInfo = section.createDiv();
        pageInfo.id = 'page-info';
        pageInfo.style.fontSize = "0.9em";
        pageInfo.style.color = "var(--text-muted)";

        // Page controls
        const pageControls = section.createDiv();
        pageControls.id = 'page-controls';
        pageControls.style.display = "flex";
        pageControls.style.gap = "8px";
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
        const importButton = buttonContainer.createEl("button", { text: "Import Selected" });
        importButton.id = 'import-selected-button';
        importButton.style.padding = "8px 16px";
        importButton.classList.add('mod-cta');
        importButton.addEventListener('click', () => this.handleImportSelected());
    }

    private applyFiltersAndSort() {
        let filtered = [...this.state.allConversations];

        // Apply search filter
        if (this.state.filter.searchTerm) {
            const searchTerm = this.state.filter.searchTerm.toLowerCase();
            filtered = filtered.filter(conv =>
                conv.title.toLowerCase().includes(searchTerm)
            );
        }

        // Apply existence status filter
        if (this.state.filter.existenceStatus && this.state.filter.existenceStatus !== 'all') {
            filtered = filtered.filter(conv =>
                conv.existenceStatus === this.state.filter.existenceStatus
            );
        }

        // Apply sorting
        filtered.sort((a, b) => {
            const { field, direction } = this.state.sort;
            let aVal: any = a[field];
            let bVal: any = b[field];

            if (field === 'title') {
                aVal = aVal.toLowerCase();
                bVal = bVal.toLowerCase();
            }

            if (aVal < bVal) return direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return direction === 'asc' ? 1 : -1;
            return 0;
        });

        this.state.filteredConversations = filtered;
        this.updatePagination();
    }

    private updatePagination() {
        const totalItems = this.state.filteredConversations.length;
        const totalPages = Math.ceil(totalItems / this.state.pagination.pageSize);
        
        this.state.pagination = {
            ...this.state.pagination,
            totalItems,
            totalPages,
            currentPage: Math.min(this.state.pagination.currentPage, totalPages || 1)
        };
    }

    private renderConversationList() {
        const tbody = this.contentEl.querySelector('#conversation-table-body') as HTMLElement;
        if (!tbody) return;

        tbody.empty();

        const { currentPage, pageSize } = this.state.pagination;
        const startIndex = (currentPage - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const pageConversations = this.state.filteredConversations.slice(startIndex, endIndex);

        pageConversations.forEach(conversation => {
            const row = tbody.createEl("tr");

            // Checkbox cell
            const checkboxCell = row.createEl("td");
            const checkbox = checkboxCell.createEl("input", { type: "checkbox" });
            checkbox.checked = this.state.selectedIds.has(conversation.id);
            checkbox.addEventListener('change', () => {
                if (checkbox.checked) {
                    this.state.selectedIds.add(conversation.id);
                } else {
                    this.state.selectedIds.delete(conversation.id);
                }
                this.updateSummary();
            });

            // Title cell
            const titleCell = row.createEl("td");
            titleCell.style.fontWeight = "500";
            titleCell.textContent = conversation.title;

            // Add source file info for multi-file imports
            if (conversation.sourceFile) {
                const sourceInfo = titleCell.createEl("div");
                sourceInfo.style.fontSize = "0.8em";
                sourceInfo.style.color = "var(--text-muted)";
                sourceInfo.style.marginTop = "4px";
                sourceInfo.textContent = `📁 ${conversation.sourceFile}`;
            }

            // Created cell
            const createdCell = row.createEl("td");
            createdCell.style.fontSize = "0.9em";
            createdCell.textContent = this.formatDate(conversation.createTime);

            // Updated cell
            const updatedCell = row.createEl("td");
            updatedCell.style.fontSize = "0.9em";
            updatedCell.textContent = this.formatDate(conversation.updateTime);

            // Messages cell
            const messagesCell = row.createEl("td");
            messagesCell.style.textAlign = "center";
            messagesCell.textContent = conversation.messageCount.toString();

            // Status cell with badge
            const statusCell = row.createEl("td");
            statusCell.style.textAlign = "center";
            const statusBadge = this.createStatusBadge(conversation);
            statusCell.appendChild(statusBadge);
        });

        this.renderPaginationControls();
    }

    private createStatusBadge(conversation: ConversationMetadata): HTMLElement {
        const badge = document.createElement("span");
        badge.classList.add('status-badge');

        switch (conversation.existenceStatus) {
            case 'new':
                badge.textContent = "New";
                badge.classList.add('status-new');
                badge.title = "This conversation is not in your vault";
                break;
            case 'updated':
                badge.textContent = "Updated";
                badge.classList.add('status-updated');
                badge.title = `This conversation has newer content than your vault (${this.formatDate(conversation.existingUpdateTime || 0)} → ${this.formatDate(conversation.updateTime)})`;
                break;
            case 'unchanged':
                badge.textContent = "Unchanged";
                badge.classList.add('status-unchanged');
                badge.title = "This conversation is the same as in your vault";
                break;
            default:
                badge.textContent = "Unknown";
                badge.classList.add('status-unchanged');
                break;
        }

        return badge;
    }

    private renderPaginationControls() {
        const pageInfo = this.contentEl.querySelector('#page-info') as HTMLElement;
        const pageControls = this.contentEl.querySelector('#page-controls') as HTMLElement;
        
        if (!pageInfo || !pageControls) return;

        const { currentPage, totalPages, totalItems, pageSize } = this.state.pagination;
        const startItem = (currentPage - 1) * pageSize + 1;
        const endItem = Math.min(currentPage * pageSize, totalItems);

        // Update page info
        pageInfo.textContent = `Showing ${startItem}-${endItem} of ${totalItems} conversations`;

        // Update page controls
        pageControls.empty();

        // Previous button
        const prevBtn = pageControls.createEl("button", { text: "Previous" });
        prevBtn.disabled = currentPage <= 1;
        prevBtn.style.padding = "6px 12px";
        prevBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                this.state.pagination.currentPage--;
                this.renderConversationList();
            }
        });

        // Page numbers (simplified - just show current page)
        const pageSpan = pageControls.createEl("span");
        pageSpan.textContent = `Page ${currentPage} of ${totalPages}`;
        pageSpan.style.padding = "6px 12px";

        // Next button
        const nextBtn = pageControls.createEl("button", { text: "Next" });
        nextBtn.disabled = currentPage >= totalPages;
        nextBtn.style.padding = "6px 12px";
        nextBtn.addEventListener('click', () => {
            if (currentPage < totalPages) {
                this.state.pagination.currentPage++;
                this.renderConversationList();
            }
        });
    }

    private updateSummary() {
        const summary = this.contentEl.querySelector('#conversation-summary') as HTMLElement;
        if (!summary) return;

        const selectedCount = this.state.selectedIds.size;
        const totalCount = this.state.filteredConversations.length;

        // Calculate status counts from filtered conversations (what's currently shown)
        const statusCounts = {
            new: 0,
            updated: 0,
            unchanged: 0,
            unknown: 0
        };

        this.state.filteredConversations.forEach(conv => {
            const status = conv.existenceStatus || 'unknown';
            statusCounts[status]++;
        });

        // Build the comprehensive summary
        summary.innerHTML = this.buildComprehensiveSummary(selectedCount, totalCount, statusCounts);

        // Update import button state
        const importButton = this.contentEl.querySelector('#import-selected-button') as HTMLButtonElement;
        if (importButton) {
            importButton.disabled = selectedCount === 0;
            importButton.textContent = selectedCount > 0 ? `Import ${selectedCount} Selected` : 'Import Selected';
        }
    }

    private buildComprehensiveSummary(selectedCount: number, totalCount: number, statusCounts: any): string {
        // 4 cartouches compacts
        if (this.analysisInfo) {
            const info = this.analysisInfo;
            const uniqueCount = info.uniqueConversationsKept;

            return `
                <div style="text-align: center; padding: 12px; background-color: var(--background-primary); border-radius: 8px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
                    <div style="font-weight: 600; font-size: 1.4em; color: var(--text-accent);">${uniqueCount}</div>
                    <div style="color: var(--text-muted); font-size: 0.85em; margin-top: 4px;">Unique Conversations</div>
                </div>
                <div style="text-align: center; padding: 12px; background-color: var(--background-primary); border-radius: 8px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
                    <div style="font-weight: 600; font-size: 1.4em; color: var(--color-green);">${info.conversationsNew}</div>
                    <div style="color: var(--text-muted); font-size: 0.85em; margin-top: 4px;">New</div>
                </div>
                <div style="text-align: center; padding: 12px; background-color: var(--background-primary); border-radius: 8px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
                    <div style="font-weight: 600; font-size: 1.4em; color: var(--color-orange);">${info.conversationsUpdated}</div>
                    <div style="color: var(--text-muted); font-size: 0.85em; margin-top: 4px;">Updated</div>
                </div>
                <div style="text-align: center; padding: 12px; background-color: var(--background-primary); border-radius: 8px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
                    <div style="font-weight: 600; font-size: 1.4em; color: var(--text-muted);">${info.conversationsIgnored}</div>
                    <div style="color: var(--text-muted); font-size: 0.85em; margin-top: 4px;">Unchanged</div>
                </div>
            `;
        }

        // Fallback si pas d'analysisInfo
        return `
            <div style="text-align: center; padding: 12px;">
                <strong>${selectedCount}</strong> of <strong>${totalCount}</strong> selected
            </div>
        `;
    }

    private handleImportSelected() {
        const selectedIds = Array.from(this.state.selectedIds);
        if (selectedIds.length === 0) {
            return;
        }

        const result: ConversationSelectionResult = {
            selectedIds,
            totalAvailable: this.state.allConversations.length,
            mode: 'selective'
        };

        this.close();
        this.onSelectionComplete(result);
    }

    private formatDate(timestamp: number): string {
        if (!timestamp) return 'Unknown';
        const date = new Date(timestamp * 1000);
        return date.toLocaleDateString();
    }

    private addCustomStyles() {
        const style = document.createElement('style');
        style.textContent = `
            /* Modal sizing - CRITICAL: Override Obsidian's default constraints */
            .modal.nexus-conversation-selection-dialog {
                max-width: min(1000px, 90vw) !important;
                width: min(1000px, 90vw) !important;
                height: auto !important;
                padding: 0 !important;
            }

            /* Modal title spacing */
            .modal.nexus-conversation-selection-dialog .modal-title {
                padding: 16px 24px !important;
                margin: 0 !important;
            }

            .modal.nexus-conversation-selection-dialog .modal-content {
                max-width: 100% !important;
                width: 100% !important;
                max-height: 85vh;
                overflow-y: visible;
                overflow-x: visible;
                display: flex;
                flex-direction: column;
                padding: 20px 24px 24px 24px;
            }

            /* Table container with independent scroll */
            .nexus-conversation-selection-dialog .nexus-table-container {
                max-height: 450px;
                overflow-y: auto;
                overflow-x: auto;
                border: 1px solid var(--background-modifier-border);
                border-radius: 8px;
                margin-bottom: 20px;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            }

            /* Table styling */
            .nexus-conversation-selection-dialog table {
                font-size: 0.9em;
                width: 100%;
                min-width: 900px;
                border-collapse: collapse;
            }

            /* Table header - sticky */
            .nexus-conversation-selection-dialog thead {
                position: sticky;
                top: 0;
                z-index: 10;
            }

            .nexus-conversation-selection-dialog th {
                background-color: var(--background-secondary);
                font-weight: 600;
                white-space: nowrap;
                position: sticky;
                top: 0;
            }

            /* Sortable headers */
            .nexus-conversation-selection-dialog th.sortable-header {
                cursor: pointer;
                user-select: none;
                transition: background-color 0.2s;
            }

            .nexus-conversation-selection-dialog th.sortable-header:hover {
                background-color: var(--background-modifier-hover);
            }

            .nexus-conversation-selection-dialog .sort-indicator {
                display: inline-block;
                margin-left: 6px;
                font-size: 0.8em;
                transition: opacity 0.2s;
            }

            /* Table cells */
            .nexus-conversation-selection-dialog td {
                padding: 10px 8px;
                border-bottom: 1px solid var(--background-modifier-border);
                vertical-align: middle;
            }

            /* Title column - allow wrapping */
            .nexus-conversation-selection-dialog th:nth-child(2),
            .nexus-conversation-selection-dialog td:nth-child(2) {
                max-width: 500px;
                white-space: normal;
                word-wrap: break-word;
                overflow-wrap: break-word;
            }

            /* Other columns - no wrapping */
            .nexus-conversation-selection-dialog th:not(:nth-child(2)),
            .nexus-conversation-selection-dialog td:not(:nth-child(2)) {
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            /* Row hover effect */
            .nexus-conversation-selection-dialog tbody tr:hover {
                background-color: var(--background-modifier-hover);
                cursor: pointer;
            }

            /* Checkbox column */
            .nexus-conversation-selection-dialog td:first-child {
                text-align: center;
            }

            /* Status badges */
            .nexus-conversation-selection-dialog .status-badge {
                display: inline-block;
                padding: 4px 10px;
                border-radius: 12px;
                font-size: 0.85em;
                font-weight: 500;
                text-align: center;
            }

            .nexus-conversation-selection-dialog .status-new {
                background-color: var(--interactive-accent);
                color: var(--text-on-accent);
            }

            .nexus-conversation-selection-dialog .status-updated {
                background-color: var(--text-warning);
                color: var(--text-on-accent);
            }

            .nexus-conversation-selection-dialog .status-unchanged {
                background-color: var(--background-modifier-border);
                color: var(--text-muted);
            }

            /* Select dropdowns */
            .nexus-conversation-selection-dialog select {
                font-size: 14px;
                line-height: 1.4;
                height: auto;
                min-height: 36px;
                background-color: var(--background-primary);
                color: var(--text-normal);
                font-family: var(--font-interface);
                border: 1px solid var(--background-modifier-border);
                border-radius: 4px;
                padding: 8px 12px;
                cursor: pointer;
            }

            .nexus-conversation-selection-dialog select option {
                padding: 4px 8px;
                line-height: 1.4;
            }

            /* Custom select dropdowns with theme-aware arrows */
            .nexus-conversation-selection-dialog .nexus-custom-select {
                appearance: none;
                -webkit-appearance: none;
                -moz-appearance: none;
                padding-right: 32px;
                background-image: linear-gradient(45deg, transparent 50%, var(--text-muted) 50%),
                                  linear-gradient(135deg, var(--text-muted) 50%, transparent 50%);
                background-position: calc(100% - 14px) calc(50% - 2px),
                                     calc(100% - 10px) calc(50% - 2px);
                background-size: 4px 4px,
                                 4px 4px;
                background-repeat: no-repeat;
            }

            /* Buttons */
            .nexus-conversation-selection-dialog button {
                cursor: pointer;
                transition: all 0.2s ease;
            }

            .nexus-conversation-selection-dialog button:hover {
                transform: translateY(-1px);
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            }

            /* Summary section */
            .nexus-conversation-selection-dialog .summary-section {
                background-color: var(--background-secondary);
                padding: 12px 16px;
                border-radius: 8px;
                margin-bottom: 20px;
            }

            /* Controls section */
            .nexus-conversation-selection-dialog .controls-section {
                background-color: var(--background-primary);
                padding: 12px;
                border-radius: 8px;
                border: 1px solid var(--background-modifier-border);
            }

            /* Scrollbar styling for table container */
            .nexus-conversation-selection-dialog .nexus-table-container::-webkit-scrollbar {
                width: 10px;
                height: 10px;
            }

            .nexus-conversation-selection-dialog .nexus-table-container::-webkit-scrollbar-track {
                background: var(--background-secondary);
                border-radius: 5px;
            }

            .nexus-conversation-selection-dialog .nexus-table-container::-webkit-scrollbar-thumb {
                background: var(--background-modifier-border);
                border-radius: 5px;
            }

            .nexus-conversation-selection-dialog .nexus-table-container::-webkit-scrollbar-thumb:hover {
                background: var(--text-muted);
            }
        `;
        document.head.appendChild(style);
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
