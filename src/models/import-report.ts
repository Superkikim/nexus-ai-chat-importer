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
    attachmentStats?: AttachmentStats;
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

    addSummary(zipFileName: string, counters: ProcessingCounters) {
        // Calculate total attachment stats
        const totalAttachments = this.getTotalAttachmentStats();
        const attachmentSummary = totalAttachments.total > 0 
            ? `\n- **Attachments**: ${totalAttachments.found}/${totalAttachments.total} extracted (${totalAttachments.missing} missing, ${totalAttachments.failed} failed)`
            : "";

        // Clean summary based on your working 1.0.5 version
        this.summary = `## Summary
- Processed ZIP file: ${zipFileName}
- ${this.created.length > 0 ? `[[#Created notes]]` : "Created notes"}: ${counters.totalNewConversationsSuccessfullyImported} out of ${counters.totalConversationsProcessed} conversations
- ${this.updated.length > 0 ? `[[#Updated notes]]` : "Updated notes"}: ${counters.totalConversationsActuallyUpdated} with a total of ${counters.totalNonEmptyMessagesAdded} new messages
- **Skipped**: ${this.skipped.length} conversations (no changes)
- ${this.failed.length > 0 ? `[[#Failed imports]]` : "Failed imports"}: ${this.failed.length}
- ${this.globalErrors.length > 0 ? `[[#Global errors]]` : "Global errors"}: ${this.globalErrors.length}${attachmentSummary}`;
    }

    private getTotalAttachmentStats(): AttachmentStats {
        const total = { total: 0, found: 0, missing: 0, failed: 0 };
        [...this.created, ...this.updated].forEach(entry => {
            if (entry.attachmentStats) {
                total.total += entry.attachmentStats.total;
                total.found += entry.attachmentStats.found;
                total.missing += entry.attachmentStats.missing;
                total.failed += entry.attachmentStats.failed;
            }
        });
        return total;
    }

    addCreated(title: string, filePath: string, createDate: string, updateDate: string, messageCount: number, attachmentStats?: AttachmentStats) {
        this.created.push({ title, filePath, createDate, updateDate, messageCount, attachmentStats });
    }

    addUpdated(title: string, filePath: string, createDate: string, updateDate: string, messageCount: number, attachmentStats?: AttachmentStats) {
        this.updated.push({ title, filePath, createDate, updateDate, messageCount, attachmentStats });
    }

    addSkipped(title: string, filePath: string, createDate: string, updateDate: string, messageCount: number, reason: string, attachmentStats?: AttachmentStats) {
        this.skipped.push({ title, filePath, createDate, updateDate, messageCount, reason, attachmentStats });
    }

    addFailed(title: string, filePath: string, createDate: string, updateDate: string, errorMessage: string) {
        this.failed.push({ title, filePath, createDate, updateDate, errorMessage });
    }

    addError(message: string, details: string) {
        this.globalErrors.push({ message, details });
    }

    generateReportContent(): string {
        let content = "# Nexus AI Chat Importer report\n\n";

        if (this.summary) {
            content += this.summary + "\n\n";
        }

        // Your original legend from 1.0.5
        content += "## Legend\n";
        content += "✨ Created | 🔄 Updated | 🚫 Failed | ⚠️ Global Errors\n\n";

        // Only show tables for things users care about
        if (this.created.length > 0) {
            content += this.generateTable("Created notes", this.created, "✨", 
                ["Title", "Updated", "Messages", "Attachments"]);
        }
        
        if (this.updated.length > 0) {
            content += this.generateTable("Updated notes", this.updated, "🔄", 
                ["Title", "Updated", "Added messages", "Attachments"]);
        }
        
        // Only show failures if they exist
        if (this.failed.length > 0) {
            content += this.generateTable("Failed imports", this.failed, "🚫", 
                ["Title", "Updated", "Error"]);
        }
        
        // Only show global errors if they exist
        if (this.globalErrors.length > 0) {
            content += this.generateErrorTable("Global errors", this.globalErrors, "⚠️");
        }

        return content;
    }

    // Based on your working 1.0.5 table generation but with attachment support
    private generateTable(title: string, entries: ReportEntry[], emoji: string, headers: string[]): string {
        let table = `## ${title}\n\n`;
        
        // Check if we should show attachments column
        const hasAttachments = entries.some(entry => entry.attachmentStats && entry.attachmentStats.total > 0);
        const finalHeaders = hasAttachments && headers.includes("Attachments") ? headers : headers.filter(h => h !== "Attachments");
        
        table += "| " + finalHeaders.join(" | ") + " |\n";
        table += "|:---:".repeat(finalHeaders.length) + "|\n";
        
        entries.forEach((entry) => {
            const sanitizedTitle = entry.title.replace(/\n/g, " ").trim();
            const row = [emoji]; // Start with emoji like your 1.0.5 version
            
            finalHeaders.forEach((header) => {
                switch (header) {
                    case "Title":
                        row.push(`[[${entry.filePath}\\|${sanitizedTitle}]]`);
                        break;
                    case "Updated":
                        row.push(entry.updateDate || "-");
                        break;
                    case "Messages":
                        row.push(entry.messageCount?.toString() || "-");
                        break;
                    case "Added messages":
                        row.push(entry.messageCount?.toString() || "-");
                        break;
                    case "Error":
                        row.push(entry.errorMessage || "-");
                        break;
                    case "Attachments":
                        if (entry.attachmentStats && entry.attachmentStats.total > 0) {
                            const stats = entry.attachmentStats;
                            const status = stats.found === stats.total ? "✅" : 
                                          stats.found === 0 ? "❌" : "⚠️";
                            row.push(`${status} ${stats.found}/${stats.total}`);
                        } else {
                            row.push("0"); // Show "0" instead of "-"
                        }
                        break;
                    default:
                        row.push("-");
                }
            });
            
            table += `| ${row.join(" | ")} |\n`;
        });
        
        return table + "\n\n";
    }

    // Your original error table from 1.0.5
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
}