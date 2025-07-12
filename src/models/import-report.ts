// src/models/import-report.ts
import { AttachmentStats } from "../types/plugin";

interface ReportEntry {
    title: string;
    filePath: string;
    createDate: string;
    updateDate: string;
    messageCount?: number;
    reason?: string;
    errorMessage?: string;
    attachmentStats?: AttachmentStats; // New: attachment statistics per conversation
}

interface ProcessingCounters {
    totalConversationsProcessed: number;
    totalNewConversationsSuccessfullyImported: number;
    totalConversationsActuallyUpdated: number;
    totalNonEmptyMessagesAdded: number;
}

export class ImportReport {
    private created: ReportEntry[] = [];
    private updated: ReportEntry[] = [];
    private skipped: ReportEntry[] = [];
    private failed: ReportEntry[] = [];
    private globalErrors: { message: string; details: string }[] = [];
    private summary: string = "";
    private globalAttachmentStats: AttachmentStats = { total: 0, found: 0, missing: 0, failed: 0 };

    addSummary(zipFileName: string, counters: ProcessingCounters, showAttachmentDetails: boolean = true) {
        let summaryText = `
## Summary
- Processed ZIP file: ${zipFileName}
- ${this.created.length > 0 ? `[[#Created notes]]` : "Created notes"}: ${counters.totalNewConversationsSuccessfullyImported} out of ${counters.totalConversationsProcessed} conversations
- ${this.updated.length > 0 ? `[[#Updated notes]]` : "Updated notes"}: ${counters.totalConversationsActuallyUpdated} with a total of ${counters.totalNonEmptyMessagesAdded} new messages
- ${this.skipped.length > 0 ? `[[#Skipped notes]]` : "Skipped notes"}: ${this.skipped.length} out of ${counters.totalConversationsProcessed} conversations
- ${this.failed.length > 0 ? `[[#Failed imports]]` : "Failed imports"}: ${this.failed.length}
- ${this.globalErrors.length > 0 ? `[[#global-errors|Global Errors]]` : "Global errors"}: ${this.globalErrors.length}`;

        // Add attachment summary if enabled and there are attachments
        if (showAttachmentDetails && this.globalAttachmentStats.total > 0) {
            summaryText += `

## Attachment Summary
- **Total attachments:** ${this.globalAttachmentStats.total}
- **✅ Successfully imported:** ${this.globalAttachmentStats.found}
- **⚠️ Missing from export:** ${this.globalAttachmentStats.missing}
- **❌ Failed to extract:** ${this.globalAttachmentStats.failed}
- **Success rate:** ${this.calculateSuccessRate()}%`;
        }

        this.summary = summaryText;
    }

    addCreated(title: string, filePath: string, createDate: string, updateDate: string, messageCount: number, attachmentStats?: AttachmentStats) {
        this.created.push({ title, filePath, createDate, updateDate, messageCount, attachmentStats });
        this.updateGlobalAttachmentStats(attachmentStats);
    }

    addUpdated(title: string, filePath: string, createDate: string, updateDate: string, messageCount: number, attachmentStats?: AttachmentStats) {
        this.updated.push({ title, filePath, createDate, updateDate, messageCount, attachmentStats });
        this.updateGlobalAttachmentStats(attachmentStats);
    }

    addSkipped(title: string, filePath: string, createDate: string, updateDate: string, messageCount: number, reason: string, attachmentStats?: AttachmentStats) {
        this.skipped.push({ title, filePath, createDate, updateDate, messageCount, reason, attachmentStats });
        this.updateGlobalAttachmentStats(attachmentStats);
    }

    addFailed(title: string, filePath: string, createDate: string, updateDate: string, errorMessage: string) {
        this.failed.push({ title, filePath, createDate, updateDate, errorMessage });
    }

    addError(message: string, details: string) {
        this.globalErrors.push({ message, details });
    }

    private updateGlobalAttachmentStats(stats?: AttachmentStats) {
        if (stats) {
            this.globalAttachmentStats.total += stats.total;
            this.globalAttachmentStats.found += stats.found;
            this.globalAttachmentStats.missing += stats.missing;
            this.globalAttachmentStats.failed += stats.failed;
        }
    }

    private calculateSuccessRate(): number {
        if (this.globalAttachmentStats.total === 0) return 100;
        return Math.round((this.globalAttachmentStats.found / this.globalAttachmentStats.total) * 100);
    }

    generateReportContent(showAttachmentDetails: boolean = true): string {
        let content = "# Nexus AI Chat Importer report\n\n";

        if (this.summary) {
            content += this.summary + "\n\n";
        }

        content += "## Legend\n";
        content += "✨ Created | 🔄 Updated | ⏭️ Skipped | 🚫 Failed | ⚠️ Global Errors\n\n";

        if (this.created.length > 0) {
            content += this.generateTable("Created notes", this.created, "✨", ["Title", "Created", "Updated", "Messages"], showAttachmentDetails);
        }
        if (this.updated.length > 0) {
            content += this.generateTable("Updated notes", this.updated, "🔄", ["Title", "Created", "Updated", "Added messages"], showAttachmentDetails);
        }
        if (this.skipped.length > 0) {
            content += this.generateTable("Skipped notes", this.skipped, "⏭️", ["Title", "Created", "Updated", "Messages", "Reason"], showAttachmentDetails);
        }
        if (this.failed.length > 0) {
            content += this.generateTable("Failed imports", this.failed, "🚫", ["Title", "Created", "Updated", "Error"], false);
        }
        if (this.globalErrors.length > 0) {
            content += this.generateErrorTable("Global errors", this.globalErrors, "⚠️");
        }

        return content;
    }

    private generateTable(title: string, entries: ReportEntry[], emoji: string, headers: string[], showAttachmentDetails: boolean): string {
        let table = `## ${title}\n\n`;
        
        // Add attachment column header if showing details and entries have attachment stats
        const hasAttachments = showAttachmentDetails && entries.some(e => e.attachmentStats && e.attachmentStats.total > 0);
        const finalHeaders = hasAttachments ? [...headers, "Attachments"] : headers;
        
        table += "| " + finalHeaders.join(" | ") + " |\n";
        table += "|:---:".repeat(finalHeaders.length) + "|\n";
        
        entries.forEach((entry) => {
            const sanitizedTitle = entry.title.replace(/\n/g, " ").trim();
            const row = headers.map((header) => {
                switch (header) {
                    case "Title":
                        return `[[${entry.filePath}\\|${sanitizedTitle}]]`;
                    case "Created":
                        return entry.createDate || "-";
                    case "Updated":
                        return entry.updateDate || "-";
                    case "Messages":
                    case "Added messages":
                        return entry.messageCount?.toString() || "-";
                    case "Reason":
                        return entry.reason || "-";
                    case "Error":
                        return entry.errorMessage || "-";
                    default:
                        return "-";
                }
            });

            // Add attachment column if showing details
            if (hasAttachments) {
                if (entry.attachmentStats && entry.attachmentStats.total > 0) {
                    const stats = entry.attachmentStats;
                    row.push(`${stats.found}/${stats.total} ✅ ${stats.missing > 0 ? `${stats.missing} ⚠️` : ''} ${stats.failed > 0 ? `${stats.failed} ❌` : ''}`.trim());
                } else {
                    row.push("-");
                }
            }

            table += `| ${emoji} | ${row.join(" | ")} |\n`;
        });
        
        return table + "\n\n";
    }

    private generateErrorTable(title: string, entries: { message: string; details: string }[], emoji: string): string {
        let table = `## ${title}\n\n`;
        table += "| | Error | Details |\n";
        table += "|---|:---|:---|\n";
        entries.forEach((entry) => {
            table += `| ${emoji} | ${entry.message} | ${entry.details} |\n`;
        });
        return table + "\n\n";
    }

    hasErrors(): boolean {
        return this.failed.length > 0 || this.globalErrors.length > 0;
    }

    getCreatedCount(): number {
        return this.created.length;
    }

    getUpdatedCount(): number {
        return this.updated.length;
    }

    getSkippedCount(): number {
        return this.skipped.length;
    }

    getGlobalAttachmentStats(): AttachmentStats {
        return { ...this.globalAttachmentStats };
    }
}