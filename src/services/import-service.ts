// src/services/import-service.ts
import { Notice } from "obsidian";
import JSZip from "jszip";
import { Chat, CustomError } from "../types";
import { getFileHash, isCustomError } from "../utils";
import { showDialog } from "../dialogs";
import { ImportReport } from "../models/import-report";
import { ConversationProcessor } from "./conversation-processor";
import { NexusAiChatImporterError } from "../models/errors";
import type NexusAiChatImporterPlugin from "../main";

export class ImportService {
    private importReport: ImportReport = new ImportReport();
    private conversationProcessor: ConversationProcessor;

    constructor(private plugin: NexusAiChatImporterPlugin) {
        this.conversationProcessor = new ConversationProcessor(plugin);
    }

    async selectZipFile() {
        await showDialog(
            this.plugin.app,
            "information",
            "Import Settings",
            ["Importing ChatGPT conversations"],
            "Only ChatGPT exports are supported currently",
            { button1: "Continue" }
        );

        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".zip";
        input.multiple = true;
        input.onchange = async (e) => {
            const files = Array.from((e.target as HTMLInputElement).files || []);
            if (files.length > 0) {
                const sortedFiles = this.sortFilesByTimestamp(files);
                for (const file of sortedFiles) {
                    this.plugin.logger.info(`Processing file: ${file.name}`);
                    await this.handleZipFile(file);
                    this.plugin.logger.info(`Completed processing: ${file.name}`);
                }
            }
        };
        input.click();
    }

    private sortFilesByTimestamp(files: File[]): File[] {
        return files.sort((a, b) => {
            const timestampRegex = /(\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2})/;
            const getTimestamp = (filename: string) => {
                const match = filename.match(timestampRegex);
                if (!match) {
                    this.plugin.logger.warn(`No timestamp found in filename: ${filename}`);
                    return "0";
                }
                return match[1];
            };
            return getTimestamp(a.name).localeCompare(getTimestamp(b.name));
        });
    }

    async handleZipFile(file: File) {
        this.importReport = new ImportReport();
        const storage = this.plugin.getStorageService();

        try {
            const fileHash = await getFileHash(file);

            if (storage.isArchiveImported(fileHash)) {
                const shouldReimport = await showDialog(
                    this.plugin.app,
                    "confirmation",
                    "Already processed",
                    [
                        `File ${file.name} has already been imported.`,
                        `Do you want to reprocess it ?`
                    ],
                    "NOTE: This will not alter existing notes",
                    { button1: "Let's do this", button2: "Forget it" }
                );

                if (!shouldReimport) {
                    new Notice("Import cancelled.");
                    return;
                }
            }

            const zip = await this.validateZipFile(file);
            await this.processConversations(zip, file);
            
            storage.addImportedArchive(fileHash, file.name);
            await this.plugin.saveSettings();
        } catch (error: unknown) {
            const message = isCustomError(error)
                ? error.message
                : error instanceof Error
                ? error.message
                : "An unknown error occurred";
            this.plugin.logger.error("Error handling zip file", { message });
        } finally {
            await this.writeImportReport(file.name);
            new Notice(
                this.importReport.hasErrors()
                    ? "An error occurred during import. Please check the log file for details."
                    : "Import completed. Log file created in the archive folder."
            );
        }
    }

    private async validateZipFile(file: File): Promise<JSZip> {
        try {
            const zip = new JSZip();
            const content = await zip.loadAsync(file);
            const fileNames = Object.keys(content.files);

            if (!fileNames.includes("conversations.json")) {
                throw new NexusAiChatImporterError(
                    "Invalid ZIP structure",
                    "File 'conversations.json' not found in the zip file"
                );
            }

            return zip;
        } catch (error: any) {
            if (error instanceof NexusAiChatImporterError) {
                throw error;
            } else {
                throw new NexusAiChatImporterError(
                    "Error validating zip file",
                    error.message
                );
            }
        }
    }

    private async processConversations(zip: JSZip, file: File): Promise<void> {
        try {
            const chats = await this.extractChatsFromZip(zip);
            const report = await this.conversationProcessor.processChats(chats, this.importReport);
            this.importReport = report;
            this.importReport.addSummary(
                file.name,
                this.conversationProcessor.getCounters()
            );
        } catch (error: unknown) {
            if (isCustomError(error)) {
                this.plugin.logger.error("Error processing conversations", error.message);
            } else if (error instanceof Error) {
                this.plugin.logger.error("General error processing conversations", error.message);
            } else {
                this.plugin.logger.error("Unknown error processing conversations", "An unknown error occurred");
            }
        }
    }

    private async extractChatsFromZip(zip: JSZip): Promise<Chat[]> {
        const conversationsJson = await zip.file("conversations.json")!.async("string");
        return JSON.parse(conversationsJson);
    }

    private async writeImportReport(zipFileName: string): Promise<void> {
        const reportWriter = new ReportWriter(this.plugin);
        await reportWriter.writeReport(this.importReport, zipFileName);
    }
}

class ReportWriter {
    constructor(private plugin: NexusAiChatImporterPlugin) {}

    async writeReport(report: ImportReport, zipFileName: string): Promise<void> {
        const { ensureFolderExists, formatTimestamp } = await import("../utils");
        
        const now = new Date();
        const prefix = formatTimestamp(now.getTime() / 1000, "prefix");
        let logFileName = `${prefix} - import report.md`;
        const logFolderPath = `${this.plugin.settings.archiveFolder}/Reports`;

        const folderResult = await ensureFolderExists(logFolderPath, this.plugin.app.vault);
        if (!folderResult.success) {
            this.plugin.logger.error(`Failed to create or access log folder: ${logFolderPath}`, folderResult.error);
            new Notice("Failed to create log file. Check console for details.");
            return;
        }

        let logFilePath = `${logFolderPath}/${logFileName}`;
        let counter = 1;
        while (await this.plugin.app.vault.adapter.exists(logFilePath)) {
            logFileName = `${prefix}-${counter} - import report.md`;
            logFilePath = `${logFolderPath}/${logFileName}`;
            counter++;
        }

        const currentDate = `${formatTimestamp(now.getTime() / 1000, "date")} ${formatTimestamp(now.getTime() / 1000, "time")}`;
        const logContent = `---
importdate: ${currentDate}
zipFile: ${zipFileName}
totalSuccessfulImports: ${report.getCreatedCount()}
totalUpdatedImports: ${report.getUpdatedCount()}
totalSkippedImports: ${report.getSkippedCount()}
---

${report.generateReportContent()}
`;

        try {
            await this.plugin.app.vault.create(logFilePath, logContent);
        } catch (error: any) {
            this.plugin.logger.error(`Failed to write import log`, error.message);
            new Notice("Failed to create log file. Check console for details.");
        }
    }
}