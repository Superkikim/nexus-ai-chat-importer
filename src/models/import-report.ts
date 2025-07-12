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
    private globalAttachmentStats: AttachmentStats = { total: 0, found: 0, missing: 0, failed: 0 };
    private zipFileName: string = "";
    private processingCounters: ProcessingCounters | null = null;

    addSummary(zipFileName: string, counters: ProcessingCounters) {
        this.zipFileName = zipFileName;
        this.processingCounters = counters;
        this.generateSummary();
    }

    private generateSummary() {
        if (!this.processingCounters) return;

        const hasAttachments = this.globalAttachmentStats.total > 0;
        const successRate = hasAttachments ? this.calculateSuccessRate() : 100;
        
        this.summary = this.createOverviewSection() + 
                      this.createConversationsSection() + 
                      (hasAttachments ? this.createAttachmentsSection() : "") +
                      this.createNavigationSection();
    }

    private createOverviewSection(): string {
        return `## 📊 Import Overview

**File Processed:** \`${this.zipFileName}\`  
**Date:** ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}  
**Status:** ${this.getOverallStatus()}

`;
    }

    private createConversationsSection(): string {
        const counters = this.processingCounters!;
        
        return `## 💬 Conversations Summary

| Status | Count | Description |
|--------|-------|-------------|
| ✅ **New** | **${counters.totalNewConversationsSuccessfullyImported}** | ${this.created.length > 0 ? `[[#created-conversations\\|View Details]]` : 'Fresh conversations imported'} |
| 🔄 **Updated** | **${counters.totalConversationsActuallyUpdated}** | ${this.updated.length > 0 ? `[[#updated-conversations\\|View Details]]` : 'Existing conversations with new messages'} |
| ⏭️ **Skipped** | **${this.skipped.length}** | ${this.skipped.length > 0 ? `[[#skipped-conversations\\|View Details]]` : 'No changes needed'} |
| ❌ **Failed** | **${this.failed.length}** | ${this.failed.length > 0 ? `[[#failed-imports\\|View Details]]` : 'Import errors'} |

**Messages Added:** ${counters.totalNonEmptyMessagesAdded} new messages across all conversations

`;
    }

    private createAttachmentsSection(): string {
        const stats = this.globalAttachmentStats;
        if (stats.total === 0) return "";

        return `## 📎 Attachments Summary

| Status | Count | Rate |
|--------|-------|------|
| ✅ **Extracted** | **${stats.found}** | ${Math.round((stats.found / stats.total) * 100)}% |
| ⚠️ **Missing** | **${stats.missing}** | ${Math.round((stats.missing / stats.total) * 100)}% |
| ❌ **Failed** | **${stats.failed}** | ${Math.round((stats.failed / stats.total) * 100)}% |
| 📊 **Total** | **${stats.total}** | 100% |

**Overall Success Rate:** ${this.calculateSuccessRate()}%

`;
    }

    private createNavigationSection(): string {
        const sections = [];
        
        if (this.created.length > 0) sections.push(`📝 [[#created-conversations|Created Conversations (${this.created.length})]]`);
        if (this.updated.length > 0) sections.push(`🔄 [[#updated-conversations|Updated Conversations (${this.updated.length})]]`);
        if (this.skipped.length > 0) sections.push(`⏭️ [[#skipped-conversations|Skipped Conversations (${this.skipped.length})]]`);
        if (this.failed.length > 0) sections.push(`❌ [[#failed-imports|Failed Imports (${this.failed.length})]]`);
        if (this.globalErrors.length > 0) sections.push(`⚠️ [[#global-errors|Global Errors (${this.globalErrors.length})]]`);

        if (sections.length === 0) return "";

        return `## 🧭 Quick Navigation

${sections.join('  \n')}

---

`;
    }

    private getOverallStatus(): string {
        if (this.failed.length > 0 || this.globalErrors.length > 0) {
            return "⚠️ **Completed with errors**";
        }
        if (this.created.length === 0 && this.updated.length === 0) {
            return "ℹ️ **No changes needed**";
        }
        return "✅ **Successfully completed**";
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

    generateReportContent(): string {
        let content = "# 🚀 Nexus AI Chat Import Report\n\n";

        if (this.summary) {
            content += this.summary;
        }

        // Detailed sections
        if (this.created.length > 0) {
            content += this.generateDetailedTable("Created Conversations", this.created, "created-conversations", "✨", 
                ["Title", "Created", "Updated", "Messages"]);
        }
        
        if (this.updated.length > 0) {
            content += this.generateDetailedTable("Updated Conversations", this.updated, "updated-conversations", "🔄", 
                ["Title", "Created", "Updated", "Added Messages"]);
        }
        
        if (this.skipped.length > 0) {
            content += this.generateDetailedTable("Skipped Conversations", this.skipped, "skipped-conversations", "⏭️", 
                ["Title", "Created", "Updated", "Messages", "Reason"]);
        }
        
        if (this.failed.length > 0) {
            content += this.generateDetailedTable("Failed Imports", this.failed, "failed-imports", "❌", 
                ["Title", "Created", "Updated", "Error"]);
        }
        
        if (this.globalErrors.length > 0) {
            content += this.generateErrorTable("Global Errors", this.globalErrors, "global-errors", "⚠️");
        }

        // Footer
        content += "\n---\n\n";
        content += `*Report generated by Nexus AI Chat Importer on ${new Date().toLocaleString()}*\n`;
        content += `[[#import-overview|🔝 Back to top]]`;

        return content;
    }

    private generateDetailedTable(title: string, entries: ReportEntry[], anchor: string, emoji: string, headers: string[]): string {
        let table = `## ${emoji} ${title} {#${anchor}}\n\n`;
        
        // Check if we should show attachment details
        const showAttachments = entries.some(e => e.attachmentStats && e.attachmentStats.total > 0);
        const finalHeaders = showAttachments ? [...headers, "Attachments"] : headers;
        
        table += "| " + finalHeaders.join(" | ") + " |\n";
        table += "|" + ":---:|".repeat(finalHeaders.length) + "\n";
        
        entries.forEach((entry) => {
            const sanitizedTitle = entry.title.replace(/\n/g, " ").trim();
            const row = [
                `[[${entry.filePath}\\|${sanitizedTitle}]]`,
                entry.createDate || "-",
                entry.updateDate || "-"
            ];

            // Add message count or reason
            if (headers.includes("Messages") || headers.includes("Added Messages")) {
                row.push(entry.messageCount?.toString() || "-");
            }
            if (headers.includes("Reason")) {
                row.push(entry.reason || "-");
            }
            if (headers.includes("Error")) {
                row.push(entry.errorMessage || "-");
            }

            // Add attachment column if showing details
            if (showAttachments) {
                if (entry.attachmentStats && entry.attachmentStats.total > 0) {
                    const stats = entry.attachmentStats;
                    const parts = [`${stats.found}/${stats.total}`];
                    if (stats.missing > 0) parts.push(`${stats.missing}⚠️`);
                    if (stats.failed > 0) parts.push(`${stats.failed}❌`);
                    row.push(parts.join(" "));
                } else {
                    row.push("-");
                }
            }

            table += `| ${row.join(" | ")} |\n`;
        });
        
        table += `\n[[#quick-navigation|🧭 Navigation]] • [[#import-overview|📊 Overview]]\n\n`;
        return table;
    }

    private generateErrorTable(title: string, entries: { message: string; details: string }[], anchor: string, emoji: string): string {
        let table = `## ${emoji} ${title} {#${anchor}}\n\n`;
        table += "| Error | Details |\n";
        table += "|:---|:---|\n";
        entries.forEach((entry) => {
            table += `| ${entry.message} | ${entry.details} |\n`;
        });
        table += `\n[[#quick-navigation|🧭 Navigation]] • [[#import-overview|📊 Overview]]\n\n`;
        return table;
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