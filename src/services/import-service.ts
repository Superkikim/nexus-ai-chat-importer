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


// src/services/import-service.ts
import { Notice } from "obsidian";
import JSZip from "jszip";
import { CustomError } from "../types/plugin";
import { getFileHash, ensureFolderExists, formatTimestamp } from "../utils";
import { showDialog } from "../dialogs";
import { ImportReport } from "../models/import-report";
import { ConversationProcessor } from "./conversation-processor";
import { NexusAiChatImporterError } from "../models/errors";
import { createProviderRegistry } from "../providers/provider-registry";
import { ProviderRegistry } from "../providers/provider-adapter";
import { logger } from "../logger";
import { ImportProgressModal, ImportProgressCallback } from "../ui/import-progress-modal";
import { AttachmentMapBuilder, AttachmentMap } from "./attachment-map-builder";
import type NexusAiChatImporterPlugin from "../main";
import { StreamingJsonArrayParser } from "../utils/streaming-json-array-parser";
import { filterConversationsByIds as filterConversationsByIdsUsingAdapters } from "../utils/conversation-filter";

export class ImportService {
    private importReport: ImportReport = new ImportReport();
    private conversationProcessor: ConversationProcessor;
    private providerRegistry: ProviderRegistry;
    private attachmentMapBuilder: AttachmentMapBuilder;
    private currentAttachmentMap: AttachmentMap | null = null;
    private currentZips: JSZip[] = [];

    constructor(private plugin: NexusAiChatImporterPlugin) {
        this.providerRegistry = createProviderRegistry(plugin);
        this.attachmentMapBuilder = new AttachmentMapBuilder(plugin.logger);
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

    async handleZipFile(file: File, forcedProvider?: string, selectedConversationIds?: string[], sharedReport?: ImportReport) {
        // Validate file extension before processing
        const fileName = file.name.toLowerCase();
        if (!fileName.endsWith('.zip')) {
            const errorMessage = `Invalid file format: "${file.name}"\n\n` +
                `Only ZIP files are supported. The file must have a .zip extension.\n\n` +
                `📝 Known Issue: When downloading Claude exports with Firefox on Mac, ` +
                `the file may have a .dat extension instead of .zip. ` +
                `Simply rename the file to change the extension from .dat to .zip, ` +
                `then try importing again.\n\n` +
                `Do NOT extract and re-compress the file - just rename it!`;

            new Notice(errorMessage, 10000); // Show for 10 seconds
            this.plugin.logger.error('Invalid file extension', {
                fileName: file.name,
                expectedExtension: '.zip'
            });
            throw new NexusAiChatImporterError(
                'Invalid file format',
                errorMessage
            );
        }

        // Use shared report if provided, otherwise create a new one
        const isSharedReport = !!sharedReport;
        this.importReport = sharedReport || new ImportReport();

        // Set custom timestamp format if enabled (only if creating new report)
        if (!isSharedReport && this.plugin.settings.useCustomMessageTimestampFormat) {
            this.importReport.setCustomTimestampFormat(this.plugin.settings.messageTimestampFormat);
        }

        // Start a new file section in the report
        this.importReport.startFileSection(file.name);

        // Reset counters for this file (prevents accumulation across multiple files)
        this.conversationProcessor.resetCounters();

        const storage = this.plugin.getStorageService();
        let processingStarted = false;

        // Create and show progress modal
        const progressModal = new ImportProgressModal(this.plugin.app, file.name);
        const progressCallback = progressModal.getProgressCallback();
        progressModal.open();

        // Set selective import mode if applicable
        if (selectedConversationIds && selectedConversationIds.length > 0) {
            // We'll set this after we know the total available count
            // This will be updated in processConversations
        }

        try {
            progressCallback({
                phase: 'validation',
                title: 'Validating ZIP structure...',
                detail: 'Checking file format and contents'
            });

            const zip = await this.validateZipFile(file, forcedProvider);

            // When using shared report (new workflow), skip the "already imported" check
            // because the analysis already determined what needs to be imported
            let isReprocess = false;
            let fileHash = "";

            if (!isSharedReport) {
                // Legacy workflow: check if file was already imported
                progressCallback({
                    phase: 'validation',
                    title: 'Validating file...',
                    detail: 'Checking file hash and import history'
                });

                fileHash = await getFileHash(file);
                const foundByHash = storage.isArchiveImported(fileHash);
                const foundByName = storage.isArchiveImported(file.name);
                isReprocess = foundByHash || foundByName;

                if (isReprocess) {
                    progressModal.close(); // Close progress modal for user dialog

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
                        { button1: "Let's do this", button2: "Skip this file" }
                    );

                    if (!shouldReimport) {
                        new Notice(`Skipping ${file.name} (already imported).`);
                        progressModal.close();
                        return; // Skip this file, but don't cancel the whole operation
                    }

                    // Reopen progress modal for continued processing
                    progressModal.open();
                }
            } else {
                // New workflow: always compute hash for tracking, but don't check/prompt
                fileHash = await getFileHash(file);
            }

            processingStarted = true;
            await this.processConversations(zip, file, isReprocess, forcedProvider, progressCallback, selectedConversationIds, progressModal);

            // Track imported archive
            storage.addImportedArchive(fileHash, file.name);
            await this.plugin.saveSettings();

            progressCallback({
                phase: 'complete',
                title: 'Import completed successfully!',
                detail: `Processed ${this.conversationProcessor.getCounters().totalNewConversationsToImport + this.conversationProcessor.getCounters().totalExistingConversationsToUpdate} conversations`
            });

        } catch (error: unknown) {
            const message = error instanceof NexusAiChatImporterError
                ? error.message
                : error instanceof Error
                ? error.message
                : "An unknown error occurred";

            this.plugin.logger.error("Error handling zip file", { message });

            progressCallback({
                phase: 'error',
                title: 'Import failed',
                detail: message
            });

            // Keep modal open for error state
            setTimeout(() => progressModal.close(), 5000);
        } finally {
            // Only write report if processing actually started AND this is NOT a shared report
            // (shared reports are written by the caller after all files are processed)
            if (processingStarted && !isSharedReport) {
                await this.writeImportReport(file.name);

                // Only show notice if modal was closed due to error or completion
                if (!progressModal.isComplete) {
                    new Notice(
                        this.importReport.hasErrors()
                            ? "An error occurred during import. Please check the log file for details."
                            : "Import completed. Log file created in the archive folder."
                    );
                }
            }
        }
    }

