// src/main.ts
import { Plugin, App, PluginManifest, Notice } from "obsidian";
import { DEFAULT_SETTINGS } from "./config/constants";
import { PluginSettings } from "./types/plugin";
import { NexusAiChatImporterPluginSettingTab } from "./ui/settings-tab";
import { CommandRegistry } from "./commands/command-registry";
import { EventHandlers } from "./events/event-handlers";
import { ImportService } from "./services/import-service";
import { StorageService } from "./services/storage-service";
import { FileService } from "./services/file-service";
import { IncrementalUpgradeManager } from "./upgrade/incremental-upgrade-manager";
import { Logger } from "./logger";
import { ProviderSelectionDialog } from "./dialogs/provider-selection-dialog";
import { EnhancedFileSelectionDialog } from "./dialogs/enhanced-file-selection-dialog";
import { ConversationSelectionDialog } from "./dialogs/conversation-selection-dialog";
import { createProviderRegistry } from "./providers/provider-registry";
import { FileSelectionResult, ConversationSelectionResult } from "./types/conversation-selection";
import { ConversationMetadataExtractor } from "./services/conversation-metadata-extractor";
import { ImportReport } from "./models/import-report";
import { ImportCompletionDialog } from "./dialogs/import-completion-dialog";
import { ensureFolderExists, formatTimestamp } from "./utils";

export default class NexusAiChatImporterPlugin extends Plugin {
    settings!: PluginSettings;
    logger: Logger = new Logger();
    
    private storageService: StorageService;
    private importService: ImportService;
    private fileService: FileService;
    private commandRegistry: CommandRegistry;
    private eventHandlers: EventHandlers;
    private upgradeManager: IncrementalUpgradeManager;

    constructor(app: App, manifest: PluginManifest) {
        super(app, manifest);
        
        this.storageService = new StorageService(this);
        this.importService = new ImportService(this);
        this.fileService = new FileService(this);
        this.commandRegistry = new CommandRegistry(this);
        this.eventHandlers = new EventHandlers(this);
        this.upgradeManager = new IncrementalUpgradeManager(this);
    }

    async onload() {
        try {
            await this.loadSettings();
            
            this.addSettingTab(new NexusAiChatImporterPluginSettingTab(this.app, this));
            this.commandRegistry.registerCommands();
            this.eventHandlers.registerEvents();
            
            const ribbonIconEl = this.addRibbonIcon(
                "message-square-plus",
                "Nexus AI Chat Importer - Import new file",
                () => this.showProviderSelectionDialog()
            );
            ribbonIconEl.addClass("nexus-ai-chat-ribbon");
            
            await this.upgradeManager.checkAndPerformUpgrade();
        } catch (error) {
            this.logger.error("Plugin loading failed:", error);
            throw error;
        }
    }

    async onunload() {
        try {
            this.eventHandlers.cleanup();
            await this.saveSettings();
        } catch (error) {
            this.logger.error("Plugin unloading failed:", error);
        }
    }

    async loadSettings() {
        try {
            const data = await this.loadData();
            this.settings = Object.assign({}, DEFAULT_SETTINGS, data?.settings || {});

            // No need to compute reportFolder anymore - it's a direct setting now
            // Migration will handle converting old archiveFolder to new structure

            // Initialize version tracking
            const currentVersion = this.manifest.version;
            const storedCurrentVersion = this.settings.currentVersion;

            if (!storedCurrentVersion || storedCurrentVersion === "0.0.0") {
                // First time with version tracking
                const hasExistingConversations = await this.hasExistingNexusConversations();

                if (hasExistingConversations) {
                    // Existing user upgrading to version tracking for first time
                    this.settings.previousVersion = "1.0.x";
                    this.settings.currentVersion = currentVersion;
                } else {
                    // Fresh install
                    this.settings.previousVersion = currentVersion;
                    this.settings.currentVersion = currentVersion;
                }

                await this.saveSettings();

            } else if (storedCurrentVersion !== currentVersion) {
                // Normal upgrade
                this.settings.previousVersion = storedCurrentVersion;
                this.settings.currentVersion = currentVersion;
                await this.saveSettings();
            }

            // Load storage data
            await this.storageService.loadData();
            
        } catch (error) {
            this.logger.error("loadSettings failed:", error);
            throw error;
        }
    }

