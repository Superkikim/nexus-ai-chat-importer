// src/models/import-report.ts
import { AttachmentStats } from "../types/plugin";

interface ReportEntry {
    title: string;
    filePath: string;
    createDate: string;
    updateDate: string;
    messageCount?: number;
    newMessageCount?: number; // For updates
    providerSpecificCount?: number; // For provider-specific column (artifacts, attachments, etc.)
    reason?: string;
    errorMessage?: string;
    attachmentStats?: AttachmentStats;
    sourceFile?: string; // Track which ZIP file this entry came from
}

interface ProcessingCounters {
    totalConversationsProcessed: number;
    totalNewConversationsSuccessfullyImported: number;
    totalConversationsActuallyUpdated: number;
    totalNonEmptyMessagesAdded: number;
}

interface FileSection {
    fileName: string;
    created: ReportEntry[];
    updated: ReportEntry[];
    skipped: ReportEntry[];
    failed: ReportEntry[];
    counters: ProcessingCounters;
}

export class ImportReport {
    private fileSections: Map<string, FileSection> = new Map();
    private currentFileName: string = "";
    private globalErrors: { message: string; details: string }[] = [];
    private providerSpecificColumnHeader: string = "Attachments";
    private operationStartTime: number = Date.now();

    /**
     * Start a new file section for multi-file imports
     */
    startFileSection(fileName: string) {
        this.currentFileName = fileName;
        if (!this.fileSections.has(fileName)) {
            this.fileSections.set(fileName, {
                fileName,
                created: [],
                updated: [],
                skipped: [],
                failed: [],
                counters: {
                    totalConversationsProcessed: 0,
                    totalNewConversationsSuccessfullyImported: 0,
                    totalConversationsActuallyUpdated: 0,
                    totalNonEmptyMessagesAdded: 0
                }
            });
        }
    }

    /**
     * Set counters for the current file section
     */
    setFileCounters(counters: ProcessingCounters) {
        const section = this.getCurrentSection();
        if (section) {
            section.counters = counters;
        }
    }

    private getCurrentSection(): FileSection | undefined {
        return this.fileSections.get(this.currentFileName);
    }

    setProviderSpecificColumnHeader(header: string) {
        this.providerSpecificColumnHeader = header;
    }

    /**
     * Legacy method for backward compatibility (single file imports)
     */
    addSummary(zipFileName: string, counters: ProcessingCounters) {
        // For single file imports, just start a section and set counters
        this.startFileSection(zipFileName);
        this.setFileCounters(counters);
    }

    private getTotalAttachmentStats(): AttachmentStats {
        const total = { total: 0, found: 0, missing: 0, failed: 0 };

        this.fileSections.forEach(section => {
            [...section.created, ...section.updated].forEach(entry => {
                if (entry.attachmentStats) {
                    total.total += entry.attachmentStats.total;
                    total.found += entry.attachmentStats.found;
                    total.missing += entry.attachmentStats.missing;
                    total.failed += entry.attachmentStats.failed;
                }
            });
        });

        return total;
    }

    private getFileSectionAttachmentStats(section: FileSection): AttachmentStats {
        const total = { total: 0, found: 0, missing: 0, failed: 0 };

        [...section.created, ...section.updated].forEach(entry => {
            if (entry.attachmentStats) {
                total.total += entry.attachmentStats.total;
                total.found += entry.attachmentStats.found;
                total.missing += entry.attachmentStats.missing;
                total.failed += entry.attachmentStats.failed;
            }
        });

        return total;
    }

    private getGlobalStats() {
        let created = 0;
        let updated = 0;
        let skipped = 0;
        let failed = 0;
        let totalProcessed = 0;
        let newMessages = 0;

        this.fileSections.forEach(section => {
            created += section.created.length;
            updated += section.updated.length;
            skipped += section.skipped.length;
            failed += section.failed.length;
            totalProcessed += section.counters.totalConversationsProcessed;
            newMessages += section.counters.totalNonEmptyMessagesAdded;
        });

        return { created, updated, skipped, failed, totalProcessed, newMessages };
    }

    addCreated(title: string, filePath: string, createDate: string, updateDate: string, messageCount: number, attachmentStats?: AttachmentStats, providerSpecificCount?: number) {
        const section = this.getCurrentSection();
        if (section) {
            section.created.push({ title, filePath, createDate, updateDate, messageCount, attachmentStats, providerSpecificCount, sourceFile: this.currentFileName });
        }
    }