    private async validateZipFile(file: File, forcedProvider?: string): Promise<JSZip> {
        try {
            const zip = new JSZip();
            const content = await zip.loadAsync(file);
            const fileNames = Object.keys(content.files);

            // Check if ZIP is empty
            if (fileNames.length === 0) {
                throw new NexusAiChatImporterError(
                    "Empty ZIP file",
                    "The ZIP file contains no files. Please check that you selected the correct export file."
                );
            }

            // If provider is forced, validate provider-specific format
            if (forcedProvider) {
                if (forcedProvider === 'lechat') {
                    // Le Chat format: individual chat-{uuid}.json files
                    const hasLeChatFiles = fileNames.some(name => name.match(/^chat-[a-f0-9-]+\.json$/));
                    if (!hasLeChatFiles) {
                        throw new NexusAiChatImporterError(
                            "Invalid ZIP structure",
                            `Missing required files: chat-<uuid>.json files for Le Chat provider.`
                        );
                    }
                } else {
                    // ChatGPT/Claude: must have conversations.json
                    if (!fileNames.includes("conversations.json")) {
                        throw new NexusAiChatImporterError(
                            "Invalid ZIP structure",
                            `Missing required file: conversations.json for ${forcedProvider} provider.`
                        );
                    }
                }
            } else {
                // Auto-detection mode (legacy behavior)
                const hasConversationsJson = fileNames.includes("conversations.json");
                const hasUsersJson = fileNames.includes("users.json");
                const hasProjectsJson = fileNames.includes("projects.json");
                const hasLeChatFiles = fileNames.some(name => name.match(/^chat-[a-f0-9-]+\.json$/));

                // ChatGPT format: conversations.json only
                const isChatGPTFormat = hasConversationsJson && !hasUsersJson && !hasProjectsJson;

                // Claude format: conversations.json + users.json (projects.json optional for legacy)
                const isClaudeFormat = hasConversationsJson && hasUsersJson;

                // Le Chat format: individual chat-{uuid}.json files
                const isLeChatFormat = hasLeChatFiles && !hasConversationsJson;

                if (!isChatGPTFormat && !isClaudeFormat && !isLeChatFormat) {
                    throw new NexusAiChatImporterError(
                        "Invalid ZIP structure",
                        "This ZIP file doesn't match any supported chat export format. " +
                        "Expected either ChatGPT format (conversations.json), " +
                        "Claude format (conversations.json + users.json), or " +
                        "Le Chat format (chat-<uuid>.json files)."
                    );
                }
            }

            return zip;
        } catch (error: any) {
            if (error instanceof NexusAiChatImporterError) {
                throw error;
            }

            // Handle JSZip-specific errors
            if (error.message && error.message.includes('corrupted')) {
                throw new NexusAiChatImporterError(
                    "Corrupted ZIP file",
                    "The file appears to be corrupted or is not a valid ZIP file. " +
                    "Please try downloading the export again from your AI provider."
                );
            }

            // Generic ZIP loading error
            throw new NexusAiChatImporterError(
                "Error reading ZIP file",
                `Failed to read the ZIP file: ${error.message || 'Unknown error'}. ` +
                "Please ensure the file is a valid ZIP export from ChatGPT, Claude, or Le Chat."
            );
        }
    }

