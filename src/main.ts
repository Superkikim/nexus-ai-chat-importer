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
import { ConversationCatalogEntry, PluginSettings } from "./types/plugin";
import { NexusAiChatImporterPluginSettingTab } from "./ui/settings-tab";
import { CommandRegistry } from "./commands/command-registry";
import { EventHandlers } from "./events/event-handlers";
import { ImportService } from "./services/import-service";
import { StorageService } from "./services/storage-service";
import { FileService } from "./services/file-service";
import { IncrementalUpgradeManager } from "./upgrade/incremental-upgrade-manager";
import { Logger } from "./logger";
import { EnhancedFileSelectionDialog } from "./dialogs/enhanced-file-selection-dialog";
import { ConversationSelectionDialog } from "./dialogs/conversation-selection-dialog";
import { InstallationWelcomeDialog } from "./dialogs/installation-welcome-dialog";
import { UpgradeNotice132Dialog } from "./dialogs/upgrade-notice-1.3.2-dialog";
import { showDialog } from "./dialogs";
import { createProviderRegistry } from "./providers/provider-registry";
import { FileSelectionResult, ConversationSelectionResult } from "./types/conversation-selection";
import { ConversationMetadataExtractor, IgnoredArchiveInfo } from "./services/conversation-metadata-extractor";
import { ImportReport } from "./models/import-report";
import { ImportCompletionDialog } from "./dialogs/import-completion-dialog";
import { ensureFolderExists, formatTimestamp, getFileFingerprint } from "./utils";
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

