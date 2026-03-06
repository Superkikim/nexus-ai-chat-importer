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

// src/main.ts
import { Plugin, App, PluginManifest, Notice, Platform } from "obsidian";
import { initLocale, t } from "./i18n";
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
import { InstallationWelcomeDialog } from "./dialogs/installation-welcome-dialog";
import { UpgradeNotice132Dialog } from "./dialogs/upgrade-notice-1.3.2-dialog";
import { createProviderRegistry } from "./providers/provider-registry";
import { FileSelectionResult, ConversationSelectionResult } from "./types/conversation-selection";
import { ConversationMetadataExtractor, IgnoredArchiveInfo } from "./services/conversation-metadata-extractor";
import { ImportReport } from "./models/import-report";
import { ImportCompletionDialog } from "./dialogs/import-completion-dialog";
import { ensureFolderExists, formatTimestamp } from "./utils";
import { sortFilesForImport } from "./utils/file-sort";
import type { GeminiIndex } from "./providers/gemini/gemini-types";
import { createZipArchiveReader } from "./utils/zip-loader";
import { classifyArchiveEntries } from "./utils/zip-content-reader";

interface ImportCheckpoint {
    operation: "import-all" | "selective-analysis" | "selective-import";
    phase: string;
    provider: string;
    fileName?: string;
    task?: string;
    conversationCount?: number;
    timestampMs: number;
}

export default class NexusAiChatImporterPlugin extends Plugin {
    settings!: PluginSettings;
    logger: Logger = new Logger();
    
    private storageService: StorageService;
    private importService: ImportService;
    private fileService: FileService;
    private commandRegistry: CommandRegistry;
	    private eventHandlers: EventHandlers;
	    private upgradeManager: IncrementalUpgradeManager;
	    private currentGeminiIndex: GeminiIndex | null = null;
        private lastImportCheckpoint: ImportCheckpoint | null = null;

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
            initLocale();
            await this.loadSettings();

            this.addSettingTab(new NexusAiChatImporterPluginSettingTab(this.app, this));
            this.commandRegistry.registerCommands();
            this.eventHandlers.registerEvents();

            const ribbonIconEl = this.addRibbonIcon(
                "message-square-plus",
                t('notices.ribbon_tooltip'),
                () => this.showProviderSelectionDialog()
            );
            ribbonIconEl.addClass("nexus-ai-chat-ribbon");

            // Check for upgrades and fresh installation
            const upgradeResult = await this.upgradeManager.checkAndPerformUpgrade();

            // Show installation welcome dialog for fresh installs
            if (upgradeResult?.isFreshInstall) {
                new InstallationWelcomeDialog(this.app, this.manifest.version).open();
            }

            // Show upgrade completion dialog if upgrade was performed
            // Called AFTER checkAndPerformUpgrade() returns to ensure styles.css is loaded
            if (upgradeResult?.showCompletionDialog && upgradeResult?.upgradedToVersion) {
                await this.upgradeManager.showUpgradeCompleteDialog(upgradeResult.upgradedToVersion);
            }

