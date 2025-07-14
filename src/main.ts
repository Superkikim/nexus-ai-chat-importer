// src/main.ts
import { Plugin, App, PluginManifest } from "obsidian";
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
            console.debug("[NEXUS-DEBUG] Plugin.onload() - Starting");
            await this.loadSettings();
            console.debug("[NEXUS-DEBUG] Settings loaded, registering components");
            
            this.addSettingTab(new NexusAiChatImporterPluginSettingTab(this.app, this));
            this.commandRegistry.registerCommands();
            this.eventHandlers.registerEvents();
            
            const ribbonIconEl = this.addRibbonIcon(
                "message-square-plus",
                "Nexus AI Chat Importer - Import new file",
                () => this.importService.selectZipFile()
            );
            ribbonIconEl.addClass("nexus-ai-chat-ribbon");
            
            console.debug("[NEXUS-DEBUG] Components registered, starting upgrade check");
            await this.upgradeManager.checkAndPerformUpgrade();
            
            console.debug("[NEXUS-DEBUG] Plugin.onload() - Completed successfully");
        } catch (error) {
            console.error("[NEXUS-DEBUG] Plugin.onload() - FAILED", error);
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
            
            // Initialize version tracking - FIXED LOGIC
            const currentVersion = this.manifest.version;
            const storedCurrentVersion = this.settings.currentVersion;
            
            if (!storedCurrentVersion || storedCurrentVersion === "0.0.0") {
                // FIRST TIME EVER with version tracking
                
                // Check if this is existing installation by scanning for conversations
                const hasExistingConversations = await this.hasExistingNexusConversations();
                
                if (hasExistingConversations) {
                    // Existing user upgrading to version tracking for first time
                    this.settings.previousVersion = "1.0.8"; // Last version before tracking
                    this.settings.currentVersion = currentVersion;
                    this.logger.info(`Version tracking initialized: assumed upgrade from 1.0.8 → ${currentVersion}`);
                } else {
                    // Fresh install
                    this.settings.previousVersion = currentVersion;
                    this.settings.currentVersion = currentVersion;
                    this.logger.info(`Fresh install detected - version set to ${currentVersion}`);
                }
                
                await this.saveSettings();
                
            } else if (storedCurrentVersion !== currentVersion) {
                // NORMAL UPGRADE - move current to previous, set new current
                this.settings.previousVersion = storedCurrentVersion;
                this.settings.currentVersion = currentVersion;
                this.logger.info(`Version updated: ${storedCurrentVersion} → ${currentVersion}`);
                await this.saveSettings();
            }
            
            // Load storage data (archive hashes)
            await this.storageService.loadData();
            
            this.logger.info("Settings loaded successfully (vault-based conversation tracking)");
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
            // Load existing data to preserve upgrade history
            const existingData = await this.loadData() || {};
            
            // Merge with new data, preserving upgrade history structure
            const mergedData = {
                ...existingData, // Preserve existing data
                settings: this.settings,
                importedArchives: this.storageService.getImportedArchives(),
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
            this.logger.info("Catalogs reset successfully");
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
}