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
import { Upgrader } from "./upgrade";
import { Logger } from "./logger";

export default class NexusAiChatImporterPlugin extends Plugin {
    settings!: PluginSettings;
    logger: Logger = new Logger();
    
    private storageService: StorageService;
    private importService: ImportService;
    private fileService: FileService;
    private commandRegistry: CommandRegistry;
    private eventHandlers: EventHandlers;

    constructor(app: App, manifest: PluginManifest) {
        super(app, manifest);
        
        this.storageService = new StorageService(this);
        this.importService = new ImportService(this);
        this.fileService = new FileService(this);
        this.commandRegistry = new CommandRegistry(this);
        this.eventHandlers = new EventHandlers(this);
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
            const upgrader = new Upgrader(this);
            await upgrader.checkForUpgrade();
            
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
            
            // NEW: Load only small data (archive hashes) - no large catalog
            await this.storageService.loadData();
            
            this.logger.info("Settings loaded successfully (vault-based conversation tracking)");
        } catch (error) {
            this.logger.error("loadSettings failed:", error);
            throw error;
        }
    }

    async saveSettings() {
        try {
            await this.storageService.saveData({
                settings: this.settings,
                importedArchives: this.storageService.getImportedArchives()
                // REMOVED: conversationCatalog (now vault-based)
            });
        } catch (error) {
            this.logger.error("saveSettings failed:", error);
            throw error;
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
}