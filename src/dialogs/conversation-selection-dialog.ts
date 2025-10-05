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

        // Get page size from settings or use default
        const pageSize = plugin?.settings?.conversationPageSize || 20;

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
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('nexus-conversation-selection-dialog');

        // Title
        const title = contentEl.createEl("h2", { text: "Select Conversations to Import" });
        title.style.marginBottom = "20px";

        // Summary
        this.createSummarySection(contentEl);

        // Controls (search, filters, sort)
        this.createControlsSection(contentEl);

        // Bulk actions
        this.createBulkActionsSection(contentEl);

        // Conversation list
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
        section.style.marginBottom = "20px";
        section.style.padding = "15px";
        section.style.backgroundColor = "var(--background-secondary)";
        section.style.borderRadius = "8px";

        const summary = section.createDiv();
        summary.id = 'conversation-summary';
        // Content will be updated by updateSummary()
    }

    private createControlsSection(container: HTMLElement) {
        const section = container.createDiv('controls-section');
        section.style.marginBottom = "20px";
        section.style.display = "flex";
        section.style.gap = "15px";
        section.style.alignItems = "center";
        section.style.flexWrap = "wrap";

        // Search input
        const searchContainer = section.createDiv();
        searchContainer.style.flex = "1";
        searchContainer.style.minWidth = "200px";

        const searchInput = searchContainer.createEl("input", { type: "text" });
        searchInput.placeholder = "Search conversations...";
        searchInput.style.width = "100%";
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

        // Sort dropdown
        const sortContainer = section.createDiv();
        const sortSelect = sortContainer.createEl("select");
        sortSelect.style.padding = "8px 12px";
        sortSelect.style.border = "1px solid var(--background-modifier-border)";
        sortSelect.style.borderRadius = "4px";
        sortSelect.style.fontSize = "14px";
        sortSelect.style.lineHeight = "1.4";
        sortSelect.style.minHeight = "36px";
        sortSelect.style.backgroundColor = "var(--background-primary)";
        sortSelect.style.color = "var(--text-normal)";

        const sortOptions = [
            { value: 'updateTime-desc', text: 'Last Updated (Newest)' },
            { value: 'updateTime-asc', text: 'Last Updated (Oldest)' },
            { value: 'createTime-desc', text: 'Created (Newest)' },
            { value: 'createTime-asc', text: 'Created (Oldest)' },
            { value: 'title-asc', text: 'Title (A-Z)' },
            { value: 'title-desc', text: 'Title (Z-A)' },
            { value: 'messageCount-desc', text: 'Message Count (High)' },
            { value: 'messageCount-asc', text: 'Message Count (Low)' }
        ];

        sortOptions.forEach(option => {
            const optionEl = sortSelect.createEl("option");
            optionEl.value = option.value;
            optionEl.textContent = option.text;
        });

        sortSelect.value = `${this.state.sort.field}-${this.state.sort.direction}`;
        sortSelect.addEventListener('change', (e) => {
            const target = e.target as HTMLSelectElement;
            const [field, direction] = target.value.split('-');
            this.state.sort = {
                field: field as SortOptions['field'],
                direction: direction as SortOptions['direction']
            };
            this.applyFiltersAndSort();
            this.renderConversationList();
        });

        // Existence status filter
        const statusContainer = section.createDiv();
        statusContainer.style.marginTop = "10px";

        const statusLabel = statusContainer.createEl("label");
        statusLabel.textContent = "Filter by status: ";
        statusLabel.style.marginRight = "8px";
        statusLabel.style.fontSize = "14px";

        const statusSelect = statusContainer.createEl("select");
        statusSelect.style.padding = "8px 12px";
        statusSelect.style.border = "1px solid var(--background-modifier-border)";
        statusSelect.style.borderRadius = "4px";
        statusSelect.style.fontSize = "14px";
        statusSelect.style.backgroundColor = "var(--background-primary)";
        statusSelect.style.color = "var(--text-normal)";

        const statusOptions = [
            { value: 'all', text: 'All Conversations' },
            { value: 'new', text: 'New (Not in vault)' },
            { value: 'updated', text: 'Updated (Newer than vault)' },
            { value: 'unchanged', text: 'Unchanged (Same as vault)' }
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
    }

    private createBulkActionsSection(container: HTMLElement) {
        const section = container.createDiv('bulk-actions-section');
        section.style.marginBottom = "15px";
        section.style.display = "flex";
        section.style.gap = "10px";
        section.style.alignItems = "center";

        // Select All button
        const selectAllBtn = section.createEl("button", { text: "Select All" });
        selectAllBtn.style.padding = "6px 12px";
        selectAllBtn.addEventListener('click', () => {
            this.state.filteredConversations.forEach(conv => {
                this.state.selectedIds.add(conv.id);
            });
            this.renderConversationList();
            this.updateSummary();
        });

        // Select None button
        const selectNoneBtn = section.createEl("button", { text: "Select None" });
        selectNoneBtn.style.padding = "6px 12px";
        selectNoneBtn.addEventListener('click', () => {
            this.state.selectedIds.clear();
            this.renderConversationList();
            this.updateSummary();
        });

        // Quick filter buttons
        const quickFiltersContainer = section.createDiv();
        quickFiltersContainer.style.marginLeft = "20px";
        quickFiltersContainer.style.display = "flex";
        quickFiltersContainer.style.gap = "8px";

        const quickFilters = [
            { text: "New Only", status: 'new' as const },
            { text: "Updated Only", status: 'updated' as const },
            { text: "All", status: 'all' as const }
        ];

        quickFilters.forEach(filter => {
            const btn = quickFiltersContainer.createEl("button", { text: filter.text });
            btn.style.padding = "4px 8px";
            btn.style.fontSize = "0.9em";
            btn.style.border = "1px solid var(--background-modifier-border)";
            btn.style.borderRadius = "4px";
            btn.style.backgroundColor = "var(--background-primary)";
            btn.addEventListener('click', () => {
                this.state.filter.existenceStatus = filter.status;
                this.applyFiltersAndSort();
                this.renderConversationList();
                this.updateSummary();
                this.updatePagination();

                // Update the status dropdown to match
                const statusSelect = this.contentEl.querySelector('select[value]') as HTMLSelectElement;
                if (statusSelect) {
                    statusSelect.value = filter.status;
                }
            });
        });

        // Page size selector
        const pageSizeContainer = section.createDiv();
        pageSizeContainer.style.marginLeft = "auto";
        pageSizeContainer.style.display = "flex";
        pageSizeContainer.style.alignItems = "center";
        pageSizeContainer.style.gap = "8px";

        const pageSizeLabel = pageSizeContainer.createEl("span");
        pageSizeLabel.textContent = "Show:";
        pageSizeLabel.style.fontSize = "0.9em";

        const pageSizeSelect = pageSizeContainer.createEl("select");
        pageSizeSelect.style.padding = "4px 8px";
        [10, 20, 50, 100].forEach(size => {
            const option = pageSizeSelect.createEl("option");
            option.value = size.toString();
            option.textContent = size.toString();
            if (size === this.state.pagination.pageSize) {
                option.selected = true;
            }
        });

        pageSizeSelect.addEventListener('change', (e) => {
            const target = e.target as HTMLSelectElement;
            this.state.pagination.pageSize = parseInt(target.value);
            this.state.pagination.currentPage = 1;
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
            { text: "", width: "50px" }, // Checkbox - plus large
            { text: "Title", width: "40%" }, // Title - flexible
            { text: "Created", width: "150px" }, // Date - plus large
            { text: "Updated", width: "150px" }, // Date - plus large
            { text: "Messages", width: "100px" }, // Messages - plus large
            { text: "Status", width: "120px" } // Status
        ];

        headers.forEach(header => {
            const th = headerRow.createEl("th");
            th.textContent = header.text;
            th.style.padding = "12px 8px";
            th.style.textAlign = "left";
            th.style.borderBottom = "2px solid var(--background-modifier-border)";
            th.style.fontWeight = "600";
            th.style.backgroundColor = "var(--background-secondary)";
            if (header.width !== "auto") {
                th.style.width = header.width;
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
        // Main selection info
        const selectionInfo = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <div style="font-size: 1.1em;">
                    <strong>${selectedCount}</strong> of <strong>${totalCount}</strong> conversations selected for import
                </div>
            </div>
        `;

        // Analysis breakdown - comprehensive view
        let analysisBreakdown = '';
        if (this.analysisInfo) {
            const info = this.analysisInfo;

            analysisBreakdown = `
                <div style="background-color: var(--background-modifier-border); padding: 12px; border-radius: 6px; margin-bottom: 8px;">
                    <div style="font-weight: 600; margin-bottom: 8px; color: var(--text-accent);">📊 Analysis Results</div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; font-size: 0.9em;">
                        <div style="text-align: center; padding: 8px; background-color: var(--background-primary); border-radius: 4px;">
                            <div style="font-weight: 600; color: var(--color-green);">${info.conversationsNew}</div>
                            <div style="color: var(--text-muted); font-size: 0.8em;">New conversations</div>
                        </div>
                        <div style="text-align: center; padding: 8px; background-color: var(--background-primary); border-radius: 4px;">
                            <div style="font-weight: 600; color: var(--color-orange);">${info.conversationsUpdated}</div>
                            <div style="color: var(--text-muted); font-size: 0.8em;">Updated conversations</div>
                        </div>
                        <div style="text-align: center; padding: 8px; background-color: var(--background-primary); border-radius: 4px;">
                            <div style="font-weight: 600; color: var(--text-muted);">${info.conversationsIgnored}</div>
                            <div style="color: var(--text-muted); font-size: 0.8em;">Ignored (unchanged)</div>
                        </div>
                    </div>
                </div>
            `;
        }

        // Deduplication info (if applicable)
        let deduplicationInfo = '';
        if (this.analysisInfo && this.analysisInfo.duplicatesRemoved > 0) {
            deduplicationInfo = `
                <div style="font-size: 0.85em; color: var(--text-muted); padding: 8px; background-color: var(--background-secondary); border-radius: 4px;">
                    📋 Found <strong>${this.analysisInfo.totalConversationsFound}</strong> conversations across files,
                    removed <strong>${this.analysisInfo.duplicatesRemoved}</strong> duplicates.
                    Showing only latest versions and conversations that need importing.
                </div>
            `;
        }

        return selectionInfo + analysisBreakdown + deduplicationInfo;
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
            /* Modal sizing - wider and responsive */
            .nexus-conversation-selection-dialog .modal {
                max-width: 1400px !important;
                width: 95vw !important;
            }

            .nexus-conversation-selection-dialog .modal-content {
                max-width: 100%;
                width: 100%;
                max-height: 90vh;
                overflow-y: visible;
                display: flex;
                flex-direction: column;
                padding: 20px;
            }

            /* Table container with independent scroll */
            .nexus-conversation-selection-dialog .nexus-table-container {
                max-height: 500px;
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
            }

            .nexus-conversation-selection-dialog select option {
                padding: 4px 8px;
                line-height: 1.4;
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
