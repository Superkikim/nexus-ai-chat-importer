// models/import-report.ts
import { Notice, App, PluginManifest } from "obsidian";
import { PluginSettings, ReportEntry } from "../types";
import { formatTimestamp } from "../utils/date-utils";
import { ensureFolderExists, writeToFile } from "../utils/file-utils";
import { Logger } from "../utils/logger";

const logger = new Logger();

export class ImportReport {
    // Properties and methods
    private created: ReportEntry[] = [];
    private updated: ReportEntry[] = [];
    private skipped: ReportEntry[] = [];
    private failed: ReportEntry[] = [];
    private globalErrors: { message: string; details: string }[] = [];
    private summary: string = "";
    app: App;
    manifest: PluginManifest;

    constructor(app: App, manifest: PluginManifest) {
        this.app = app;
        this.manifest = manifest;
    }

    addParameters(
        currentDate: string,
        zipFileName: string,
        manifest: string
    ): string {
        return `---
nexus: ${this.manifest.name}
importdate: ${currentDate}
zipFile: ${zipFileName}
totalSuccessfulImports: ${this.created.length}
totalUpdatedImports: ${this.updated.length}
totalSkippedImports: ${this.skipped.length}
---\n`;
    }

    addSummary(
        zipFileName: string,
        totalProcessed: number,
        totalCreated: number,
        totalUpdated: number,
        totalMessagesAdded: number
    ) {
        this.summary = `
## Summary
- Processed ZIP file: ${zipFileName}
- ${
            totalCreated > 0 ? `[[#Created notes]]` : "Created notes"
        }: ${totalCreated} out of ${totalProcessed} conversations
- ${
            totalUpdated > 0 ? `[[#Updated notes]]` : "Updated notes"
        }: ${totalUpdated} with a total of ${totalMessagesAdded} new messages
- ${this.skipped.length > 0 ? `[[#Skipped notes]]` : "Skipped notes"}: ${
            this.skipped.length
        } out of ${totalProcessed} conversations
- ${this.failed.length > 0 ? `[[#Failed imports]]` : "Failed imports"}: ${
            this.failed.length
        }
- ${
            this.globalErrors.length > 0
                ? `[[#global-errors|Global Errors]]`
                : "Global errors"
        }: ${this.globalErrors.length}
`;
    }

    addCreated(
        title: string,
        filePath: string,
        createDate: string,
        updateDate: string,
        messageCount: number
    ) {
        this.created.push({
            title,
            filePath,
            createDate,
            updateDate,
            messageCount,
        });
    }

    addUpdated(
        title: string,
        filePath: string,
        createDate: string,
        updateDate: string,
        messageCount: number
    ) {
        this.updated.push({
            title,
            filePath,
            createDate,
            updateDate,
            messageCount,
        });
    }

    addSkipped(
        title: string,
        filePath: string,
        createDate: string,
        updateDate: string,
        messageCount: number,
        reason: string
    ) {
        this.skipped.push({
            title,
            filePath,
            createDate,
            updateDate,
            messageCount,
            reason,
        });
    }

    addFailed(
        title: string,
        filePath: string,
        createDate: string,
        updateDate: string,
        errorMessage: string,
        messageCount: number
    ) {
        this.failed.push({
            title,
            filePath,
            createDate,
            updateDate,
            errorMessage,
            messageCount,
        });
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
        content +=
            "✨ Created | 🔄 Updated | ⏭️ Skipped | 🚫 Failed | ⚠️ Global Errors\n\n";

        if (this.created.length > 0) {
            content += this.generateTable("Created notes", this.created, "✨", [
                "Title",
                "Created",
                "Updated",
                "Messages",
            ]);
        }
        if (this.updated.length > 0) {
            content += this.generateTable("Updated notes", this.updated, "🔄", [
                "Title",
                "Created",
                "Updated",
                "Added messages",
            ]);
        }
        if (this.skipped.length > 0) {
            content += this.generateTable("Skipped notes", this.skipped, "⏭️", [
                "Title",
                "Created",
                "Updated",
                "Messages",
            ]);
        }
        if (this.failed.length > 0) {
            content += this.generateTable("Failed imports", this.failed, "🚫", [
                "Title",
                "Created",
                "Updated",
                "Error",
            ]);
        }
        if (this.globalErrors.length > 0) {
            content += this.generateErrorTable(
                "Global errors",
                this.globalErrors,
                "⚠️"
            );
        }

        return content;
    }

    private generateTable(
        title: string,
        entries: ReportEntry[],
        emoji: string,
        headers: string[]
    ): string {
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
                        return entry.messageCount?.toString() || "-";
                    case "Reason":
                        return entry.reason || "-";
                    default:
                        return "-";
                }
            });
            table += `| ${emoji} | ${row.join(" | ")} |\n`;
        });
        return table + "\n\n";
    }

    private generateErrorTable(
        title: string,
        entries: { message: string; details: string }[],
        emoji: string
    ): string {
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

    async writeImportReport(
        zipFileName: string,
        settings: PluginSettings
    ): Promise<void> {
        const now = new Date();
        const prefix = formatTimestamp(now.getTime() / 1000, "prefix");

        let logFileName = `${prefix} - import report.md`;
        const logFolderPath = `${settings.archiveFolder}/Reports`;

        const folderResult = await ensureFolderExists(
            logFolderPath,
            this.app.vault
        );
        if (!folderResult.success) {
            logger.error(
                `Failed to create or access log folder: ${logFolderPath}`,
                folderResult.error
            );
            new Notice("Failed to create log file. Check console for details.");
            return;
        }

        let logFilePath = `${logFolderPath}/${logFileName}`;
        let counter = 1;
        while (await this.app.vault.adapter.exists(logFilePath)) {
            logFileName = `${prefix}-${counter} - import report.md`;
            logFilePath = `${logFolderPath}/${logFileName}`;
            counter++;
        }

        const currentDate = `${formatTimestamp(
            now.getTime() / 1000,
            "date"
        )} ${formatTimestamp(now.getTime() / 1000, "time")}`;

        // Generate the report content
        const reportContent = this.generateReportContent(); // Add this line to generate report content

        const logContent = `---
importdate: ${currentDate}
zipFile: ${zipFileName}
totalSuccessfulImports: ${this.created.length}
totalUpdatedImports: ${this.updated.length}
totalSkippedImports: ${this.skipped.length}
---\n
${reportContent}`;

        try {
            await writeToFile(logFilePath, logContent, this.app);
        } catch (error: any) {
            logger.error(`Failed to write import report`, error.message);
            new Notice(
                "Failed to create report file. Check console for details."
            );
        }
    }
}
