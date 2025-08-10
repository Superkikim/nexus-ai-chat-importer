// src/services/import-service.ts
import { Notice } from "obsidian";
import JSZip from "jszip";
import { CustomError } from "../types/plugin";
import { getFileHash } from "../utils";
import { showDialog } from "../dialogs";
import { ImportReport } from "../models/import-report";
import { ConversationProcessor } from "./conversation-processor";
import { NexusAiChatImporterError } from "../models/errors";
import { createProviderRegistry } from "../providers/provider-registry";
import { ProviderRegistry } from "../providers/provider-adapter";
import type NexusAiChatImporterPlugin from "../main";

export class ImportService {
    private importReport: ImportReport = new ImportReport();
    private conversationProcessor: ConversationProcessor;
    private providerRegistry: ProviderRegistry;

    constructor(private plugin: NexusAiChatImporterPlugin) {
        this.providerRegistry = createProviderRegistry(plugin);
        this.conversationProcessor = new ConversationProcessor(plugin, this.providerRegistry);
    }

    async selectZipFile() {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".zip";
        input.multiple = true;
        input.onchange = async (e) => {
            const files = Array.from((e.target as HTMLInputElement).files || []);
            if (files.length > 0) {
                const sortedFiles = this.sortFilesByTimestamp(files);
                for (const file of sortedFiles) {
                    await this.handleZipFile(file);
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

    async handleZipFile(file: File, forcedProvider?: string) {
        this.importReport = new ImportReport();
        const storage = this.plugin.getStorageService();

        try {
            const fileHash = await getFileHash(file);

            // Check if already imported (hybrid detection for 1.0.x → 1.1.0 compatibility)
            const foundByHash = storage.isArchiveImported(fileHash);
            const foundByName = storage.isArchiveImported(file.name);
            const isReprocess = foundByHash || foundByName;

            if (isReprocess) {
                const shouldReimport = await showDialog(
                    this.plugin.app,
                    "confirmation", 
                    "Already processed",
                    [
                        `File ${file.name} has already been imported.`,
                        `Do you want to reprocess it?`,
                        `**Note:** This will recreate notes from before v1.1.0 to add attachment support.`
                    ],
                    undefined,
                    { button1: "Let's do this", button2: "Forget it" }
                );
                
                if (!shouldReimport) {
                    new Notice("Import cancelled.");
                    return;
                }
            }

            const zip = await this.validateZipFile(file, forcedProvider);
            await this.processConversations(zip, file, isReprocess, forcedProvider);
            
            storage.addImportedArchive(fileHash, file.name);
            await this.plugin.saveSettings();
        } catch (error: unknown) {
            const message = error instanceof NexusAiChatImporterError
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

    private async validateZipFile(file: File, forcedProvider?: string): Promise<JSZip> {
        try {
            const zip = new JSZip();
            const content = await zip.loadAsync(file);
            const fileNames = Object.keys(content.files);

            // If provider is forced, skip format validation
            if (forcedProvider) {
                // Basic validation: must have conversations.json
                if (!fileNames.includes("conversations.json")) {
                    throw new NexusAiChatImporterError(
                        "Invalid ZIP structure",
                        `Missing required file: conversations.json for ${forcedProvider} provider.`
                    );
                }
            } else {
                // Auto-detection mode (legacy behavior)
                const hasConversationsJson = fileNames.includes("conversations.json");
                const hasUsersJson = fileNames.includes("users.json");
                const hasProjectsJson = fileNames.includes("projects.json");

                // ChatGPT format: conversations.json only
                const isChatGPTFormat = hasConversationsJson && !hasUsersJson && !hasProjectsJson;

                // Claude format: conversations.json + users.json (projects.json optional for legacy)
                const isClaudeFormat = hasConversationsJson && hasUsersJson;

                if (!isChatGPTFormat && !isClaudeFormat) {
                    throw new NexusAiChatImporterError(
                        "Invalid ZIP structure",
                        "This ZIP file doesn't match any supported chat export format. " +
                        "Expected either ChatGPT format (conversations.json) or " +
                        "Claude format (conversations.json + users.json)."
                    );
                }
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

    private async processConversations(zip: JSZip, file: File, isReprocess: boolean, forcedProvider?: string): Promise<void> {
        try {
            // Extract raw conversation data (provider agnostic)
            const rawConversations = await this.extractRawConversationsFromZip(zip);

            // Validate provider if forced
            if (forcedProvider) {
                this.validateProviderMatch(rawConversations, forcedProvider);
            }

            // Process through conversation processor (handles provider detection/conversion)
            const report = await this.conversationProcessor.processRawConversations(rawConversations, this.importReport, zip, isReprocess, forcedProvider);
            this.importReport = report;
            this.importReport.addSummary(
                file.name,
                this.conversationProcessor.getCounters()
            );
        } catch (error: unknown) {
            if (error instanceof NexusAiChatImporterError) {
                this.plugin.logger.error("Error processing conversations", error.message);
            } else if (typeof error === 'object' && error instanceof Error) {
                this.plugin.logger.error("General error processing conversations", error.message);
            } else {
                this.plugin.logger.error("Unknown error processing conversations", "An unknown error occurred");
            }
        }
    }

    /**
     * Extract raw conversation data without knowing provider specifics
     * TODO: Make this provider-aware when adding Claude support
     */
    private async extractRawConversationsFromZip(zip: JSZip): Promise<any[]> {
        // Currently only supports ChatGPT's conversations.json format
        const conversationsJson = await zip.file("conversations.json")!.async("string");
        return JSON.parse(conversationsJson);
    }

    /**
     * Validate that the forced provider matches the actual content structure
     */
    private validateProviderMatch(rawConversations: any[], forcedProvider: string): void {
        if (rawConversations.length === 0) return;

        const firstConversation = rawConversations[0];

        // Check for ChatGPT structure
        const isChatGPT = firstConversation.mapping !== undefined;

        // Check for Claude structure
        const isClaude = firstConversation.chat_messages !== undefined ||
                        firstConversation.name !== undefined ||
                        firstConversation.summary !== undefined;

        if (forcedProvider === 'chatgpt' && !isChatGPT) {
            throw new NexusAiChatImporterError(
                "Provider Mismatch",
                "You selected ChatGPT but this archive appears to be from Claude. The structure doesn't match ChatGPT exports."
            );
        }

        if (forcedProvider === 'claude' && !isClaude) {
            throw new NexusAiChatImporterError(
                "Provider Mismatch",
                "You selected Claude but this archive appears to be from ChatGPT. The structure doesn't match Claude exports."
            );
        }
    }

    private async writeImportReport(zipFileName: string): Promise<void> {
        const reportWriter = new ReportWriter(this.plugin, this.providerRegistry);
        const currentProvider = this.conversationProcessor.getCurrentProvider();
        await reportWriter.writeReport(this.importReport, zipFileName, currentProvider);
    }
}

class ReportWriter {
    constructor(private plugin: NexusAiChatImporterPlugin, private providerRegistry: ProviderRegistry) {}

    async writeReport(report: ImportReport, zipFileName: string, provider: string): Promise<void> {
        const { ensureFolderExists, formatTimestamp } = await import("../utils");

        // Get provider-specific naming strategy and set column header
        const reportInfo = this.getReportGenerationInfo(zipFileName, provider);
        const adapter = this.providerRegistry.getAdapter(provider);
        if (adapter) {
            const strategy = adapter.getReportNamingStrategy();
            const columnInfo = strategy.getProviderSpecificColumn();
            report.setProviderSpecificColumnHeader(columnInfo.header);
        }

        // Ensure provider subfolder exists
        const folderResult = await ensureFolderExists(reportInfo.folderPath, this.plugin.app.vault);
        if (!folderResult.success) {
            this.plugin.logger.error(`Failed to create or access log folder: ${reportInfo.folderPath}`, folderResult.error);
            new Notice("Failed to create log file. Check console for details.");
            return;
        }

        // Generate unique filename with counter if needed
        let logFilePath = `${reportInfo.folderPath}/${reportInfo.baseFileName}`;
        let counter = 2;
        while (await this.plugin.app.vault.adapter.exists(logFilePath)) {
            const baseName = reportInfo.baseFileName.replace(' - import report.md', '');
            logFilePath = `${reportInfo.folderPath}/${baseName}-${counter} - import report.md`;
            counter++;
        }

        // Enhanced frontmatter with both dates
        const currentDate = `${formatTimestamp(Date.now() / 1000, "date")} ${formatTimestamp(Date.now() / 1000, "time")}`;
        const archiveDate = this.extractArchiveDateFromFilename(zipFileName);
        
        const logContent = `---
importdate: ${currentDate}
archivedate: ${archiveDate}
zipFile: ${zipFileName}
provider: ${provider}
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

    private getReportGenerationInfo(zipFileName: string, provider: string): { folderPath: string, baseFileName: string } {
        const reportFolder = this.plugin.settings.reportFolder;

        // Try to get provider-specific naming strategy
        const adapter = this.providerRegistry.getAdapter(provider);
        if (adapter) {
            const strategy = adapter.getReportNamingStrategy();
            const reportPrefix = strategy.extractReportPrefix(zipFileName);
            return {
                folderPath: `${reportFolder}/${strategy.getProviderName()}`,
                baseFileName: `${reportPrefix} - import report.md`
            };
        }

        // Fallback for unknown providers
        const now = new Date();
        const importDate = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;
        const archiveDate = this.extractArchiveDateFromFilename(zipFileName);
        const fallbackPrefix = `imported-${importDate}-archive-${archiveDate}`;
        return {
            folderPath: `${reportFolder}`,
            baseFileName: `${fallbackPrefix} - import report.md`
        };
    }

    private extractArchiveDateFromFilename(zipFileName: string): string {
        const dateRegex = /(\d{4})-(\d{2})-(\d{2})/;
        const match = zipFileName.match(dateRegex);
        
        if (match) {
            const [, year, month, day] = match;
            return `${year}.${month}.${day}`;
        }
        
        // Fallback: use current date
        const now = new Date();
        return `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;
    }
}