	            // Show upgrade notice dialog for users upgrading from 1.3.0 (new Claude format support)
	            if (
	                this.settings.previousVersion === "1.3.0" &&
	                !this.settings.hasSeenClaude132UpgradeNotice
	            ) {
	                UpgradeNotice132Dialog.open(this.app, this);
	                this.settings.hasSeenClaude132UpgradeNotice = true;
	                await this.saveSettings();
	            }
        } catch (error) {
            this.logger.error("Plugin loading failed:", error);
            throw error;
        }
    }

    async onunload() {
        try {
            this.importService.resetRuntimeState();
            if (this.currentGeminiIndex) {
                this.currentGeminiIndex = null;
                this.importService.setGeminiIndex(null);
            }
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
     * Ensures migration is complete before allowing import
     */
    async showProviderSelectionDialog(): Promise<void> {
        // Check if migration is needed before allowing import
        const upgradeResult = await this.upgradeManager.checkAndPerformUpgrade();

        // If migration was needed but failed/cancelled, block import
        if (upgradeResult !== null && !upgradeResult.success) {
            // Migration failed or was cancelled - notice already shown by upgrade manager
            return;
        }
        // If upgradeResult === null: no migration needed
        // If upgradeResult.success === true: migration completed successfully
        // In both cases, continue with import

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

	        // Separate ZIP exports from optional JSON files
	        const zipFiles = files.filter((file) => file.name.toLowerCase().endsWith(".zip"));
	        const jsonFiles = files.filter((file) => file.name.toLowerCase().endsWith(".json"));

	        if (provider === "gemini") {
	            if (zipFiles.length === 0) {
	                new Notice(t('notices.import_no_zip_gemini'));
	                this.logger.warn("[Gemini] No ZIP files selected for import");
	                return;
	            }

	            // Load index from the latest JSON file, if provided
	            let index: GeminiIndex | null = null;
	            if (jsonFiles.length > 0) {
	                // Prefer the most recently modified JSON file when multiple are selected
	                const latestIndexFile = jsonFiles.reduce((latest, current) => {
	                    return current.lastModified > latest.lastModified ? current : latest;
	                });

	                try {
	                    const content = await latestIndexFile.text();
	                    const parsed = JSON.parse(content);

	                    if (parsed && typeof parsed === "object" && Array.isArray((parsed as any).conversations)) {
	                        index = parsed as GeminiIndex;
	                        this.logger.info(
	                            `[Gemini] Loaded index file "${latestIndexFile.name}" with ${(parsed as any).conversations.length} conversations`
	                        );
	                    } else {
	                        this.logger.warn(
	                            `[Gemini] JSON index file "${latestIndexFile.name}" does not look like a valid GeminiIndex (missing conversations array)`
	                        );
	                    }
	                } catch (error) {
	                    this.logger.error("[Gemini] Failed to parse Gemini index JSON", error);
	                    new Notice(t('notices.import_gemini_json_failed'));
	                }
	            }

	            // Store on plugin and push into ImportService adapter
	            this.currentGeminiIndex = index;
	            this.importService.setGeminiIndex(index);

	            // Sort only the ZIP exports by timestamp
	            const sortedZipFiles = sortFilesForImport(zipFiles);

	            if (mode === "all") {
	                // Import all conversations with analysis (new optimized workflow)
	                await this.handleImportAll(sortedZipFiles, provider);
	            } else {
	                // Selective import - show conversation selection dialog
	                await this.handleSelectiveImport(sortedZipFiles, provider);
	            }
	        } else {
	            // Non-Gemini providers: ensure we do not keep a stale Gemini index
	            if (this.currentGeminiIndex) {
	                this.currentGeminiIndex = null;
	                this.importService.setGeminiIndex(null);
	            }

	            if (zipFiles.length === 0) {
	                new Notice(t('notices.import_no_zip'));
	                this.logger.warn(`[${provider}] No ZIP files selected for import`);
	                return;
	            }

	            const sortedZipFiles = sortFilesForImport(zipFiles);

	            if (mode === "all") {
	                await this.handleImportAll(sortedZipFiles, provider);
	            } else {
	                await this.handleSelectiveImport(sortedZipFiles, provider);
	            }
	        }
	    }

    /**
     * Handle "Import All" mode with analysis and auto-selection
     */
    private async handleImportAll(files: File[], provider: string): Promise<void> {
        try {
            const isMobile = this.isMobileTaskQueueMode();
            if (isMobile) {
                await this.handleImportAllMobileSequential(files, provider);
                return;
            }

            this.setImportCheckpoint({
                operation: "import-all",
                phase: "analysis-start",
                provider,
                task: `0/${files.length}`,
            });
            this.logger.child("ImportFlow").info(`Import-all analysis started`, {
                provider,
                fileCount: files.length,
            });
            new Notice(t('notices.import_analyzing', { count: String(files.length) }));

            // Create metadata extractor
            const providerRegistry = createProviderRegistry(this);
            const metadataExtractor = new ConversationMetadataExtractor(providerRegistry, this);

            // Get existing conversations for status checking
            const storage = this.getStorageService();
            const existingConversations = await storage.scanExistingConversations();

            // Extract metadata from all ZIP files (same as selective mode)
            this.setImportCheckpoint({
                operation: "import-all",
                phase: "metadata-extraction",
                provider,
                task: `0/${files.length}`,
            });
            const extractionResult = await metadataExtractor.extractMetadataFromMultipleZips(
                files,
                provider,
                existingConversations
            );
            this.logIgnoredArchives(extractionResult.ignoredArchives, provider, "import-all");

            this.logger.child("ImportFlow").info(`Import-all analysis finished`, {
                provider,
                fileCount: files.length,
                supportedFileCount: extractionResult.supportedFiles.length,
                ignoredArchiveCount: extractionResult.ignoredArchives.length,
                conversationCount: extractionResult.conversations.length,
            });

            if (extractionResult.supportedFiles.length === 0) {
                new Notice(`No supported ${provider} archives were found in the selected ZIP files.`);
                return;
            }

            // Create shared report for the entire operation
            const operationReport = new ImportReport();

            // Set custom timestamp format if enabled
            if (this.settings.useCustomMessageTimestampFormat) {
                operationReport.setCustomTimestampFormat(this.settings.messageTimestampFormat);
            }

            if (extractionResult.conversations.length === 0) {
                // No conversations to import, but still generate report and show dialog
                new Notice(t('notices.import_no_new'));

                // Write report showing what was analyzed
                const reportPath = await this.writeConsolidatedReport(operationReport, provider, files, extractionResult.analysisInfo, extractionResult.fileStats, false);

                // Show completion dialog with 0 imports
                if (reportPath) {
                    this.showImportCompletionDialog(operationReport, reportPath);
                }
                return;
            }

            // Auto-select ALL conversations (NEW + UPDATED)
            const allIds = extractionResult.conversations.map(c => c.id);

            const newCount = extractionResult.analysisInfo?.conversationsNew ?? 0;
            const updatedCount = extractionResult.analysisInfo?.conversationsUpdated ?? 0;
            new Notice(t('notices.import_starting', { count: String(allIds.length), new: String(newCount), updated: String(updatedCount) }));

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

            const filesToImport = files.filter(file => conversationsByFile.has(file.name));
            this.setImportCheckpoint({
                operation: "import-all",
                phase: "file-processing-start",
                provider,
                task: `0/${filesToImport.length}`,
                conversationCount: allIds.length,
            });
            await this.processFilesWithStrategy(
                "import-all",
                provider,
                filesToImport,
                conversationsByFile,
                operationReport
            );

            // Write the consolidated report (always, even if some files failed)
            const reportPath = await this.writeConsolidatedReport(operationReport, provider, files, extractionResult.analysisInfo, extractionResult.fileStats, false);

            // Show completion dialog
            if (reportPath) {
                this.showImportCompletionDialog(operationReport, reportPath);
            } else {
                // Fallback if report writing failed
                new Notice(t('notices.import_completed_fallback', { created: String(operationReport.getCreatedCount()), updated: String(operationReport.getUpdatedCount()) }));
            }

        } catch (error) {
            this.logImportFailureWithCheckpoint(error, "import-all");
            new Notice(t('notices.import_error', { error: error instanceof Error ? error.message : String(error) }));
        } finally {
            await this.runPostImportCleanup("import-all");
        }
    }

    private async handleImportAllMobileSequential(files: File[], provider: string): Promise<void> {
        this.setImportCheckpoint({
            operation: "import-all",
            phase: "mobile-direct-import-start",
            provider,
            task: `0/${files.length}`,
        });
        this.logger.child("ImportFlow").info("Mobile import-all running in direct sequential mode", {
            provider,
            fileCount: files.length,
        });

        const operationReport = new ImportReport();
        if (this.settings.useCustomMessageTimestampFormat) {
            operationReport.setCustomTimestampFormat(this.settings.messageTimestampFormat);
        }

        const providerRegistry = createProviderRegistry(this);
        const adapter = providerRegistry.getAdapter(provider);
        const entryFilter = adapter?.shouldIncludeZipEntry?.bind(adapter);

        let skippedUnsupported = 0;
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            this.setImportCheckpoint({
                operation: "import-all",
                phase: "mobile-direct-file-precheck",
                provider,
                fileName: file.name,
                task: `${i + 1}/${files.length}`,
            });

            let isSupportedArchive = true;
            try {
                const zip = await createZipArchiveReader(file, entryFilter);
                const entries = await zip.listEntries();
                const classification = classifyArchiveEntries(entries.map((entry) => entry.path), provider);
                if (!classification.supported) {
                    isSupportedArchive = false;
                    skippedUnsupported++;
                    this.logger.child("ImportFlow").warn("Skipping unsupported archive during mobile direct import", {
                        provider,
                        fileName: file.name,
                        reason: classification.reason,
                        message: classification.message,
                        task: `${i + 1}/${files.length}`,
                    });
                }
            } catch (error) {
                isSupportedArchive = false;
                skippedUnsupported++;
                this.logger.child("ImportFlow").warn("Skipping unreadable archive during mobile direct import", {
                    provider,
                    fileName: file.name,
                    message: error instanceof Error ? error.message : String(error),
                    task: `${i + 1}/${files.length}`,
                });
            }

            if (!isSupportedArchive) {
                await this.yieldToEventLoop();
                continue;
            }

            this.setImportCheckpoint({
                operation: "import-all",
                phase: "mobile-direct-file-import",
                provider,
                fileName: file.name,
                task: `${i + 1}/${files.length}`,
            });
            await this.importService.handleZipFile(file, provider, undefined, operationReport);
            this.importService.clearAttachmentMap();
            await this.yieldToEventLoop();
            await this.yieldToEventLoop();
        }

        const reportPath = await this.writeConsolidatedReport(
            operationReport,
            provider,
            files,
            undefined,
            undefined,
            false
        );

        if (reportPath) {
            this.showImportCompletionDialog(operationReport, reportPath);
        } else {
            new Notice(
                t("notices.import_completed_fallback", {
                    created: String(operationReport.getCreatedCount()),
                    updated: String(operationReport.getUpdatedCount()),
                })
            );
        }

        if (skippedUnsupported > 0) {
            new Notice(
                `${skippedUnsupported} archive(s) were skipped because they are unsupported for ${provider}.`,
                5000
            );
        }
    }

    /**
     * Handle selective import workflow
     */
    private async handleSelectiveImport(files: File[], provider: string): Promise<void> {
        try {
            this.setImportCheckpoint({
                operation: "selective-analysis",
                phase: "analysis-start",
                provider,
                task: `0/${files.length}`,
            });
            this.logger.child("ImportFlow").info(`Selective analysis started`, {
                provider,
                fileCount: files.length,
            });
            new Notice(t('notices.import_analyzing', { count: String(files.length) }));

            // Create metadata extractor
            const providerRegistry = createProviderRegistry(this);
            const metadataExtractor = new ConversationMetadataExtractor(providerRegistry, this);

            // Get existing conversations for status checking
            const storage = this.getStorageService();
            const existingConversations = await storage.scanExistingConversations();

            // Extract metadata from all ZIP files
            this.setImportCheckpoint({
                operation: "selective-analysis",
                phase: "metadata-extraction",
                provider,
                task: `0/${files.length}`,
            });
            const extractionResult = await metadataExtractor.extractMetadataFromMultipleZips(
                files,
                provider,
                existingConversations
            );
            this.logIgnoredArchives(extractionResult.ignoredArchives, provider, "selective-analysis");

            this.logger.child("ImportFlow").info(`Selective analysis finished`, {
                provider,
                fileCount: files.length,
                supportedFileCount: extractionResult.supportedFiles.length,
                ignoredArchiveCount: extractionResult.ignoredArchives.length,
                conversationCount: extractionResult.conversations.length,
            });

            if (extractionResult.supportedFiles.length === 0) {
                new Notice(`No supported ${provider} archives were found in the selected ZIP files.`);
                return;
            }

            if (extractionResult.conversations.length === 0) {
                // No conversations to import - same logic as full import
                new Notice(t('notices.import_no_new'));

                // Write report showing what was analyzed
                const operationReport = new ImportReport();
                const reportPath = await this.writeConsolidatedReport(
                    operationReport,
                    provider,
                    files,
                    extractionResult.analysisInfo,
                    extractionResult.fileStats,
                    true // isSelective
                );

                // Show completion dialog with 0 imports
                if (reportPath) {
                    this.showImportCompletionDialog(operationReport, reportPath);
                }
                return;
            }

            // Show conversation selection dialog with enhanced metadata
            new ConversationSelectionDialog(
                this.app,
                extractionResult.conversations,
                (result: ConversationSelectionResult) => {
                    this.handleConversationSelectionResult(
                        result,
                        extractionResult.conversations,
                        files,
                        provider,
                        extractionResult.analysisInfo,
                        extractionResult.fileStats
                    );
                },
                this,
                extractionResult.analysisInfo
            ).open();

	        } catch (error) {
                this.logImportFailureWithCheckpoint(error, "selective-analysis");
	            new Notice(t('notices.import_error_analyzing', { error: error instanceof Error ? error.message : String(error) }));
	        }
    }

    /**
     * Handle the result from conversation selection dialog
     */
    private async handleConversationSelectionResult(
        result: ConversationSelectionResult,
        availableConversations: any[],
        files: File[],
        provider: string,
        analysisInfo?: any,
        fileStats?: Map<string, any>
    ): Promise<void> {
        try {
            this.setImportCheckpoint({
                operation: "selective-import",
                phase: "selection-accepted",
                provider,
                conversationCount: result.selectedIds.length,
            });
            // Create shared report for the entire operation
            const operationReport = new ImportReport();

            // Set custom timestamp format if enabled
            if (this.settings.useCustomMessageTimestampFormat) {
                operationReport.setCustomTimestampFormat(this.settings.messageTimestampFormat);
            }

            if (result.selectedIds.length === 0) {
                new Notice(t('notices.import_no_selected'));

                // Still write report and show dialog
                const reportPath = await this.writeConsolidatedReport(operationReport, provider, files, analysisInfo, fileStats, true);
                if (reportPath) {
                    this.showImportCompletionDialog(operationReport, reportPath);
                }
                return;
            }

            new Notice(t('notices.import_starting_selected', { count: String(result.selectedIds.length), files: String(files.length) }));

            // Group selected conversations by source file for efficient processing
            const conversationsByFile = this.groupConversationsByFile(result.selectedIds, availableConversations);
            const filesToImport = files.filter(file => conversationsByFile.has(file.name));

            this.setImportCheckpoint({
                operation: "selective-import",
                phase: "file-processing-start",
                provider,
                task: `0/${filesToImport.length}`,
                conversationCount: result.selectedIds.length,
            });
            await this.processFilesWithStrategy(
                "selective-import",
                provider,
                filesToImport,
                conversationsByFile,
                operationReport
            );

            // Write the consolidated report (always, even if some files failed)
            const reportPath = await this.writeConsolidatedReport(operationReport, provider, files, analysisInfo, fileStats, true);

            // Show completion dialog
            if (reportPath) {
                this.showImportCompletionDialog(operationReport, reportPath);
            } else {
                // Fallback if report writing failed
                new Notice(t('notices.import_completed_fallback', { created: String(operationReport.getCreatedCount()), updated: String(operationReport.getUpdatedCount()) }));
            }
        } catch (error) {
            this.logImportFailureWithCheckpoint(error, "selective-import");
            new Notice(t('notices.import_error', { error: error instanceof Error ? error.message : String(error) }));
        } finally {
            await this.runPostImportCleanup("selective-import");
        }
    }

    /**
     * Write consolidated report for multi-file import
     */
    private async writeConsolidatedReport(
        report: ImportReport,
        provider: string,
        files: File[],
        analysisInfo?: any,
        fileStats?: Map<string, any>,
        isSelectiveImport?: boolean
    ): Promise<string> {
        // Get provider-specific folder
        const reportFolder = this.settings.reportFolder;

        const providerRegistry = createProviderRegistry(this);
        const adapter = providerRegistry.getAdapter(provider);

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
            new Notice(t('notices.report_failed'));
            return "";
        }

        // Generate filename with timestamp (YYYYMMDD-HHMMSS format for chronological sorting)
        const now = Date.now() / 1000;
        const datePrefix = formatTimestamp(now, "prefix"); // YYYYMMDD
        const timeStr = formatTimestamp(now, "time").replace(/:/g, "").replace(/ /g, ""); // HHMMSS
        let logFilePath = `${folderPath}/${datePrefix}-${timeStr} - import report.md`;

        // Handle duplicates
        let counter = 2;
        while (await this.app.vault.adapter.exists(logFilePath)) {
            logFilePath = `${folderPath}/${datePrefix}-${timeStr}-${counter} - import report.md`;
            counter++;
        }

        // Generate frontmatter with ISO 8601 date format (consistent with conversation frontmatter)
        const currentDate = new Date().toISOString();

        // Store file stats for duplicate counting
        if (fileStats) {
            report.setFileStats(fileStats);
        }

        // Store analysis info for completion stats
        if (analysisInfo) {
            report.setAnalysisInfo(analysisInfo);
        }

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

${report.generateReportContent(files, processedFiles, skippedFiles, analysisInfo, fileStats, isSelectiveImport)}
`;

        try {
            await this.app.vault.create(logFilePath, logContent);
            return logFilePath;
        } catch (error: any) {
            this.logger.error(`Failed to write import log to ${logFilePath}:`, error);
            this.logger.error("Full error:", error);
            this.logger.error("Log content length:", logContent.length);
            new Notice(t('notices.report_failed'));
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
    private groupConversationsByFile(
        selectedIds: string[],
        conversations: Array<{ id: string; sourceFile?: string }>
    ): Map<string, string[]> {
        const conversationsByFile = new Map<string, string[]>();

        const selectedIdsSet = new Set(selectedIds);
        for (const conversation of conversations) {
            if (!selectedIdsSet.has(conversation.id) || !conversation.sourceFile) {
                continue;
            }

            const fileConversations = conversationsByFile.get(conversation.sourceFile) || [];
            fileConversations.push(conversation.id);
            conversationsByFile.set(conversation.sourceFile, fileConversations);
        }

        return conversationsByFile;
    }

    private isMobileTaskQueueMode(): boolean {
        return Platform.isMobileApp || Platform.isMobile;
    }

    private async yieldToEventLoop(): Promise<void> {
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
    }

    private async runPostImportCleanup(operation: "import-all" | "selective-import"): Promise<void> {
        const importFlowLogger = this.logger.child("ImportFlow");
        const isMobile = this.isMobileTaskQueueMode();

        this.setImportCheckpoint({
            operation,
            phase: "cleanup-start",
            provider: "n/a",
        });
        importFlowLogger.info(`Post-import cleanup started`, {
            operation,
            isMobile,
        });

        this.importService.resetRuntimeState();
        await this.yieldToEventLoop();
        if (isMobile) {
            await this.yieldToEventLoop();
        }

        this.setImportCheckpoint({
            operation,
            phase: "cleanup-complete",
            provider: "n/a",
        });
        importFlowLogger.info(`Post-import cleanup complete`, {
            operation,
            isMobile,
        });
    }

    private async processFilesWithStrategy(
        operation: "import-all" | "selective-import",
        provider: string,
        filesToImport: File[],
        conversationsByFile: Map<string, string[]>,
        operationReport: ImportReport
    ): Promise<void> {
        const importFlowLogger = this.logger.child("ImportFlow");
        const mobileTaskQueueMode = this.isMobileTaskQueueMode();

        if (!mobileTaskQueueMode && provider === "chatgpt" && filesToImport.length > 1) {
            this.setImportCheckpoint({
                operation,
                phase: "attachment-map-build",
                provider,
                task: `0/${filesToImport.length}`,
            });
            importFlowLogger.info(`Building multi-ZIP attachment map`, {
                provider,
                fileCount: filesToImport.length,
                mode: "desktop-multi-zip",
            });
            await this.importService.buildAttachmentMapForMultiZip(filesToImport, provider);
        }

        for (let i = 0; i < filesToImport.length; i++) {
            const file = filesToImport[i];
            const conversationsForFile = conversationsByFile.get(file.name);

            if (!conversationsForFile || conversationsForFile.length === 0) {
                continue;
            }

            try {
                if (mobileTaskQueueMode && provider === "chatgpt") {
                    this.setImportCheckpoint({
                        operation,
                        phase: "attachment-map-build",
                        provider,
                        fileName: file.name,
                        task: `${i + 1}/${filesToImport.length}`,
                        conversationCount: conversationsForFile.length,
                    });
                    importFlowLogger.info(`Building single-ZIP attachment map for mobile task`, {
                        provider,
                        fileName: file.name,
                        task: `${i + 1}/${filesToImport.length}`,
                    });
                    await this.importService.buildAttachmentMapForMultiZip([file], provider);
                }

                this.setImportCheckpoint({
                    operation,
                    phase: "file-import",
                    provider,
                    fileName: file.name,
                    task: `${i + 1}/${filesToImport.length}`,
                    conversationCount: conversationsForFile.length,
                });
                importFlowLogger.info(`Importing file`, {
                    provider,
                    fileName: file.name,
                    conversationCount: conversationsForFile.length,
                    task: `${i + 1}/${filesToImport.length}`,
                    mode: mobileTaskQueueMode ? "mobile-single-zip" : "standard",
                });

                await this.importService.handleZipFile(file, provider, conversationsForFile, operationReport);
            } catch (error) {
                this.logger.error(`Error processing file ${file.name}:`, error);
                new Notice(t('notices.import_error_file', { filename: file.name }));
            } finally {
                if (mobileTaskQueueMode) {
                    this.importService.clearAttachmentMap();
                    this.setImportCheckpoint({
                        operation,
                        phase: "mobile-file-cleanup",
                        provider,
                        fileName: file.name,
                        task: `${i + 1}/${filesToImport.length}`,
                    });
                    await this.yieldToEventLoop();
                }
            }
        }

        if (!mobileTaskQueueMode && provider === "chatgpt" && filesToImport.length > 1) {
            this.importService.clearAttachmentMap();
        }
    }

    private setImportCheckpoint(checkpoint: Omit<ImportCheckpoint, "timestampMs">): void {
        const nextCheckpoint: ImportCheckpoint = {
            ...checkpoint,
            timestampMs: Date.now(),
        };
        this.lastImportCheckpoint = nextCheckpoint;

        this.logger.child("ImportCheckpoint").info("Checkpoint reached", {
            operation: nextCheckpoint.operation,
            phase: nextCheckpoint.phase,
            provider: nextCheckpoint.provider,
            fileName: nextCheckpoint.fileName ?? null,
            task: nextCheckpoint.task ?? null,
            conversationCount: nextCheckpoint.conversationCount ?? null,
        });
    }

    private logImportFailureWithCheckpoint(
        error: unknown,
        operation: "import-all" | "selective-analysis" | "selective-import"
    ): void {
        const message = error instanceof Error ? error.message : String(error);
        const stack = error instanceof Error ? error.stack : undefined;
        this.logger.child("ImportFlow").error("Import operation failed", {
            operation,
            message,
            lastCheckpoint: this.lastImportCheckpoint,
            stack,
        });
    }

    private logIgnoredArchives(
        ignoredArchives: IgnoredArchiveInfo[],
        provider: string,
        operation: "import-all" | "selective-analysis"
    ): void {
        if (ignoredArchives.length === 0) {
            return;
        }

        const groupedCounts = ignoredArchives.reduce<Record<string, number>>((acc, archive) => {
            acc[archive.reason] = (acc[archive.reason] || 0) + 1;
            return acc;
        }, {});

        this.logger.child("ImportFlow").warn("Archives ignored during metadata extraction", {
            operation,
            provider,
            ignoredCount: ignoredArchives.length,
            groupedCounts,
            archives: ignoredArchives.map(archive => ({
                fileName: archive.fileName,
                reason: archive.reason,
                message: archive.message,
            })),
        });

        new Notice(
            `${ignoredArchives.length} archive(s) ignored during analysis (${provider}). Check console logs for details.`,
            5000
        );
    }
}