    addUpdated(title: string, filePath: string, createDate: string, updateDate: string, newMessageCount: number, attachmentStats?: AttachmentStats, providerSpecificCount?: number) {
        const section = this.getCurrentSection();
        if (section) {
            section.updated.push({ title, filePath, createDate, updateDate, newMessageCount, attachmentStats, providerSpecificCount, sourceFile: this.currentFileName });
        }
    }

    addSkipped(title: string, filePath: string, createDate: string, updateDate: string, messageCount: number, reason: string, attachmentStats?: AttachmentStats, providerSpecificCount?: number) {
        const section = this.getCurrentSection();
        if (section) {
            section.skipped.push({ title, filePath, createDate, updateDate, messageCount, reason, attachmentStats, providerSpecificCount, sourceFile: this.currentFileName });
        }
    }

    addFailed(title: string, filePath: string, createDate: string, updateDate: string, errorMessage: string) {
        const section = this.getCurrentSection();
        if (section) {
            section.failed.push({ title, filePath, createDate, updateDate, errorMessage, sourceFile: this.currentFileName });
        }
    }

    addError(message: string, details: string) {
        this.globalErrors.push({ message, details });
    }

    generateReportContent(
        allFiles?: File[],
        processedFiles?: string[],
        skippedFiles?: string[],
        analysisInfo?: any,
        isSelectiveImport?: boolean
    ): string {
        let content = "# Nexus AI Chat Importer Report\n\n";

        // Generate global summary
        content += this.generateGlobalSummary(allFiles, processedFiles, skippedFiles, analysisInfo, isSelectiveImport) + "\n\n";

        // Show skipped files section if any
        if (skippedFiles && skippedFiles.length > 0) {
            content += this.generateSkippedFilesSection(skippedFiles, isSelectiveImport) + "\n\n";
        }

        // Generate section for each file
        const fileNames = Array.from(this.fileSections.keys());

        if (fileNames.length === 0) {
            // No files were processed
            content += "## Result\n\n";
            content += "No conversations were imported. All conversations are already up to date.\n\n";
        } else if (fileNames.length === 1) {
            // Single file import - use simplified format
            const section = this.fileSections.get(fileNames[0])!;
            content += this.generateFileContent(section, false);
        } else {
            // Multi-file import - chaptered by file
            content += "---\n\n";
            content += "## Processed Files\n\n";
            fileNames.forEach((fileName, index) => {
                const section = this.fileSections.get(fileName)!;
                content += `### File ${index + 1}: ${fileName}\n\n`;
                content += this.generateFileSummary(section) + "\n\n";
                content += this.generateFileContent(section, true);
                if (index < fileNames.length - 1) {
                    content += "\n";
                }
            });
        }

        // Global errors at the end
        if (this.globalErrors.length > 0) {
            content += `---\n\n`;
            content += this.generateErrorTable();
        }

        return content;
    }

    private generateSkippedFilesSection(skippedFiles: string[], isSelectiveImport?: boolean): string {
        const title = isSelectiveImport
            ? "⏭️ Skipped Files (No Selected Conversations)"
            : "⏭️ Skipped Files (Already Up to Date)";

        const explanation = isSelectiveImport
            ? "Files not processed because they contain no selected conversations"
            : "Files analyzed but not processed because all conversations are already up to date";

        let section = `> [!note]- ${title}\n`;
        section += `> ${explanation}\n`;
        section += `> \n`;
        section += `> **Total:** ${skippedFiles.length} files\n`;
        section += `> \n`;
        section += `> <details>\n`;
        section += `> <summary>View file list</summary>\n`;
        section += `> \n`;
        skippedFiles.forEach(fileName => {
            section += `> - \`${fileName}\`\n`;
        });
        section += `> \n`;
        section += `> </details>\n`;

        return section;
    }