    private async processConversations(zip: JSZip, file: File, isReprocess: boolean, forcedProvider?: string, progressCallback?: ImportProgressCallback, selectedConversationIds?: string[], progressModal?: ImportProgressModal): Promise<void> {
        try {
            progressCallback?.({
                phase: 'scanning',
                title: 'Extracting conversations...',
                detail: 'Reading conversation data from ZIP file'
            });

            // Extract raw conversation data (provider agnostic)
            let rawConversations = await this.extractRawConversationsFromZip(zip);

            // Filter conversations if specific IDs are selected
            if (selectedConversationIds && selectedConversationIds.length > 0) {
                const originalCount = rawConversations.length;
                rawConversations = this.filterConversationsByIds(rawConversations, selectedConversationIds, forcedProvider);

                // Set selective import mode in progress modal
                if (progressModal) {
                    progressModal.setSelectiveImportMode(rawConversations.length, originalCount);
                }

                progressCallback?.({
                    phase: 'scanning',
                    title: 'Filtering conversations...',
                    detail: `Selected ${rawConversations.length} of ${originalCount} conversations for import`,
                    total: rawConversations.length
                });
            }

            progressCallback?.({
                phase: 'scanning',
                title: 'Scanning existing conversations...',
                detail: 'Checking vault for existing conversations',
                total: rawConversations.length
            });

            // Validate provider if forced
            if (forcedProvider) {
                this.validateProviderMatch(rawConversations, forcedProvider);
            }

            progressCallback?.({
                phase: 'processing',
                title: 'Processing conversations...',
                detail: 'Converting and importing conversations',
                current: 0,
                total: rawConversations.length
            });

            // Process through conversation processor (handles provider detection/conversion)
            const report = await this.conversationProcessor.processRawConversations(
                rawConversations,
                this.importReport,
                zip,
                isReprocess,
                forcedProvider,
                progressCallback
            );

            this.importReport = report;
            this.importReport.setFileCounters(
                this.conversationProcessor.getCounters()
            );

            progressCallback?.({
                phase: 'writing',
                title: 'Finalizing import...',
                detail: 'Saving settings and generating report'
            });
        } catch (error: unknown) {
            if (error instanceof NexusAiChatImporterError) {
                this.plugin.logger.error("Error processing conversations", error.message);
                this.plugin.logger.error("Full NexusAiChatImporterError:", error);
            } else if (typeof error === 'object' && error instanceof Error) {
                this.plugin.logger.error("General error processing conversations", error.message);
                this.plugin.logger.error("Full Error:", error);
                this.plugin.logger.error("Stack trace:", error.stack);
            } else {
                this.plugin.logger.error("Unknown error processing conversations", "An unknown error occurred");
                this.plugin.logger.error("Unknown error:", error);
            }
            // Re-throw the error so it can be caught by the caller
            throw error;
        }
    }