type MobileArchiveImportMode = "reprocess" | "incremental";

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
                new InstallationWelcomeDialog(
                    this.app,
                    this.manifest.version,
                    () => this.openPluginSettings()
                ).open();
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
     * Open Obsidian settings directly on this plugin tab.
     * Uses runtime APIs not exposed in the public TypeScript definitions.
     */
    private openPluginSettings(): void {
        const settingsApi = (this.app as unknown as {
            setting?: {
                open?: () => void;
                openTabById?: (id: string) => void;
            };
        }).setting;

        if (!settingsApi?.open) {
            this.logger.warn("Unable to open settings automatically: app.setting.open is unavailable");
            return;
        }

        settingsApi.open();
        settingsApi.openTabById?.(this.manifest.id);
    }

    /**
     * Entry point for imports.
     * Provider is auto-detected from the first supported selected ZIP.
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

        const importFlowLogger = this.logger.child("ImportFlow");
        importFlowLogger.info("Opening file selection dialog with provider auto-detection", {
            isMobile: this.isMobileTaskQueueMode(),
        });

        try {
            this.showEnhancedFileSelectionDialog("auto");
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            importFlowLogger.error("Failed to open enhanced file selection dialog", {
                selectedProvider: "auto",
                message,
                stack: error instanceof Error ? error.stack : undefined,
            });
            new Notice(t("notices.import_error", { error: message }));
        }
    }

    /**
     * Show enhanced file selection dialog with import mode choice
     */
    private showEnhancedFileSelectionDialog(provider: string): void {
        new EnhancedFileSelectionDialog(
            this.app,
            provider,
            (result: FileSelectionResult) => {
                void this.handleFileSelectionResult(result);
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
		        let zipFiles = files.filter((file) => file.name.toLowerCase().endsWith(".zip"));
		        const jsonFiles = files.filter((file) => file.name.toLowerCase().endsWith(".json"));
	            const isMobile = this.isMobileTaskQueueMode();

	            if (isMobile && zipFiles.length > 1) {
	                this.logger.child("ImportFlow").warn("Mobile ZIP selection limited to one archive", {
	                    provider,
	                    selectedZipCount: zipFiles.length,
	                    keptFileName: zipFiles[0].name,
	                });
	                new Notice(t("notices.import_mobile_single_zip_only"));
	                zipFiles = [zipFiles[0]];
	            }

        const sortedZipFiles = sortFilesForImport(zipFiles);
        const lockedProvider = await this.resolveProviderLockFromSelection(sortedZipFiles);
        if (!lockedProvider) {
            new Notice(
                t("notices.import_error_analyzing", {
                    error: "No supported archive was detected in the selected ZIP files.",
                })
            );
            return;
        }

        if (provider !== "auto" && lockedProvider.provider !== provider) {
            this.logger.child("ImportFlow").warn("Provider selection overridden by first supported archive", {
                selectedProvider: provider,
                lockedProvider: lockedProvider.provider,
                lockSourceFile: lockedProvider.fileName,
            });
        } else if (provider === "auto") {
            this.logger.child("ImportFlow").info("Provider auto-detected from selected archives", {
                lockedProvider: lockedProvider.provider,
                lockSourceFile: lockedProvider.fileName,
            });
        }

        const effectiveProvider = lockedProvider.provider;

        if (effectiveProvider === "gemini") {
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
            if (mode === "all") {
                // Import all conversations with analysis (new optimized workflow)
                await this.handleImportAll(sortedZipFiles, effectiveProvider);
            } else {
                // Selective import - show conversation selection dialog
                await this.handleSelectiveImport(sortedZipFiles, effectiveProvider);
            }
        } else {
            // Non-Gemini providers: ensure we do not keep a stale Gemini index
            if (this.currentGeminiIndex) {
                this.currentGeminiIndex = null;
                this.importService.setGeminiIndex(null);
            }

            if (zipFiles.length === 0) {
                new Notice(t('notices.import_no_zip'));
                this.logger.warn(`[${effectiveProvider}] No ZIP files selected for import`);
                return;
            }

            if (mode === "all") {
                await this.handleImportAll(sortedZipFiles, effectiveProvider);
            } else {
                await this.handleSelectiveImport(sortedZipFiles, effectiveProvider);
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
                new Notice(t('notices.import_no_supported_archives', { provider }));
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
        const mobileFiles = files.slice(0, 1);
        if (files.length > 1) {
            this.logger.child("ImportFlow").warn("Mobile import-all guard kept only one ZIP file", {
                provider,
                selectedFileCount: files.length,
                keptFileName: mobileFiles[0]?.name ?? null,
            });
        }

        this.setImportCheckpoint({
            operation: "import-all",
            phase: "mobile-direct-import-start",
            provider,
            task: `0/${mobileFiles.length}`,
        });
        this.logger.child("ImportFlow").info("Mobile import-all running in direct sequential mode", {
            provider,
            fileCount: mobileFiles.length,
        });

        const providerRegistry = createProviderRegistry(this);
        const adapter = providerRegistry.getAdapter(provider);
        const entryFilter = adapter?.shouldIncludeZipEntry?.bind(adapter);
        const storage = this.getStorageService();
        const operationReport = new ImportReport();
        if (this.settings.useCustomMessageTimestampFormat) {
            operationReport.setCustomTimestampFormat(this.settings.messageTimestampFormat);
        }

        this.setImportCheckpoint({
            operation: "import-all",
            phase: "mobile-direct-existing-scan-start",
            provider,
        });
        const existingScanStartedAt = Date.now();
        let existingConversationsMap: Map<string, ConversationCatalogEntry> = await storage.scanExistingConversations();
        this.logger.child("ImportFlow").info("Mobile direct import existing conversation scan complete", {
            provider,
            conversationCount: existingConversationsMap.size,
            durationMs: Date.now() - existingScanStartedAt,
        });
        this.setImportCheckpoint({
            operation: "import-all",
            phase: "mobile-direct-existing-scan-complete",
            provider,
            conversationCount: existingConversationsMap.size,
        });
        await this.yieldToEventLoop();

        let skippedUnsupported = 0;
        for (let i = 0; i < mobileFiles.length; i++) {
            const file = mobileFiles[i];

            this.setImportCheckpoint({
                operation: "import-all",
                phase: "mobile-direct-file-precheck",
                provider,
                fileName: file.name,
                task: `${i + 1}/${mobileFiles.length}`,
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
                        task: `${i + 1}/${mobileFiles.length}`,
                    });
                }
            } catch (error) {
                isSupportedArchive = false;
                skippedUnsupported++;
                const errorMessage = error instanceof Error ? error.message : String(error);
                this.logger.child("ImportFlow").warn("Skipping unreadable archive during mobile direct import", {
                    provider,
                    fileName: file.name,
                    message: errorMessage,
                    task: `${i + 1}/${mobileFiles.length}`,
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
                task: `${i + 1}/${mobileFiles.length}`,
            });
            const archiveImportMode = await this.resolveMobileArchiveImportMode(file, provider);
            await this.importService.handleZipFile(
                file,
                provider,
                undefined,
                operationReport,
                existingConversationsMap,
                { archiveImportMode }
            );

            this.importService.resetRuntimeState();
            await this.yieldToEventLoop();
            await this.yieldToEventLoop();
            await new Promise<void>((resolve) => window.setTimeout(resolve, 500));

            this.setImportCheckpoint({
                operation: "import-all",
                phase: "mobile-direct-existing-rescan",
                provider,
                fileName: file.name,
                task: `${i + 1}/${mobileFiles.length}`,
            });
            const rescanStartedAt = Date.now();
            existingConversationsMap.clear();
            existingConversationsMap = await storage.scanExistingConversations();
            this.logger.child("ImportFlow").info("Mobile direct import existing conversation map refreshed", {
                provider,
                fileName: file.name,
                conversationCount: existingConversationsMap.size,
                durationMs: Date.now() - rescanStartedAt,
            });
            await this.yieldToEventLoop();
        }

        existingConversationsMap.clear();
        existingConversationsMap = new Map<string, ConversationCatalogEntry>();
        await this.yieldToEventLoop();

        const reportPath = await this.writeConsolidatedReport(operationReport, provider, mobileFiles);
        if (reportPath) {
            this.showImportCompletionDialog(operationReport, reportPath);
        } else {
            new Notice(t('notices.import_completed_fallback', {
                created: String(operationReport.getCreatedCount()),
                updated: String(operationReport.getUpdatedCount()),
            }));
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
            const mobileFiles = this.isMobileTaskQueueMode() ? files.slice(0, 1) : files;
            if (this.isMobileTaskQueueMode() && files.length > 1) {
                this.logger.child("ImportFlow").warn("Mobile selective import guard kept only one ZIP file", {
                    provider,
                    selectedFileCount: files.length,
                    keptFileName: mobileFiles[0]?.name ?? null,
                });
                new Notice(t("notices.import_mobile_single_zip_only"));
            }

            this.setImportCheckpoint({
                operation: "selective-analysis",
                phase: "analysis-start",
                provider,
                task: `0/${mobileFiles.length}`,
            });
            this.logger.child("ImportFlow").info(`Selective analysis started`, {
                provider,
                fileCount: mobileFiles.length,
            });
            new Notice(t('notices.import_analyzing', { count: String(mobileFiles.length) }));

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
                task: `0/${mobileFiles.length}`,
            });
            const extractionResult = await metadataExtractor.extractMetadataFromMultipleZips(
                mobileFiles,
                provider,
                existingConversations
            );
            this.logIgnoredArchives(extractionResult.ignoredArchives, provider, "selective-analysis");

            this.logger.child("ImportFlow").info(`Selective analysis finished`, {
                provider,
                fileCount: mobileFiles.length,
                supportedFileCount: extractionResult.supportedFiles.length,
                ignoredArchiveCount: extractionResult.ignoredArchives.length,
                conversationCount: extractionResult.conversations.length,
            });

            if (extractionResult.supportedFiles.length === 0) {
                new Notice(t('notices.import_no_supported_archives', { provider }));
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
                    mobileFiles,
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
                        mobileFiles,
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
        const folderResult = await ensureFolderExists(folderPath, this.app.vault);
        if (!folderResult.success) {
            this.logger.error(`Failed to create or access log folder: ${folderPath}`, folderResult.error);
            new Notice(t('notices.report_failed'));
            return "";
        }

        const now = Date.now() / 1000;
        const datePrefix = formatTimestamp(now, "prefix");
        const timeStr = formatTimestamp(now, "time").replace(/:/g, "").replace(/ /g, "");
        let basePrefix = `${datePrefix}-${timeStr}`;
        let counter = 2;
        let summaryPath = `${folderPath}/${basePrefix} - import summary.md`;
        let heavyPath = `${folderPath}/${basePrefix} - index heavy.md`;
        let mobilePath = `${folderPath}/${basePrefix} - index mobile.md`;

        while (
            await this.app.vault.adapter.exists(summaryPath) ||
            await this.app.vault.adapter.exists(heavyPath) ||
            await this.app.vault.adapter.exists(mobilePath)
        ) {
            basePrefix = `${datePrefix}-${timeStr}-${counter}`;
            summaryPath = `${folderPath}/${basePrefix} - import summary.md`;
            heavyPath = `${folderPath}/${basePrefix} - index heavy.md`;
            mobilePath = `${folderPath}/${basePrefix} - index mobile.md`;
            counter++;
        }

        const currentDate = new Date().toISOString();
        if (fileStats) {
            report.setFileStats(fileStats);
        }

        if (analysisInfo) {
            report.setAnalysisInfo(analysisInfo);
        }

        const stats = report.getCompletionStats();
        const processedFiles: string[] = [];
        const skippedFiles: string[] = [];
        if (stats.totalFiles > 0 || report.getProcessedFileNames().length > 0) {
            report.getProcessedFileNames().forEach(name => processedFiles.push(name));
        }

        files.forEach(file => {
            if (!processedFiles.includes(file.name)) {
                skippedFiles.push(file.name);
            }
        });

        const summaryFileName = summaryPath.split("/").pop() || `${basePrefix} - import summary.md`;
        const heavyFileName = heavyPath.split("/").pop() || `${basePrefix} - index heavy.md`;
        const mobileFileName = mobilePath.split("/").pop() || `${basePrefix} - index mobile.md`;
        const links = { summaryFileName, heavyFileName, mobileFileName };
        const archiveDisplayNames = this.buildArchiveDisplayNames(provider, files);
        const commonFrontmatter = `importdate: ${currentDate}
provider: ${provider}
totalFilesAnalyzed: ${files.length}
totalFilesProcessed: ${processedFiles.length}
totalFilesSkipped: ${skippedFiles.length}
totalConversations: ${stats.totalConversations}
totalCreated: ${stats.created}
totalUpdated: ${stats.updated}
totalSkipped: ${stats.skipped}
totalFailed: ${stats.failed}
`;

        const summaryContent = `---
${commonFrontmatter}reportType: summary
linkedHeavy: ${heavyFileName}
linkedMobile: ${mobileFileName}
---

${report.generateSummaryReportContent(
            files,
            processedFiles,
            skippedFiles,
            analysisInfo,
            fileStats,
            isSelectiveImport,
            archiveDisplayNames,
            links
        )}
`;

        const heavyContent = `---
${commonFrontmatter}reportType: index-heavy
linkedSummary: ${summaryFileName}
linkedMobile: ${mobileFileName}
---

${report.generateHeavyIndexContent(files, links)}
`;

        const mobileContent = `---
${commonFrontmatter}reportType: index-mobile
linkedSummary: ${summaryFileName}
linkedHeavy: ${heavyFileName}
---

${report.generateMobileIndexContent(files, links)}
`;

        try {
            await this.app.vault.create(summaryPath, summaryContent);
            await this.app.vault.create(heavyPath, heavyContent);
            await this.app.vault.create(mobilePath, mobileContent);
            return summaryPath;
        } catch (error: any) {
            this.logger.error(`Failed to write consolidated reports`, error);
            this.logger.error("Full error:", error);
            new Notice(t('notices.report_failed'));
            return "";
        }
    }

    private buildArchiveDisplayNames(provider: string, files: File[]): Map<string, string> {
        const map = new Map<string, string>();
        for (const file of files) {
            map.set(file.name, this.getArchiveDisplayName(provider, file.name));
        }
        return map;
    }

    private getArchiveDisplayName(provider: string, fileName: string): string {
        const normalizedProvider = provider.toLowerCase();
        const lowerName = fileName.toLowerCase();
        if (!lowerName.endsWith(".zip")) {
            return fileName;
        }

        const stem = fileName.slice(0, -4);
        if (stem.length <= 12) {
            return fileName;
        }

        const head = stem.slice(0, 3);

        if (normalizedProvider === "claude") {
            const timeMatches = Array.from(stem.matchAll(/-(\d{2})-(\d{2})-(\d{2})/g));
            const lastTime = timeMatches.length > 0 ? timeMatches[timeMatches.length - 1] : null;
            const lastCharMatch = stem.match(/([A-Za-z0-9])$/);
            if (lastTime && lastCharMatch) {
                const mm = lastTime[2];
                const ss = lastTime[3];
                return `${head}...${mm}-${ss}...${lastCharMatch[1]}.zip`;
            }
        }

        if (normalizedProvider === "chatgpt") {
            const chatGptTail = stem.match(/-(\d{2})-(\d{2})$/);
            if (chatGptTail) {
                return `${head}...${chatGptTail[1]}-${chatGptTail[2]}.zip`;
            }
        }

        const tailMatch = stem.match(/([A-Za-z0-9]{4})$/);
        const tail = tailMatch ? tailMatch[1] : stem.slice(-4);
        return `${head}...${tail}.zip`;
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

    private async resolveProviderLockFromSelection(
        files: File[]
    ): Promise<{ provider: string; fileName: string } | null> {
        const providerRegistry = createProviderRegistry(this);
        for (const file of files) {
            try {
                const zip = await createZipArchiveReader(file);
                const entries = await zip.listEntries();
                const classification = classifyArchiveEntries(entries.map((entry) => entry.path));
                if (!classification.supported) {
                    continue;
                }

                // Lock only to currently enabled providers.
                if (!providerRegistry.getAdapter(classification.provider)) {
                    this.logger.child("ImportFlow").warn("Detected provider is not enabled; skipping as lock source", {
                        fileName: file.name,
                        detectedProvider: classification.provider,
                    });
                    continue;
                }

                return { provider: classification.provider, fileName: file.name };
            } catch (error) {
                this.logger.child("ImportFlow").warn("Failed to analyze ZIP while resolving provider lock", {
                    fileName: file.name,
                    message: error instanceof Error ? error.message : String(error),
                });
            }
        }

        return null;
    }

    private async resolveMobileArchiveImportMode(file: File, provider: string): Promise<MobileArchiveImportMode> {
        if (!this.isMobileTaskQueueMode()) {
            return "incremental";
        }

        const storage = this.getStorageService();
        const archiveFingerprint = getFileFingerprint(file);
        const alreadyImported = storage.isArchiveImported(archiveFingerprint) || storage.isArchiveImported(file.name);
        if (!alreadyImported) {
            return "incremental";
        }

        this.logger.child("ImportFlow").info("Mobile archive already processed, prompting for import mode", {
            provider,
            fileName: file.name,
            fingerprint: archiveFingerprint,
        });

        const shouldReprocess = await showDialog(
            this.app,
            "confirmation",
            t("mobile_archive_processed_dialog.title"),
            [
                t("mobile_archive_processed_dialog.description", { filename: file.name }),
                t("mobile_archive_processed_dialog.choice_help"),
            ],
            undefined,
            {
                button1: t("mobile_archive_processed_dialog.button_reprocess"),
                button2: t("mobile_archive_processed_dialog.button_incremental"),
            }
        );

        const selectedMode: MobileArchiveImportMode = shouldReprocess ? "reprocess" : "incremental";
        this.logger.child("ImportFlow").info("Mobile archive import mode selected", {
            provider,
            fileName: file.name,
            selectedMode,
        });

        return selectedMode;
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
        const executionFiles = mobileTaskQueueMode ? filesToImport.slice(0, 1) : filesToImport;

        if (mobileTaskQueueMode && filesToImport.length > 1) {
            importFlowLogger.warn("Mobile file strategy guard kept only one ZIP file", {
                operation,
                provider,
                selectedFileCount: filesToImport.length,
                keptFileName: executionFiles[0]?.name ?? null,
            });
        }

        if (!mobileTaskQueueMode && provider === "chatgpt" && executionFiles.length > 1) {
            this.setImportCheckpoint({
                operation,
                phase: "attachment-map-build",
                provider,
                task: `0/${executionFiles.length}`,
            });
            importFlowLogger.info(`Building multi-ZIP attachment map`, {
                provider,
                fileCount: executionFiles.length,
                mode: "desktop-multi-zip",
            });
            await this.importService.buildAttachmentMapForMultiZip(executionFiles, provider);
        }

        for (let i = 0; i < executionFiles.length; i++) {
            const file = executionFiles[i];
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
                        task: `${i + 1}/${executionFiles.length}`,
                        conversationCount: conversationsForFile.length,
                    });
                    importFlowLogger.info(`Building single-ZIP attachment map for mobile task`, {
                        provider,
                        fileName: file.name,
                        task: `${i + 1}/${executionFiles.length}`,
                    });
                    await this.importService.buildAttachmentMapForMultiZip([file], provider);
                }

                this.setImportCheckpoint({
                    operation,
                    phase: "file-import",
                    provider,
                    fileName: file.name,
                    task: `${i + 1}/${executionFiles.length}`,
                    conversationCount: conversationsForFile.length,
                });
                importFlowLogger.info(`Importing file`, {
                    provider,
                    fileName: file.name,
                    conversationCount: conversationsForFile.length,
                    task: `${i + 1}/${executionFiles.length}`,
                    mode: mobileTaskQueueMode ? "mobile-single-zip" : "standard",
                });

                const archiveImportMode = mobileTaskQueueMode
                    ? await this.resolveMobileArchiveImportMode(file, provider)
                    : undefined;

                await this.importService.handleZipFile(
                    file,
                    provider,
                    conversationsForFile,
                    operationReport,
                    undefined,
                    archiveImportMode ? { archiveImportMode } : undefined
                );
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
                        task: `${i + 1}/${executionFiles.length}`,
                    });
                    await this.yieldToEventLoop();
                }
            }
        }

        if (!mobileTaskQueueMode && provider === "chatgpt" && executionFiles.length > 1) {
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