    private generateGlobalSummary(
        allFiles?: File[],
        processedFiles?: string[],
        skippedFiles?: string[],
        analysisInfo?: any,
        isSelectiveImport?: boolean
    ): string {
        const stats = this.getGlobalStats();
        const totalAttachments = this.getTotalAttachmentStats();
        const fileCount = this.fileSections.size;
        const totalFilesAnalyzed = allFiles ? allFiles.length : fileCount;
        const filesSkipped = skippedFiles ? skippedFiles.length : 0;

        let summary = `## 📊 Import Summary\n\n`;

        // Analysis callout - only show if NOT selective import or if no conversations were selected
        // For selective imports, the analysis stats are misleading (show all conversations, not just selected)
        if (analysisInfo && !isSelectiveImport) {
            summary += `> [!info]- 🔍 Analysis Details\n`;
            summary += `> \n`;
            summary += `> | Metric | Count |\n`;
            summary += `> |:---|---:|\n`;
            summary += `> | Files Analyzed | ${totalFilesAnalyzed} |\n`;
            summary += `> | Total Conversations Found | ${analysisInfo.totalConversationsFound || 0} |\n`;
            summary += `> | Unique Conversations | ${analysisInfo.uniqueConversationsKept || 0} |\n`;
            if (analysisInfo.duplicatesRemoved > 0) {
                summary += `> | Duplicates Removed | ${analysisInfo.duplicatesRemoved} |\n`;
            }
            summary += `> | New | ${analysisInfo.conversationsNew || 0} |\n`;
            summary += `> | Updated | ${analysisInfo.conversationsUpdated || 0} |\n`;
            summary += `> | Unchanged | ${analysisInfo.conversationsIgnored || 0} |\n`;
            summary += `\n`;
        }

        // Import results in a clean grid
        summary += `### 📥 Import Results\n\n`;
        summary += `| Category | Count |\n`;
        summary += `|:---|---:|\n`;
        summary += `| Files Processed | ${fileCount} |\n`;
        if (filesSkipped > 0) {
            summary += `| Files Skipped (up to date) | ${filesSkipped} |\n`;
        }
        summary += `| **Total Imported** | **${stats.created + stats.updated}** |\n`;
        summary += `| ✨ Created | ${stats.created} |\n`;
        summary += `| 🔄 Updated | ${stats.updated} (${stats.newMessages} new messages) |\n`;
        summary += `| ⏭️ Skipped | ${stats.skipped} |\n`;

        if (stats.failed > 0) {
            summary += `| ❌ Failed | ${stats.failed} |\n`;
        }
        if (this.globalErrors.length > 0) {
            summary += `| ⚠️ Errors | ${this.globalErrors.length} |\n`;
        }

        if (totalAttachments.total > 0) {
            const attachmentIcon = totalAttachments.found === totalAttachments.total ? '✅' :
                                   totalAttachments.found === 0 ? '❌' : '⚠️';
            summary += `| ${attachmentIcon} Attachments | ${totalAttachments.found}/${totalAttachments.total} |\n`;
            if (totalAttachments.missing > 0 || totalAttachments.failed > 0) {
                summary += `| └─ Missing | ${totalAttachments.missing} |\n`;
                summary += `| └─ Failed | ${totalAttachments.failed} |\n`;
            }
        }

        return summary;
    }

    private generateFileSummary(section: FileSection): string {
        const attachmentStats = this.getFileSectionAttachmentStats(section);
        const attachmentSummary = attachmentStats.total > 0
            ? `\n- **Attachments**: ${attachmentStats.found}/${attachmentStats.total} extracted`
            : "";

        return `### Statistics
- **Created**: ${section.created.length}
- **Updated**: ${section.updated.length} (${section.counters.totalNonEmptyMessagesAdded} new messages)
- **Skipped**: ${section.skipped.length}
- **Failed**: ${section.failed.length}${attachmentSummary}`;
    }

    private generateFileContent(section: FileSection, isMultiFile: boolean): string {
        let content = "";

        if (section.created.length > 0) {
            content += this.generateCreatedTable(section.created, isMultiFile);
        }

        if (section.updated.length > 0) {
            content += this.generateUpdatedTable(section.updated, isMultiFile);
        }

        if (section.failed.length > 0) {
            content += this.generateFailedTable(section.failed, isMultiFile);
        }

        return content;
    }

    private generateCreatedTable(entries: ReportEntry[], isMultiFile: boolean): string {
        const header = isMultiFile ? "### ✨ Created Notes" : "## ✨ Created Notes";
        let table = `${header}\n\n`;
        table += `| | Title | Created | Messages | ${this.providerSpecificColumnHeader} |\n`;
        table += "|:---:|:---|:---:|:---:|:---:|\n";

        entries.forEach((entry) => {
            const sanitizedTitle = entry.title.replace(/\n/g, " ").trim();
            const titleLink = `[[${entry.filePath}\\|${sanitizedTitle}]]`;
            const providerSpecificValue = entry.providerSpecificCount || 0;

            // Add green checkmark for artifacts/attachments when > 0
            const providerSpecificDisplay = providerSpecificValue > 0 ? `✅ ${providerSpecificValue}` : providerSpecificValue;

            table += `| ✨ | ${titleLink} | ${entry.createDate} | ${entry.messageCount || 0} | ${providerSpecificDisplay} |\n`;
        });

        return table + "\n\n";
    }