    /**
     * Check if vault contains existing Nexus conversations
     */
    private async hasExistingNexusConversations(): Promise<boolean> {
        try {
            const files = this.app.vault.getMarkdownFiles();
            return files.some(file => {
                const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
                return frontmatter?.nexus === this.manifest.id;
            });
        } catch (error) {
            this.logger.warn("Error checking for existing conversations:", error);
            return false;
        }
    }

    async saveSettings() {
        try {
            // Load existing data to preserve upgrade history and other data
            const existingData = await this.loadData() || {};
            
            // Preserve existingData.importedArchives if it exists and has data
            let finalImportedArchives = this.storageService.getImportedArchives();
            
            if (existingData.importedArchives && Object.keys(existingData.importedArchives).length > 0) {
                // Existing data has archives - preserve them and merge with storage
                const existingArchives = existingData.importedArchives;
                const storageArchives = this.storageService.getImportedArchives();
                
                // Merge: storage takes priority for conflicts
                finalImportedArchives = {
                    ...existingArchives,
                    ...storageArchives
                };
            }
            
            // Merge with new data, preserving upgrade history structure
            const mergedData = {
                ...existingData,
                settings: this.settings,
                importedArchives: finalImportedArchives,
                upgradeHistory: existingData.upgradeHistory || {
                    completedUpgrades: {},
                    completedOperations: {}
                }
            };
            
            await this.storageService.saveData(mergedData);
        } catch (error) {
            this.logger.error("saveSettings failed:", error);
        }
    }

    async resetCatalogs() {
        try {
            await this.storageService.resetCatalogs();
            await this.loadSettings();
        } catch (error) {
            this.logger.error("resetCatalogs failed:", error);
        }
    }

    getStorageService(): StorageService {
        return this.storageService;
    }

    getImportService(): ImportService {
        return this.importService;
    }

    getFileService(): FileService {
        return this.fileService;
    }

    getUpgradeManager(): IncrementalUpgradeManager {
        return this.upgradeManager;
    }

    /**
     * Show provider selection dialog and then file selection
     */
    showProviderSelectionDialog(): void {
        const providerRegistry = createProviderRegistry(this);

        new ProviderSelectionDialog(
            this.app,
            providerRegistry,
            (selectedProvider: string) => {
                this.showEnhancedFileSelectionDialog(selectedProvider);
            }
        ).open();
    }

    /**
     * Show enhanced file selection dialog with import mode choice
     */
    private showEnhancedFileSelectionDialog(provider: string): void {
        new EnhancedFileSelectionDialog(
            this.app,
            provider,
            (result: FileSelectionResult) => {
                this.handleFileSelectionResult(result);
            },
            this
        ).open();
    }

    /**
     * Handle the result from enhanced file selection dialog
     */
    private async handleFileSelectionResult(result: FileSelectionResult): Promise<void> {
        const { files, mode, provider } = result;

        if (files.length === 0) {
            return;
        }

        // Sort files by timestamp
        const sortedFiles = this.sortFilesByTimestamp(files);

        if (mode === 'all') {
            // Import all conversations with analysis (new optimized workflow)
            await this.handleImportAll(sortedFiles, provider);
        } else {
            // Selective import - show conversation selection dialog
            await this.handleSelectiveImport(sortedFiles, provider);
        }
    }

