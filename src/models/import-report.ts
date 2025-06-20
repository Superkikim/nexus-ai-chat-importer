// src/models/import-report.ts
interface ReportEntry {
    title: string;
    filePath: string;
    createDate: string;
    updateDate: string;
    messageCount?: number;
    reason?: string;
    errorMessage?: string;
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
        this.summary = `
## Summary
- Processed ZIP file: ${zipFileName}
- ${this.created.length > 0 ? `[[#Created notes]]` : "Created notes"}: ${counters.totalNewConversationsSuccessfullyImported} out of ${counters.totalConversationsProcessed} conversations
- ${this.updated.length > 0 ? `[[#Updated notes]]` : "Updated notes"}: ${counters.totalConversationsActuallyUpdated} with a total of ${counters.totalNonEmptyMessagesAdded} new messages
- ${this.skipped.length > 0 ? `[[#Skipped notes]]` : "Skipped notes"}: ${this.skipped.length} out of ${counters.totalConversationsProcessed} conversations
- ${this.failed.length > 0 ? `[[#Failed imports]]` : "Failed imports"}: ${this.failed.length}
- ${this.globalErrors.length > 0 ? `[[#global-errors|Global Errors]]` : "Global errors"}: ${this.globalErrors.length}
`;
    }

    addCreated(title: string, filePath: string, createDate: string, updateDate: string, messageCount: number) {
        this.created.push({ title, filePath, createDate, updateDate, messageCount });
    }

    addUpdated(title: string, filePath: string, createDate: string, updateDate: string, messageCount: number) {
        this.updated.push({ title, filePath, createDate, updateDate, messageCount });
    }

    addSkipped(title: string, filePath: string, createDate: string, updateDate: string, messageCount: number, reason: string) {
        this.skipped.push({ title, filePath, createDate, updateDate, messageCount, reason });
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

        content += "## Legend\n";
        content += "✨ Created | 🔄 Updated | ⏭️ Skipped | 🚫 Failed | ⚠️ Global Errors\n\n";

        if (this.created.length > 0) {
            content += this.generateTable("Created notes", this.created, "✨", ["Title", "Created", "Updated", "Messages"]);
        }
        if (this.updated.length > 0) {
            content += this.generateTable("Updated notes", this.updated, "🔄", ["Title", "Created", "Updated", "Added messages"]);
        }
        if (this.skipped.length > 0) {
            content += this.generateTable("Skipped notes", this.skipped, "⏭️", ["Title", "Created", "Updated", "Messages", "Reason"]);
        }
        if (this.failed.length > 0) {
            content += this.generateTable("Failed imports", this.failed, "🚫", ["Title", "Created", "Updated", "Error"]);
        }
        if (this.globalErrors.length > 0) {
            content += this.generateErrorTable("Global errors", this.globalErrors, "⚠️");
        }

        return content;
    }

    private generateTable(title: string, entries: ReportEntry[], emoji: string, headers: string[]): string {
        let table = `## ${title}\n\n`;
        table += "| " + headers.join(" | ") + " |\n";
        table += "|:---:".repeat(headers.length) + "|\n";
        
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
}