// src/dialogs/conversation-selection-dialog.ts
import { App, Modal, Setting } from "obsidian";
import { ConversationMetadata } from "../services/conversation-metadata-extractor";
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

    constructor(
        app: App,
        conversations: ConversationMetadata[],
        onSelectionComplete: (result: ConversationSelectionResult) => void,
        plugin?: any
    ) {
        super(app);
        this.onSelectionComplete = onSelectionComplete;
        this.plugin = plugin;

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

        // Table container
        const tableContainer = section.createDiv('table-container');
        tableContainer.style.border = "1px solid var(--background-modifier-border)";
        tableContainer.style.borderRadius = "8px";
        tableContainer.style.overflow = "hidden";

        // Table
        const table = tableContainer.createEl("table");
        table.id = 'conversation-table';
        table.style.width = "100%";
        table.style.borderCollapse = "collapse";

        // Table header
        const thead = table.createEl("thead");
        const headerRow = thead.createEl("tr");
        headerRow.style.backgroundColor = "var(--background-secondary)";

        const headers = [
            { text: "", width: "40px" }, // Checkbox
            { text: "Title", width: "auto" },
            { text: "Created", width: "120px" },
            { text: "Updated", width: "120px" },
            { text: "Messages", width: "80px" }
        ];

        headers.forEach(header => {
            const th = headerRow.createEl("th");
            th.textContent = header.text;
            th.style.padding = "12px 8px";
            th.style.textAlign = "left";
            th.style.borderBottom = "1px solid var(--background-modifier-border)";
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
            row.style.borderBottom = "1px solid var(--background-modifier-border)";

            // Checkbox cell
            const checkboxCell = row.createEl("td");
            checkboxCell.style.padding = "8px";
            checkboxCell.style.textAlign = "center";

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

            // Title cell with status indicator
            const titleCell = row.createEl("td");
            titleCell.style.padding = "8px";
            titleCell.style.fontWeight = "500";

            // Add status indicator
            const statusIndicator = this.createStatusIndicator(conversation);
            if (statusIndicator) {
                titleCell.appendChild(statusIndicator);
                titleCell.appendChild(document.createTextNode(" "));
            }

            titleCell.appendChild(document.createTextNode(conversation.title));

            // Add source file info for multi-file imports
            if (conversation.sourceFile) {
                const sourceInfo = titleCell.createEl("div");
                sourceInfo.style.fontSize = "0.8em";
                sourceInfo.style.color = "var(--text-muted)";
                sourceInfo.style.marginTop = "2px";
                sourceInfo.textContent = `From: ${conversation.sourceFile}`;
            }

            // Created cell
            const createdCell = row.createEl("td");
            createdCell.style.padding = "8px";
            createdCell.style.fontSize = "0.9em";
            createdCell.textContent = this.formatDate(conversation.createTime);

            // Updated cell
            const updatedCell = row.createEl("td");
            updatedCell.style.padding = "8px";
            updatedCell.style.fontSize = "0.9em";
            updatedCell.textContent = this.formatDate(conversation.updateTime);

            // Messages cell
            const messagesCell = row.createEl("td");
            messagesCell.style.padding = "8px";
            messagesCell.style.textAlign = "center";
            messagesCell.textContent = conversation.messageCount.toString();
        });

        this.renderPaginationControls();
    }

    private createStatusIndicator(conversation: ConversationMetadata): HTMLElement | null {
        if (!conversation.existenceStatus || conversation.existenceStatus === 'unknown') {
            return null;
        }

        const indicator = document.createElement("span");
        indicator.style.fontSize = "0.8em";
        indicator.style.padding = "2px 6px";
        indicator.style.borderRadius = "3px";
        indicator.style.fontWeight = "bold";
        indicator.style.marginRight = "4px";

        switch (conversation.existenceStatus) {
            case 'new':
                indicator.textContent = "NEW";
                indicator.style.backgroundColor = "var(--color-green)";
                indicator.style.color = "white";
                indicator.title = "This conversation is not in your vault";
                break;
            case 'updated':
                indicator.textContent = "UPDATED";
                indicator.style.backgroundColor = "var(--color-orange)";
                indicator.style.color = "white";
                indicator.title = `This conversation has newer content than your vault (${this.formatDate(conversation.existingUpdateTime || 0)} → ${this.formatDate(conversation.updateTime)})`;
                break;
            case 'unchanged':
                indicator.textContent = "SAME";
                indicator.style.backgroundColor = "var(--background-modifier-border)";
                indicator.style.color = "var(--text-muted)";
                indicator.title = "This conversation is the same as in your vault";
                break;
        }

        return indicator;
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

        // Calculate status counts
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

        // Build status breakdown text
        const statusParts = [];
        if (statusCounts.new > 0) statusParts.push(`${statusCounts.new} new`);
        if (statusCounts.updated > 0) statusParts.push(`${statusCounts.updated} updated`);
        if (statusCounts.unchanged > 0) statusParts.push(`${statusCounts.unchanged} unchanged`);

        const statusText = statusParts.length > 0 ? ` (${statusParts.join(', ')})` : '';

        summary.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <strong>${selectedCount}</strong> of <strong>${totalCount}</strong> conversations selected${statusText}
                </div>
                <div style="font-size: 0.9em; color: var(--text-muted);">
                    ${this.state.allConversations.length} total conversations in archive
                </div>
            </div>
        `;

        // Update import button state
        const importButton = this.contentEl.querySelector('#import-selected-button') as HTMLButtonElement;
        if (importButton) {
            importButton.disabled = selectedCount === 0;
            importButton.textContent = selectedCount > 0 ? `Import ${selectedCount} Selected` : 'Import Selected';
        }
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
            .nexus-conversation-selection-dialog .modal-content {
                max-width: 900px;
                max-height: 80vh;
                overflow-y: auto;
            }
            .nexus-conversation-selection-dialog table {
                font-size: 0.9em;
            }
            .nexus-conversation-selection-dialog tr:hover {
                background-color: var(--background-modifier-hover);
            }
            .nexus-conversation-selection-dialog select {
                font-size: 14px;
                line-height: 1.4;
                height: auto;
                min-height: 36px;
                background-color: var(--background-primary);
                color: var(--text-normal);
                font-family: var(--font-interface);
            }
            .nexus-conversation-selection-dialog select option {
                padding: 4px 8px;
                line-height: 1.4;
            }
        `;
        document.head.appendChild(style);
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