    /**
     * Extract raw conversation data without knowing provider specifics
     */
    private async extractRawConversationsFromZip(zip: JSZip): Promise<any[]> {
        // Check for Le Chat format first (individual chat-{uuid}.json files)
        const fileNames = Object.keys(zip.files);
        const leChatFiles = fileNames.filter(name => name.match(/^chat-[a-f0-9-]+\.json$/));

        if (leChatFiles.length > 0) {
            // Le Chat format: load each individual conversation file
            const conversations: any[] = [];

            for (const fileName of leChatFiles) {
                const file = zip.file(fileName);
                if (file) {
                    const content = await file.async("string");
                    const parsedConversation = JSON.parse(content);
                    conversations.push(parsedConversation);
                }
            }

            return conversations;
        }

        // ChatGPT/Claude format: conversations.json
        const conversationsFile = zip.file("conversations.json");
        if (!conversationsFile) {
            throw new NexusAiChatImporterError(
                "Missing conversations.json",
                "The ZIP file does not contain a conversations.json file or chat-{uuid}.json files"
            );
        }

	        const conversationsJson = await conversationsFile.async("string");

	        try {
	            const conversations: any[] = [];
	            for (const conversation of StreamingJsonArrayParser.streamConversations(conversationsJson)) {
	                conversations.push(conversation);
	            }

	            if (conversations.length === 0) {
	                throw new Error("No conversations found in conversations.json");
	            }

	            return conversations;
	        } catch (error) {
	            this.plugin.logger.error("Failed to parse conversations.json using streaming parser", error);
	            throw new NexusAiChatImporterError(
	                "Invalid conversations.json structure",
	                "The conversations.json file does not contain a valid conversation array"
	            );
	        }
    }

    /**
     * Filter conversations by selected IDs
     */
    private filterConversationsByIds(rawConversations: any[], selectedIds: string[], forcedProvider?: string): any[] {
	        return filterConversationsByIdsUsingAdapters(
	            rawConversations,
	            selectedIds,
	            this.providerRegistry,
	            forcedProvider
	        );
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

        // Check for Le Chat structure (array of messages)
        const isLeChat = Array.isArray(firstConversation) &&
                        firstConversation.length > 0 &&
                        firstConversation[0].chatId !== undefined &&
                        firstConversation[0].contentChunks !== undefined;

        if (forcedProvider === 'chatgpt' && !isChatGPT) {
            throw new NexusAiChatImporterError(
                "Provider Mismatch",
                "You selected ChatGPT but this archive appears to be from another provider. The structure doesn't match ChatGPT exports."
            );
        }

        if (forcedProvider === 'claude' && !isClaude) {
            throw new NexusAiChatImporterError(
                "Provider Mismatch",
                "You selected Claude but this archive appears to be from another provider. The structure doesn't match Claude exports."
            );
        }

        if (forcedProvider === 'lechat' && !isLeChat) {
            throw new NexusAiChatImporterError(
                "Provider Mismatch",
                "You selected Le Chat but this archive appears to be from another provider. The structure doesn't match Le Chat exports."
            );
        }
    }

    private async writeImportReport(zipFileName: string): Promise<void> {
        const reportWriter = new ReportWriter(this.plugin, this.providerRegistry);
        const currentProvider = this.conversationProcessor.getCurrentProvider();
        await reportWriter.writeReport(this.importReport, zipFileName, currentProvider);
    }

    /**
     * Build attachment map for multi-ZIP import
     * Opens all ZIPs and scans for available attachments
     */
    async buildAttachmentMapForMultiZip(files: File[]): Promise<void> {
        try {
            // Build the attachment map
            this.currentAttachmentMap = await this.attachmentMapBuilder.buildAttachmentMap(files);

            // Open all ZIPs for later access
            const JSZipModule = (await import('jszip')).default;
            this.currentZips = [];

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                try {
                    const zip = new JSZipModule();
                    const zipContent = await zip.loadAsync(file);
                    this.currentZips.push(zipContent);
                } catch (error) {
                    this.plugin.logger.error(`Failed to open ZIP for attachment map: ${file.name}`, error);
                }
            }

            // Pass the attachment map to the ChatGPT adapter
            const chatgptAdapter = this.providerRegistry.getAdapter('chatgpt') as any;
            if (chatgptAdapter && this.currentAttachmentMap) {
                chatgptAdapter.setAttachmentMap(this.currentAttachmentMap, this.currentZips);
            }
        } catch (error) {
            this.plugin.logger.error('Error building attachment map:', error);
            throw error;
        }
    }

    /**
     * Clear attachment map and close ZIPs after import completes
     */
    clearAttachmentMap(): void {
        this.currentAttachmentMap = null;
        this.currentZips = [];

        const chatgptAdapter = this.providerRegistry.getAdapter('chatgpt') as any;
        if (chatgptAdapter) {
            chatgptAdapter.clearAttachmentMap();
        }
    }
}

class ReportWriter {
    constructor(private plugin: NexusAiChatImporterPlugin, private providerRegistry: ProviderRegistry) {}

    async writeReport(report: ImportReport, zipFileName: string, provider: string): Promise<void> {
        // Static imports - no dynamic import needed

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

        // Enhanced frontmatter with both dates (ISO 8601 format for consistency)
        const currentDate = new Date().toISOString();
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