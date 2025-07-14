// src/models/import-report.ts
import { AttachmentStats } from "../types/plugin";

interface ReportEntry {
    title: string;
    filePath: string;
    createDate: string;
    updateDate: string;
    messageCount?: number;
    newMessageCount?: number; // For updates
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

        this.summary = `## Summary
- **ZIP File**: ${zipFileName}
- **Created**: ${counters.totalNewConversationsSuccessfullyImported} new conversations
- **Updated**: ${counters.totalConversationsActuallyUpdated} conversations with ${counters.totalNonEmptyMessagesAdded} new messages
- **Skipped**: ${this.skipped.length} conversations (no changes)
- **Failed**: ${this.failed.length} conversations
- **Errors**: ${this.globalErrors.length} global errors${attachmentSummary}`;
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

    addUpdated(title: string, filePath: string, createDate: string, updateDate: string, newMessageCount: number, attachmentStats?: AttachmentStats) {
        this.updated.push({ title, filePath, createDate, updateDate, newMessageCount, attachmentStats });
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
        let content = "# Nexus AI Chat Importer Report\n\n";

        if (this.summary) {
            content += this.summary + "\n\n";
        }

        // Show tables for important sections only
        if (this.created.length > 0) {
            content += this.generateCreatedTable();
        }
        
        if (this.updated.length > 0) {
            content += this.generateUpdatedTable();
        }
        
        // Only show failures and errors if they exist
        if (this.failed.length > 0) {
            content += this.generateFailedTable();
        }
        
        if (this.globalErrors.length > 0) {
            content += this.generateErrorTable();
        }

        return content;
    }

    private generateCreatedTable(): string {
        let table = `## ✨ Created Notes\n\n`;
        table += "| | Title | Created | Messages | Attachments |\n";
        table += "|:---:|:---|:---:|:---:|:---:|\n";
        
        this.created.forEach((entry) => {
            const sanitizedTitle = entry.title.replace(/\n/g, " ").trim();
            const titleLink = `[[${entry.filePath}\\|${sanitizedTitle}]]`;
            const attachmentStatus = this.formatAttachmentStatus(entry.attachmentStats);
            
            table += `| ✨ | ${titleLink} | ${entry.createDate} | ${entry.messageCount || 0} | ${attachmentStatus} |\n`;
        });
        
        return table + "\n\n";
    }

    private generateUpdatedTable(): string {
        let table = `## 🔄 Updated Notes\n\n`;
        table += "| | Title | Updated | New Messages | New Attachments |\n";
        table += "|:---:|:---|:---:|:---:|:---:|\n";
        
        this.updated.forEach((entry) => {
            const sanitizedTitle = entry.title.replace(/\n/g, " ").trim();
            const titleLink = `[[${entry.filePath}\\|${sanitizedTitle}]]`;
            const attachmentStatus = this.formatAttachmentStatus(entry.attachmentStats);
            
            table += `| 🔄 | ${titleLink} | ${entry.updateDate} | ${entry.newMessageCount || 0} | ${attachmentStatus} |\n`;
        });
        
        return table + "\n\n";
    }

    private generateFailedTable(): string {
        let table = `## 🚫 Failed Imports\n\n`;
        table += "| | Title | Date | Error |\n";
        table += "|:---:|:---|:---:|:---|\n";
        
        this.failed.forEach((entry) => {
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