    /**
     * Handle "Import All" mode with analysis and auto-selection
     */
    private async handleImportAll(files: File[], provider: string): Promise<void> {
        try {
            this.logger.debug(`[IMPORT-ALL] Starting import all with ${files.length} files, provider: ${provider}`);
            new Notice(`Analyzing conversations from ${files.length} file(s)...`);

            // Create metadata extractor
            this.logger.debug(`[IMPORT-ALL] Creating provider registry`);
            const providerRegistry = createProviderRegistry(this);
            this.logger.debug(`[IMPORT-ALL] Creating ConversationMetadataExtractor`);
            const metadataExtractor = new ConversationMetadataExtractor(providerRegistry, this);

            // Get existing conversations for status checking
            this.logger.debug(`[IMPORT-ALL] Getting storage service`);
            const storage = this.getStorageService();
            this.logger.debug(`[IMPORT-ALL] Scanning existing conversations`);
            const existingConversations = await storage.scanExistingConversations();
            this.logger.debug(`[IMPORT-ALL] Found ${Object.keys(existingConversations).length} existing conversations`);

            // Extract metadata from all ZIP files (same as selective mode)
            this.logger.debug(`[IMPORT-ALL] Calling extractMetadataFromMultipleZips`);
            const extractionResult = await metadataExtractor.extractMetadataFromMultipleZips(
                files,
                provider,
                existingConversations
            );
            this.logger.debug(`[IMPORT-ALL] Extraction completed, found ${extractionResult.conversations.length} conversations`);

            // Create shared report for the entire operation
            this.logger.debug(`[IMPORT-ALL] Creating ImportReport`);
            const operationReport = new ImportReport();

            if (extractionResult.conversations.length === 0) {
                // No conversations to import, but still generate report and show dialog
                this.logger.debug(`[IMPORT-ALL] No conversations to import, generating report`);
                new Notice("No new or updated conversations found. All conversations are already up to date.");

                // Write report showing what was analyzed
                this.logger.debug(`[IMPORT-ALL] Calling writeConsolidatedReport for empty result`);
                const reportPath = await this.writeConsolidatedReport(operationReport, provider, files, extractionResult.analysisInfo);
                this.logger.debug(`[IMPORT-ALL] Report written to: ${reportPath}`);

                // Show completion dialog with 0 imports
                if (reportPath) {
                    this.showImportCompletionDialog(operationReport, reportPath);
                }
                return;
            }

            // Auto-select ALL conversations (NEW + UPDATED)
            const allIds = extractionResult.conversations.map(c => c.id);

            new Notice(`Importing ${allIds.length} conversations (${extractionResult.analysisInfo.conversationsNew} new, ${extractionResult.analysisInfo.conversationsUpdated} updated)...`);

            // Group conversations by file and import
            const conversationsByFile = new Map<string, string[]>();
            extractionResult.conversations.forEach(conv => {
                if (conv.sourceFile) {
                    if (!conversationsByFile.has(conv.sourceFile)) {
                        conversationsByFile.set(conv.sourceFile, []);
                    }
                    conversationsByFile.get(conv.sourceFile)!.push(conv.id);
                }
            });

            // Process files sequentially with shared report
            for (const file of files) {
                const conversationsForFile = conversationsByFile.get(file.name);
                if (conversationsForFile && conversationsForFile.length > 0) {
                    try {
                        await this.importService.handleZipFile(file, provider, conversationsForFile, operationReport);
                    } catch (error) {
                        this.logger.error(`Error processing file ${file.name}:`, error);
                        // Continue with other files even if one fails
                    }
                }
            }

            // Write the consolidated report (always, even if some files failed)
            const reportPath = await this.writeConsolidatedReport(operationReport, provider, files, extractionResult.analysisInfo);

            // Show completion dialog
            if (reportPath) {
                this.showImportCompletionDialog(operationReport, reportPath);
            } else {
                // Fallback if report writing failed
                new Notice(`Import completed. ${operationReport.getCreatedCount()} created, ${operationReport.getUpdatedCount()} updated.`);
            }

        } catch (error) {
            this.logger.error("[IMPORT-ALL] Error in import all:", error);
            console.error("[IMPORT-ALL] Full error details:", error);
            if (error instanceof Error) {
                console.error("[IMPORT-ALL] Error stack:", error.stack);
            }
            new Notice(`Error during import: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Handle selective import workflow
     */
    private async handleSelectiveImport(files: File[], provider: string): Promise<void> {
        try {
            this.logger.debug(`[SELECTIVE-IMPORT] Starting selective import with ${files.length} files, provider: ${provider}`);
            new Notice(`Analyzing conversations from ${files.length} file(s)...`);

            // Create metadata extractor
            this.logger.debug(`[SELECTIVE-IMPORT] Creating provider registry`);
            const providerRegistry = createProviderRegistry(this);
            this.logger.debug(`[SELECTIVE-IMPORT] Creating ConversationMetadataExtractor`);
            const metadataExtractor = new ConversationMetadataExtractor(providerRegistry, this);

            // Get existing conversations for status checking
            const storage = this.getStorageService();
            const existingConversations = await storage.scanExistingConversations();

            // Extract metadata from all ZIP files
            const extractionResult = await metadataExtractor.extractMetadataFromMultipleZips(
                files,
                provider,
                existingConversations
            );

            if (extractionResult.conversations.length === 0) {
                new Notice("No conversations found in the selected files.");
                return;
            }

            // Show conversation selection dialog with enhanced metadata
            new ConversationSelectionDialog(
                this.app,
                extractionResult.conversations,
                (result: ConversationSelectionResult) => {
                    this.handleConversationSelectionResult(result, files, provider, extractionResult.analysisInfo);
                },
                this,
                extractionResult.analysisInfo
            ).open();

        } catch (error) {
            this.logger.error("[SELECTIVE-IMPORT] Error in selective import:", error);
            console.error("[SELECTIVE-IMPORT] Full error details:", error);
            if (error instanceof Error) {
                console.error("[SELECTIVE-IMPORT] Error stack:", error.stack);
            }
            new Notice(`Error analyzing conversations: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Handle the result from conversation selection dialog
     */
    private async handleConversationSelectionResult(
        result: ConversationSelectionResult,
        files: File[],
        provider: string,
        analysisInfo?: any
    ): Promise<void> {
        // Create shared report for the entire operation
        const operationReport = new ImportReport();

        if (result.selectedIds.length === 0) {
            new Notice("No conversations selected for import.");

            // Still write report and show dialog
            const reportPath = await this.writeConsolidatedReport(operationReport, provider, files, analysisInfo);
            if (reportPath) {
                this.showImportCompletionDialog(operationReport, reportPath);
            }
            return;
        }

        new Notice(`Importing ${result.selectedIds.length} selected conversations from ${files.length} file(s)...`);

        // Group selected conversations by source file for efficient processing
        const conversationsByFile = await this.groupConversationsByFile(result, files);

        // Process files sequentially in original order with shared report
        for (const file of files) {
            const conversationsForFile = conversationsByFile.get(file.name);
            if (conversationsForFile && conversationsForFile.length > 0) {
                try {
                    await this.importService.handleZipFile(file, provider, conversationsForFile, operationReport);
                } catch (error) {
                    this.logger.error(`Error processing file ${file.name}:`, error);
                    // Continue with other files even if one fails
                }
            }
        }

        // Write the consolidated report (always, even if some files failed)
        const reportPath = await this.writeConsolidatedReport(operationReport, provider, files, analysisInfo);

        // Show completion dialog
        if (reportPath) {
            this.showImportCompletionDialog(operationReport, reportPath);
        } else {
            // Fallback if report writing failed
            new Notice(`Import completed. ${operationReport.getCreatedCount()} created, ${operationReport.getUpdatedCount()} updated.`);
        }
    }

    /**
     * Write consolidated report for multi-file import
     */
    private async writeConsolidatedReport(
        report: ImportReport,
        provider: string,
        files: File[],
        analysisInfo?: any
    ): Promise<string> {
        this.logger.debug("[WRITE-REPORT] Starting writeConsolidatedReport");
        this.logger.debug(`[WRITE-REPORT] Provider: ${provider}, Files: ${files.length}`);

        // Static imports - no dynamic import needed
        this.logger.debug("[WRITE-REPORT] Using static imports for ensureFolderExists and formatTimestamp");

        // Get provider-specific folder
        this.logger.debug("[WRITE-REPORT] Getting report folder from settings");
        const reportFolder = this.settings.reportFolder;
        this.logger.debug(`[WRITE-REPORT] Report folder: ${reportFolder}`);

        this.logger.debug("[WRITE-REPORT] Creating provider registry");
        const providerRegistry = createProviderRegistry(this);
        this.logger.debug("[WRITE-REPORT] Getting adapter for provider");
        const adapter = providerRegistry.getAdapter(provider);
        this.logger.debug(`[WRITE-REPORT] Adapter found: ${adapter ? 'yes' : 'no'}`);

        let providerName = provider;
        if (adapter) {
            const strategy = adapter.getReportNamingStrategy();
            providerName = strategy.getProviderName();
            const columnInfo = strategy.getProviderSpecificColumn();
            report.setProviderSpecificColumnHeader(columnInfo.header);
        }

        const folderPath = `${reportFolder}/${providerName}`;

        // Ensure provider subfolder exists
        const folderResult = await ensureFolderExists(folderPath, this.app.vault);
        if (!folderResult.success) {
            this.logger.error(`Failed to create or access log folder: ${folderPath}`, folderResult.error);
            new Notice("Failed to create log file. Check console for details.");
            return "";
        }

        // Generate filename with timestamp
        const timestamp = formatTimestamp(Date.now() / 1000, "date");
        const timeStr = formatTimestamp(Date.now() / 1000, "time").replace(/:/g, "-");
        let logFilePath = `${folderPath}/${timestamp} ${timeStr} - import report.md`;

        // Handle duplicates
        let counter = 2;
        while (await this.app.vault.adapter.exists(logFilePath)) {
            logFilePath = `${folderPath}/${timestamp} ${timeStr}-${counter} - import report.md`;
            counter++;
        }

        // Generate frontmatter
        const currentDate = `${formatTimestamp(Date.now() / 1000, "date")} ${formatTimestamp(Date.now() / 1000, "time")}`;
        const stats = report.getCompletionStats();

        // Determine which files were processed vs skipped
        const processedFiles: string[] = [];
        const skippedFiles: string[] = [];

        if (stats.totalFiles > 0) {
            // Files that were actually processed (have entries in report)
            report.getProcessedFileNames().forEach(name => processedFiles.push(name));
        }

        // All files that weren't processed are considered skipped
        files.forEach(file => {
            if (!processedFiles.includes(file.name)) {
                skippedFiles.push(file.name);
            }
        });

        const logContent = `---
importdate: ${currentDate}
provider: ${provider}
totalFilesAnalyzed: ${files.length}
totalFilesProcessed: ${processedFiles.length}
totalFilesSkipped: ${skippedFiles.length}
totalConversations: ${stats.totalConversations}
totalCreated: ${stats.created}
totalUpdated: ${stats.updated}
totalSkipped: ${stats.skipped}
totalFailed: ${stats.failed}
---

${report.generateReportContent(files, processedFiles, skippedFiles, analysisInfo)}
`;

        try {
            this.logger.info(`Creating report file at: ${logFilePath}`);
            await this.app.vault.create(logFilePath, logContent);
            this.logger.info(`Consolidated report written to: ${logFilePath}`);
            return logFilePath;
        } catch (error: any) {
            this.logger.error(`Failed to write import log to ${logFilePath}:`, error);
            console.error("Full error:", error);
            console.error("Log content length:", logContent.length);
            new Notice("Failed to create log file. Check console for details.");
            return "";
        }
    }

    /**
     * Show import completion dialog
     */
    private showImportCompletionDialog(report: ImportReport, reportPath: string): void {
        const stats = report.getCompletionStats();

        new ImportCompletionDialog(
            this.app,
            stats,
            reportPath
        ).open();
    }

    /**
     * Group selected conversations by their source file for multi-file import
     */
    private async groupConversationsByFile(
        result: ConversationSelectionResult,
        files: File[]
    ): Promise<Map<string, string[]>> {
        const conversationsByFile = new Map<string, string[]>();

        // We need to re-extract metadata to get source file information
        // This is necessary because the selection result only contains IDs
        try {
            const providerRegistry = createProviderRegistry(this);
            const metadataExtractor = new ConversationMetadataExtractor(providerRegistry, this);
            const storage = this.getStorageService();
            const existingConversations = await storage.scanExistingConversations();

            // Re-extract metadata with source file tracking
            const extractionResult = await metadataExtractor.extractMetadataFromMultipleZips(
                files,
                undefined, // Let it auto-detect provider
                existingConversations
            );

            // Group selected conversations by source file
            const selectedIdsSet = new Set(result.selectedIds);
            for (const conversation of extractionResult.conversations) {
                if (selectedIdsSet.has(conversation.id) && conversation.sourceFile) {
                    const fileConversations = conversationsByFile.get(conversation.sourceFile) || [];
                    fileConversations.push(conversation.id);
                    conversationsByFile.set(conversation.sourceFile, fileConversations);
                }
            }
        } catch (error) {
            this.logger.error("Error grouping conversations by file:", error);
            // Fallback: assign all conversations to first file
            conversationsByFile.set(files[0].name, result.selectedIds);
        }

        return conversationsByFile;
    }

    /**
     * Sort files by timestamp (same logic as ImportService)
     */
    private sortFilesByTimestamp(files: File[]): File[] {
        return files.sort((a, b) => {
            const timestampRegex = /(\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2})/;
            const getTimestamp = (filename: string) => {
                const match = filename.match(timestampRegex);
                if (!match) {
                    this.logger.warn(`No timestamp found in filename: ${filename}`);
                    return "0";
                }
                return match[1];
            };
            return getTimestamp(a.name).localeCompare(getTimestamp(b.name));
        });
    }
}