    private generateUpdatedTable(entries: ReportEntry[], isMultiFile: boolean): string {
        const header = isMultiFile ? "### 🔄 Updated Notes" : "## 🔄 Updated Notes";
        let table = `${header}\n\n`;
        table += `| | Title | Updated | New Messages | New ${this.providerSpecificColumnHeader} |\n`;
        table += "|:---:|:---|:---:|:---:|:---:|\n";

        entries.forEach((entry) => {
            const sanitizedTitle = entry.title.replace(/\n/g, " ").trim();
            const titleLink = `[[${entry.filePath}\\|${sanitizedTitle}]]`;
            const providerSpecificValue = entry.providerSpecificCount || 0;

            // Add green checkmark for artifacts/attachments when > 0
            const providerSpecificDisplay = providerSpecificValue > 0 ? `✅ ${providerSpecificValue}` : providerSpecificValue;

            table += `| 🔄 | ${titleLink} | ${entry.updateDate} | ${entry.newMessageCount || 0} | ${providerSpecificDisplay} |\n`;
        });

        return table + "\n\n";
    }

    private generateFailedTable(entries: ReportEntry[], isMultiFile: boolean): string {
        const header = isMultiFile ? "### 🚫 Failed Imports" : "## 🚫 Failed Imports";
        let table = `${header}\n\n`;
        table += "| | Title | Date | Error |\n";
        table += "|:---:|:---|:---:|:---|\n";

        entries.forEach((entry) => {
            const sanitizedTitle = entry.title.replace(/\n/g, " ").trim();
            table += `| 🚫 | ${sanitizedTitle} | ${entry.createDate} | ${entry.errorMessage || "Unknown error"} |\n`;
        });

        return table + "\n\n";
    }

    private generateErrorTable(): string {
        let table = `## ⚠️ Global Errors\n\n`;
        table += "| | Error | Details |\n";
        table += "|:---:|:---|:---|\n";
        
        this.globalErrors.forEach((entry) => {
            table += `| ⚠️ | ${entry.message} | ${entry.details} |\n`;
        });
        
        return table + "\n\n";
    }

    private formatAttachmentStatus(stats?: AttachmentStats): string {
        if (!stats || stats.total === 0) {
            return "0";
        }

        const { total, found, missing, failed } = stats;
        
        if (found === total) {
            return `✅ ${found}`;
        } else if (found === 0) {
            return `❌ 0/${total}`;
        } else {
            return `⚠️ ${found}/${total}`;
        }
    }

    hasErrors(): boolean {
        let hasFailed = false;
        this.fileSections.forEach(section => {
            if (section.failed.length > 0) {
                hasFailed = true;
            }
        });
        return hasFailed || this.globalErrors.length > 0;
    }

    getCreatedCount(): number {
        let count = 0;
        this.fileSections.forEach(section => {
            count += section.created.length;
        });
        return count;
    }

    getUpdatedCount(): number {
        let count = 0;
        this.fileSections.forEach(section => {
            count += section.updated.length;
        });
        return count;
    }

    getSkippedCount(): number {
        let count = 0;
        this.fileSections.forEach(section => {
            count += section.skipped.length;
        });
        return count;
    }

    getFailedCount(): number {
        let count = 0;
        this.fileSections.forEach(section => {
            count += section.failed.length;
        });
        return count;
    }

    /**
     * Get statistics for the completion dialog
     */
    getCompletionStats() {
        const globalStats = this.getGlobalStats();
        const attachmentStats = this.getTotalAttachmentStats();

        return {
            totalFiles: this.fileSections.size,
            totalConversations: globalStats.totalProcessed,
            created: globalStats.created,
            updated: globalStats.updated,
            skipped: globalStats.skipped,
            failed: globalStats.failed,
            attachmentsFound: attachmentStats.found,
            attachmentsTotal: attachmentStats.total,
            attachmentsMissing: attachmentStats.missing,
            attachmentsFailed: attachmentStats.failed
        };
    }

    /**
     * Get list of processed file names
     */
    getProcessedFileNames(): string[] {
        return Array.from(this.fileSections.keys());
    }
}