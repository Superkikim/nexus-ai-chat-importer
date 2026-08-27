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
import { App, Modal, sanitizeHTMLToDom } from "obsidian";
import type NexusAiChatImporterPlugin from "../main";
import {
    ConversationMetadata,
    AnalysisInfo,
} from "../services/conversation-metadata-extractor";
import {
    ConversationSelectionResult,
    ConversationSelectionState,
    ConversationStatusFilter,
} from "../types/conversation-selection";
import { t } from "../i18n";

/** Chip order, and the only statuses the filter knows about. */
const STATUS_FILTERS: readonly ConversationStatusFilter[] = [
    "new",
    "updated",
    "unchanged",
];

export class ConversationSelectionDialog extends Modal {
    private state: ConversationSelectionState;
    private onSelectionComplete: (result: ConversationSelectionResult) => void;
    private plugin?: NexusAiChatImporterPlugin;
    private analysisInfo?: AnalysisInfo;

    constructor(
        app: App,
        conversations: ConversationMetadata[],
        onSelectionComplete: (result: ConversationSelectionResult) => void,
        plugin?: NexusAiChatImporterPlugin,
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
                totalItems: conversations.length,
            },
            sort: {
                field: "updateTime",
                direction: "desc",
            },
            filter: {
                // Unchanged is off by default: it is the one status with
                // nothing to import unless the user asks for a rebuild.
                statuses: new Set<ConversationStatusFilter>(["new", "updated"]),
            },
            isLoading: false,
        };

        this.applyFiltersAndSort();

        // Auto-select what the filter shows, not the whole archive: unchanged
        // conversations are in the list now, and selecting one rebuilds its
        // note. "Select All" applies to the visible rows for the same reason.
        if (plugin?.settings?.autoSelectAllOnOpen) {
            this.state.filteredConversations.forEach((conv) => {
                this.state.selectedIds.add(conv.id);
            });
        }
    }

    onOpen() {
        const { contentEl, modalEl, titleEl } = this;
        contentEl.empty();

        // Add class to both modal and content for proper styling
        modalEl.addClass("nexus-conversation-selection-dialog");
        contentEl.addClass("nexus-conversation-selection-dialog");

        // Set title in modal title bar (not in content)
        titleEl.setText(t("conversation_selection.title"));

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

        // Initial render
        this.renderConversationList();
        this.updateSummary();
        this.updatePagination();
    }

    private createSummarySection(container: HTMLElement) {
        const section = container.createDiv(
            "summary-section nexus-summary-grid nexus-dialog-section"
        );
        section.id = "conversation-summary";
        // Content will be updated by updateSummary()
    }

    private createControlsSection(container: HTMLElement) {
        const section = container.createDiv(
            "controls-section nexus-dialog-toolbar nexus-controls-row nexus-dialog-section"
        );

        // Select All button
        const selectAllBtn = section.createEl("button", {
            text: t("conversation_selection.controls.select_all"),
        });
        selectAllBtn.addClass("nexus-control-button");
        selectAllBtn.addEventListener("click", () => {
            this.state.filteredConversations.forEach((conv) => {
                this.state.selectedIds.add(conv.id);
            });
            this.renderConversationList();
            this.updateSummary();
        });

        // Select None button
        const selectNoneBtn = section.createEl("button", {
            text: t("conversation_selection.controls.select_none"),
        });
        selectNoneBtn.addClass("nexus-control-button");
        selectNoneBtn.addEventListener("click", () => {
            this.state.selectedIds.clear();
            this.renderConversationList();
            this.updateSummary();
        });

        // Search input
        const searchInput = section.createEl("input", {
            type: "text",
            cls: "nexus-conversation-search",
        });
        searchInput.placeholder = t(
            "conversation_selection.controls.search_placeholder"
        );
        searchInput.addEventListener("input", (e) => {
            const target = e.target as HTMLInputElement;
            this.state.filter.searchTerm = target.value;
            this.applyFiltersAndSort();
            this.renderConversationList();
            this.updateSummary();
            this.updatePagination();
        });

        this.createStatusChips(section);

        // Page size dropdown
        const pageSizeLabel = section.createEl("label", {
            cls: "nexus-filter-label",
        });
        pageSizeLabel.textContent = t(
            "conversation_selection.controls.show_label"
        );

        const pageSizeSelect = section.createEl("select", {
            cls: "nexus-custom-select nexus-filter-select",
        });

        const pageSizeOptions = [10, 20, 50, 100];
        pageSizeOptions.forEach((size) => {
            const optionEl = pageSizeSelect.createEl("option");
            optionEl.value = size.toString();
            optionEl.textContent = size.toString();
        });

        pageSizeSelect.value = this.state.pagination.pageSize.toString();
        pageSizeSelect.addEventListener("change", (e) => {
            const target = e.target as HTMLSelectElement;
            const newPageSize = parseInt(target.value);
            this.state.pagination.pageSize = newPageSize;
            this.state.pagination.currentPage = 1;

            // Automatically save to settings (memorize user's preference)
            if (this.plugin) {
                this.plugin.settings.lastConversationsPerPage = newPageSize;
                void this.plugin.saveSettings();
            }

            this.updatePagination();
            this.renderConversationList();
        });

        const rebuildHelp = section.createDiv("nexus-controls-help");
        rebuildHelp.textContent = t(
            "conversation_selection.controls.rebuild_help"
        );
    }

    /**
     * Status filter as toggle chips rather than a single-choice dropdown: the
     * three states are not exclusive. A chip reads as on or off and nothing
     * else, so it stays neutral until selected.
     */
    private createStatusChips(section: HTMLElement) {
        const group = section.createDiv("nexus-status-chips");

        const label = group.createSpan({ cls: "nexus-filter-label" });
        label.textContent = t("conversation_selection.controls.status_label");

        const { statuses } = this.state.filter;
        const chips = new Map<"all" | ConversationStatusFilter, HTMLElement>();

        const allActive = () => STATUS_FILTERS.every((s) => statuses.has(s));

        const sync = () => {
            chips.forEach((chip, key) => {
                const active = key === "all" ? allActive() : statuses.has(key);
                chip.toggleClass("is-active", active);
                chip.setAttribute("aria-pressed", String(active));
            });
        };

        const refresh = () => {
            sync();
            this.applyFiltersAndSort();
            this.renderConversationList();
            this.updateSummary();
            this.updatePagination();
        };

        const addChip = (
            key: "all" | ConversationStatusFilter,
            onClick: () => void
        ) => {
            const chip = group.createEl("button", {
                cls: "nexus-status-chip",
                text: t(`conversation_selection.status_filter_options.${key}`),
            });
            chip.type = "button";
            chip.addEventListener("click", () => {
                onClick();
                refresh();
            });
            chips.set(key, chip);
        };

        addChip("all", () => {
            STATUS_FILTERS.forEach((status) => statuses.add(status));
        });

        STATUS_FILTERS.forEach((status) => {
            addChip(status, () => {
                // Every chip can be turned off, the last one included: a
                // filter that refuses to empty the list reads as broken.
                if (statuses.has(status)) {
                    statuses.delete(status);
                } else {
                    statuses.add(status);
                }
            });
        });

        sync();
    }

    private createConversationListSection(container: HTMLElement) {
        const section = container.createDiv(
            "conversation-list-section nexus-dialog-section"
        );

        // Table container with scroll
        const tableContainer = section.createDiv("table-container");
        tableContainer.classList.add("nexus-table-container");

        // Table
        const table = tableContainer.createEl("table");
        table.id = "conversation-table";
        table.addClass("nexus-table-full-width");

        // Table header
        const thead = table.createEl("thead");
        const headerRow = thead.createEl("tr");
        headerRow.addClass("nexus-table-header-row");

        const headers = [
            { text: "", width: "40px", sortField: null }, // Checkbox - plus compact
            {
                text: t("conversation_selection.table_headers.title"),
                width: "45%",
                sortField: "title" as const,
            }, // Plus d'espace
            {
                text: t("conversation_selection.table_headers.created"),
                width: "110px",
                sortField: "createTime" as const,
            }, // Réduit
            {
                text: t("conversation_selection.table_headers.updated"),
                width: "110px",
                sortField: "updateTime" as const,
            }, // Réduit
            {
                text: t("conversation_selection.table_headers.messages"),
                width: "80px",
                sortField: "messageCount" as const,
            }, // Réduit
            {
                text: t("conversation_selection.table_headers.status"),
                width: "100px",
                sortField: null,
            }, // Réduit
        ];

        headers.forEach((header) => {
            const th = headerRow.createEl("th");
            th.addClass("nexus-th-base");
            if (header.width !== "auto") {
                th.style.width = header.width;
            }

            // Make sortable headers clickable
            if (header.sortField) {
                th.addClass("nexus-cursor-pointer");
                th.classList.add("sortable-header");

                // Create header content with sort indicator
                const headerContent = th.createSpan();
                headerContent.textContent = header.text;

                const sortIndicator = th.createSpan();
                sortIndicator.classList.add("sort-indicator");
                sortIndicator.addClass("nexus-sort-indicator");

                // Show current sort state
                if (this.state.sort.field === header.sortField) {
                    sortIndicator.textContent =
                        this.state.sort.direction === "asc" ? "▲" : "▼";
                    sortIndicator.addClass("nexus-sort-indicator-active");
                } else {
                    sortIndicator.textContent = "▼";
                }

                // Click handler for sorting
                th.addEventListener("click", () => {
                    if (this.state.sort.field === header.sortField) {
                        // Toggle direction
                        this.state.sort.direction =
                            this.state.sort.direction === "asc"
                                ? "desc"
                                : "asc";
                    } else {
                        // New field, default to desc
                        this.state.sort.field = header.sortField!;
                        this.state.sort.direction = "desc";
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
        tbody.id = "conversation-table-body";

        const mobileList = section.createDiv("nexus-mobile-conversation-list");
        mobileList.id = "conversation-mobile-list";
    }

    private createPaginationSection(container: HTMLElement) {
        const section = container.createDiv("pagination-section");
        section.addClass("nexus-pagination-section");
        section.id = "pagination-section";

        // Page info
        const pageInfo = section.createDiv({ cls: "nexus-page-info" });
        pageInfo.id = "page-info";

        // Page controls
        const pageControls = section.createDiv({ cls: "nexus-page-controls" });
        pageControls.id = "page-controls";
    }

    private createActionButtons(container: HTMLElement) {
        const buttonContainer = container.createDiv(
            "action-buttons nexus-dialog-actions"
        );

        // Cancel button
        const cancelButton = buttonContainer.createEl("button", {
            text: t("conversation_selection.buttons.cancel"),
        });
        cancelButton.addEventListener("click", () => this.close());

        // Import button
        const importButton = buttonContainer.createEl("button", {
            text: t("conversation_selection.buttons.import_selected"),
        });
        importButton.id = "import-selected-button";
        importButton.classList.add("mod-cta");
        importButton.addEventListener("click", () =>
            this.handleImportSelected()
        );
    }

    private applyFiltersAndSort() {
        let filtered = [...this.state.allConversations];

        // Apply search filter
        if (this.state.filter.searchTerm) {
            const searchTerm = this.state.filter.searchTerm.toLowerCase();
            filtered = filtered.filter((conv) =>
                conv.title.toLowerCase().includes(searchTerm)
            );
        }

        // Apply existence status filter. A conversation with no known status
        // is never hidden: the chips only speak for the three they name.
        const { statuses } = this.state.filter;
        filtered = filtered.filter((conv) => {
            const status = conv.existenceStatus as
                | ConversationStatusFilter
                | undefined;
            if (!status || !STATUS_FILTERS.includes(status)) return true;
            return statuses.has(status);
        });

        // Apply sorting
        filtered.sort((a, b) => {
            const { field, direction } = this.state.sort;
            const dir = direction === "asc" ? 1 : -1;
            if (field === "title") {
                return (
                    dir *
                    a.title.toLowerCase().localeCompare(b.title.toLowerCase())
                );
            }
            return dir * (a[field] - b[field]);
        });

        this.state.filteredConversations = filtered;
        this.updatePagination();
    }

    private updatePagination() {
        const totalItems = this.state.filteredConversations.length;
        const totalPages = Math.ceil(
            totalItems / this.state.pagination.pageSize
        );

        this.state.pagination = {
            ...this.state.pagination,
            totalItems,
            totalPages,
            currentPage: Math.min(
                this.state.pagination.currentPage,
                totalPages || 1
            ),
        };
    }

    private renderConversationList() {
        const tbody = this.contentEl.querySelector(
            "#conversation-table-body"
        ) as HTMLElement;
        const mobileList = this.contentEl.querySelector(
            "#conversation-mobile-list"
        ) as HTMLElement;
        if (!tbody) return;

        tbody.empty();
        mobileList?.empty();

        const { currentPage, pageSize } = this.state.pagination;
        const startIndex = (currentPage - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const pageConversations = this.state.filteredConversations.slice(
            startIndex,
            endIndex
        );

        pageConversations.forEach((conversation) => {
            const row = tbody.createEl("tr");

            // Checkbox cell
            const checkboxCell = row.createEl("td");
            const checkbox = checkboxCell.createEl("input", {
                type: "checkbox",
            });
            checkbox.checked = this.state.selectedIds.has(conversation.id);
            checkbox.addEventListener("change", () => {
                if (checkbox.checked) {
                    this.state.selectedIds.add(conversation.id);
                } else {
                    this.state.selectedIds.delete(conversation.id);
                }
                this.updateSummary();
            });

            // Title cell
            const titleCell = row.createEl("td");
            titleCell.addClass("nexus-td-title");
            titleCell.textContent = conversation.title;

            // Add source file info for multi-file imports
            if (conversation.sourceFile) {
                const sourceInfo = titleCell.createDiv();
                sourceInfo.addClass("nexus-td-source-info");
                sourceInfo.textContent = `📁 ${conversation.sourceFile}`;
            }

            // Created cell
            const createdCell = row.createEl("td");
            createdCell.addClass("nexus-td-date");
            createdCell.textContent = this.formatDate(conversation.createTime);

            // Updated cell
            const updatedCell = row.createEl("td");
            updatedCell.addClass("nexus-td-date");
            updatedCell.textContent = this.formatDate(conversation.updateTime);

            // Messages cell
            const messagesCell = row.createEl("td");
            messagesCell.addClass("nexus-td-center");
            messagesCell.textContent = conversation.messageCount.toString();

            // Status cell with badge
            const statusCell = row.createEl("td");
            statusCell.addClass("nexus-td-center");
            this.createStatusBadge(statusCell, conversation);

            if (mobileList) {
                this.renderMobileConversationCard(mobileList, conversation);
            }
        });

        this.renderPaginationControls();
    }

    private renderMobileConversationCard(
        container: HTMLElement,
        conversation: ConversationMetadata
    ) {
        const card = container.createDiv("nexus-conversation-card");

        const header = card.createDiv("nexus-conversation-card-header");

        const checkbox = header.createEl("input", {
            type: "checkbox",
            cls: "nexus-conversation-card-checkbox",
        });
        checkbox.checked = this.state.selectedIds.has(conversation.id);
        checkbox.addEventListener("change", () => {
            if (checkbox.checked) {
                this.state.selectedIds.add(conversation.id);
            } else {
                this.state.selectedIds.delete(conversation.id);
            }
            this.updateSummary();
        });

        const titleWrap = header.createDiv(
            "nexus-conversation-card-title-wrap"
        );
        const title = titleWrap.createDiv("nexus-conversation-card-title");
        title.textContent = conversation.title;

        if (conversation.sourceFile) {
            const sourceInfo = titleWrap.createDiv(
                "nexus-conversation-card-source"
            );
            sourceInfo.textContent = `📁 ${conversation.sourceFile}`;
        }

        const badge = this.createStatusBadge(header, conversation);
        badge.addClass("nexus-conversation-card-badge");

        const meta = card.createDiv("nexus-conversation-card-meta");
        meta.createDiv({
            text: `${t(
                "conversation_selection.table_headers.created"
            )}: ${this.formatDate(conversation.createTime)}`,
        });
        meta.createDiv({
            text: `${t(
                "conversation_selection.table_headers.updated"
            )}: ${this.formatDate(conversation.updateTime)}`,
        });
        meta.createDiv({
            text: `${t("conversation_selection.table_headers.messages")}: ${
                conversation.messageCount
            }`,
        });
    }

    /**
     * Builds the badge inside `parent`.
     *
     * Obsidian's createSpan appends to the node it is called on, so it needs a
     * real parent element: called on the document it throws "Only one element
     * on document allowed" and takes the whole list down with it.
     */
    private createStatusBadge(
        parent: HTMLElement,
        conversation: ConversationMetadata
    ): HTMLElement {
        const badge = parent.createSpan();
        badge.classList.add("status-badge");

        switch (conversation.existenceStatus) {
            case "new":
                badge.textContent = t(
                    "conversation_selection.status_badges.new"
                );
                badge.classList.add("status-new");
                badge.title = t(
                    "conversation_selection.status_badges.tooltip_new"
                );
                break;
            case "updated":
                badge.textContent = t(
                    "conversation_selection.status_badges.updated"
                );
                badge.classList.add("status-updated");
                badge.title = t(
                    "conversation_selection.status_badges.tooltip_updated",
                    {
                        existing_date: this.formatDate(
                            conversation.existingUpdateTime || 0
                        ),
                        new_date: this.formatDate(conversation.updateTime),
                    }
                );
                break;
            case "unchanged":
                badge.textContent = t(
                    "conversation_selection.status_badges.unchanged"
                );
                badge.classList.add("status-unchanged");
                badge.title = t(
                    "conversation_selection.status_badges.tooltip_unchanged"
                );
                break;
            default:
                badge.textContent = t(
                    "conversation_selection.status_badges.unknown"
                );
                badge.classList.add("status-unchanged");
                break;
        }

        return badge;
    }

    private renderPaginationControls() {
        const pageInfo = this.contentEl.querySelector(
            "#page-info"
        ) as HTMLElement;
        const pageControls = this.contentEl.querySelector(
            "#page-controls"
        ) as HTMLElement;

        if (!pageInfo || !pageControls) return;

        const { currentPage, totalPages, totalItems, pageSize } =
            this.state.pagination;
        const startItem = (currentPage - 1) * pageSize + 1;
        const endItem = Math.min(currentPage * pageSize, totalItems);

        // Update page info
        pageInfo.textContent = t("conversation_selection.pagination.showing", {
            start: String(startItem),
            end: String(endItem),
            total: String(totalItems),
        });

        // Update page controls
        pageControls.empty();

        // Previous button
        const prevBtn = pageControls.createEl("button", {
            text: t("conversation_selection.pagination.previous"),
        });
        prevBtn.disabled = currentPage <= 1;
        prevBtn.addClass("nexus-pagination-btn");
        prevBtn.addEventListener("click", () => {
            if (currentPage > 1) {
                this.state.pagination.currentPage--;
                this.renderConversationList();
            }
        });

        // Page numbers (simplified - just show current page)
        const pageSpan = pageControls.createSpan();
        pageSpan.textContent = t("conversation_selection.pagination.page_of", {
            current: String(currentPage),
            total: String(totalPages),
        });
        pageSpan.addClass("nexus-pagination-btn");

        // Next button
        const nextBtn = pageControls.createEl("button", {
            text: t("conversation_selection.pagination.next"),
        });
        nextBtn.disabled = currentPage >= totalPages;
        nextBtn.addClass("nexus-pagination-btn");
        nextBtn.addEventListener("click", () => {
            if (currentPage < totalPages) {
                this.state.pagination.currentPage++;
                this.renderConversationList();
            }
        });
    }

    private updateSummary() {
        const summary = this.contentEl.querySelector(
            "#conversation-summary"
        ) as HTMLElement;
        if (!summary) return;

        const selectedCount = this.state.selectedIds.size;
        const totalCount = this.state.filteredConversations.length;

        // The cards deliberately describe the whole archive, not the current
        // filter: they are what the user reads to decide how to filter.
        summary.empty();
        summary.append(
            sanitizeHTMLToDom(
                this.buildComprehensiveSummary(selectedCount, totalCount)
            )
        );

        // Update import button state
        const importButton = this.contentEl.querySelector(
            "#import-selected-button"
        ) as HTMLButtonElement;
        if (importButton) {
            importButton.disabled = selectedCount === 0;
            importButton.textContent =
                selectedCount > 0
                    ? t(
                          "conversation_selection.buttons.import_selected_count",
                          { count: String(selectedCount) }
                      )
                    : t("conversation_selection.buttons.import_selected");
        }
    }

    private buildComprehensiveSummary(
        selectedCount: number,
        totalCount: number
    ): string {
        // 4 cartouches compacts
        if (this.analysisInfo) {
            const info = this.analysisInfo;
            const uniqueCount = info.uniqueConversationsKept;

            return `
                <div class="nexus-summary-card">
                    <div class="nexus-summary-value nexus-summary-value-primary">${uniqueCount}</div>
                    <div class="nexus-summary-label">${t(
                        "conversation_selection.summary.unique_conversations"
                    )}</div>
                </div>
                <div class="nexus-summary-card">
                    <div class="nexus-summary-value nexus-summary-value-success">${
                        info.conversationsNew
                    }</div>
                    <div class="nexus-summary-label">${t(
                        "conversation_selection.summary.new"
                    )}</div>
                </div>
                <div class="nexus-summary-card">
                    <div class="nexus-summary-value nexus-summary-value-warning">${
                        info.conversationsUpdated
                    }</div>
                    <div class="nexus-summary-label">${t(
                        "conversation_selection.summary.updated"
                    )}</div>
                </div>
                <div class="nexus-summary-card">
                    <div class="nexus-summary-value nexus-summary-value-muted">${
                        info.conversationsUnchanged
                    }</div>
                    <div class="nexus-summary-label">${t(
                        "conversation_selection.summary.unchanged"
                    )}</div>
                </div>
                <div class="nexus-summary-scope">${t(
                    "conversation_selection.summary.scope_note"
                )}</div>
            `;
        }

        // Fallback si pas d'analysisInfo
        return `
            <div style="text-align: center; padding: 12px;">
                ${t("conversation_selection.summary.selected_of", {
                    selected: String(selectedCount),
                    total: String(totalCount),
                })}
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
            mode: "selective",
        };

        this.close();
        this.onSelectionComplete(result);
    }

    private formatDate(timestamp: number): string {
        if (!timestamp) return t("conversation_selection.date_unknown");
        const date = new Date(timestamp * 1000);
        return date.toLocaleDateString();
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
