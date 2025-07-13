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
        
        // Debug: Track construction time
        const constructStart = performance.now();
        
        this.storageService = new StorageService(this);
        this.importService = new ImportService(this);
        this.fileService = new FileService(this);
        this.commandRegistry = new CommandRegistry(this);
        this.eventHandlers = new EventHandlers(this);
        
        const constructEnd = performance.now();
        this.logger.info(`Plugin construction completed in ${constructEnd - constructStart}ms`);
    }

    async onload() {
        const loadStart = performance.now();
        this.logger.info("=== NEXUS AI CHAT IMPORTER - ONLOAD START ===");
        
        try {
            // Step 1: Load settings and data
            const settingsStart = performance.now();
            await this.loadSettings();
            const settingsEnd = performance.now();
            this.logger.info(`Settings loaded in ${settingsEnd - settingsStart}ms`);
            
            // Step 2: Initialize UI
            const uiStart = performance.now();
            this.addSettingTab(new NexusAiChatImporterPluginSettingTab(this.app, this));
            const uiEnd = performance.now();
            this.logger.info(`Settings tab initialized in ${uiEnd - uiStart}ms`);
            
            // Step 3: Register commands
            const commandsStart = performance.now();
            this.commandRegistry.registerCommands();
            const commandsEnd = performance.now();
            this.logger.info(`Commands registered in ${commandsEnd - commandsStart}ms`);
            
            // Step 4: Register events
            const eventsStart = performance.now();
            this.eventHandlers.registerEvents();
            const eventsEnd = performance.now();
            this.logger.info(`Events registered in ${eventsEnd - eventsStart}ms`);
            
            // Step 5: Add ribbon icon
            const ribbonStart = performance.now();
            const ribbonIconEl = this.addRibbonIcon(
                "message-square-plus",
                "Nexus AI Chat Importer - Import new file",
                () => this.importService.selectZipFile()
            );
            ribbonIconEl.addClass("nexus-ai-chat-ribbon");
            const ribbonEnd = performance.now();
            this.logger.info(`Ribbon icon added in ${ribbonEnd - ribbonStart}ms`);
            
            // Step 6: Check for upgrades (potentially slow)
            const upgradeStart = performance.now();
            const upgrader = new Upgrader(this);
            await upgrader.checkForUpgrade();
            const upgradeEnd = performance.now();
            this.logger.info(`Upgrade check completed in ${upgradeEnd - upgradeStart}ms`);
            
            const loadEnd = performance.now();
            this.logger.info(`=== PLUGIN LOADED SUCCESSFULLY in ${loadEnd - loadStart}ms ===`);
            
        } catch (error) {
            const loadEnd = performance.now();
            this.logger.error(`Plugin loading failed after ${loadEnd - loadStart}ms:`, error);
            throw error;
        }
    }

    async onunload() {
        const unloadStart = performance.now();
        this.logger.info("=== NEXUS AI CHAT IMPORTER - ONUNLOAD START ===");
        
        try {
            // Step 1: Cleanup events
            const eventsStart = performance.now();
            this.eventHandlers.cleanup();
            const eventsEnd = performance.now();
            this.logger.info(`Events cleanup completed in ${eventsEnd - eventsStart}ms`);
            
            // Step 2: Save settings
            const settingsStart = performance.now();
            await this.saveSettings();
            const settingsEnd = performance.now();
            this.logger.info(`Settings saved in ${settingsEnd - settingsStart}ms`);
            
            const unloadEnd = performance.now();
            this.logger.info(`=== PLUGIN UNLOADED in ${unloadEnd - unloadStart}ms ===`);
            
        } catch (error) {
            const unloadEnd = performance.now();
            this.logger.error(`Plugin unloading failed after ${unloadEnd - unloadStart}ms:`, error);
        }
    }

    async loadSettings() {
        const loadStart = performance.now();
        
        try {
            // Step 1: Load raw data
            const dataStart = performance.now();
            const data = await this.loadData();
            const dataEnd = performance.now();
            this.logger.info(`Raw data loaded in ${dataEnd - dataStart}ms`);
            
            // Step 2: Process settings
            const settingsStart = performance.now();
            this.settings = Object.assign({}, DEFAULT_SETTINGS, data?.settings || {});
            const settingsEnd = performance.now();
            this.logger.info(`Settings processed in ${settingsEnd - settingsStart}ms`);
            
            // Step 3: Load catalogs (potentially slow with 4000+ conversations)
            const catalogStart = performance.now();
            this.storageService.loadCatalogs(data);
            const catalogEnd = performance.now();
            
            // // Get detailed stats
            // const stats = this.storageService.getStats();
            // this.logger.info(`Catalogs loaded in ${catalogEnd - catalogStart}ms - Stats:`, stats);
            
            // const loadEnd = performance.now();
            // this.logger.info(`Total loadSettings completed in ${loadEnd - loadStart}ms`);
            
        } catch (error) {
            const loadEnd = performance.now();
            this.logger.error(`loadSettings failed after ${loadEnd - loadStart}ms:`, error);
            throw error;
        }
    }

    async saveSettings() {
        const saveStart = performance.now();
        
        try {
            // Get current stats before saving
            //const stats = this.storageService.getStats();
            //this.logger.info(`Saving settings with stats:`, stats);
            
            await this.storageService.saveData({
                settings: this.settings,
                importedArchives: this.storageService.getImportedArchives(),
                conversationCatalog: this.storageService.getConversationCatalog()
            });
            
            const saveEnd = performance.now();
            this.logger.info(`Settings saved in ${saveEnd - saveStart}ms`);
            
        } catch (error) {
            const saveEnd = performance.now();
            this.logger.error(`saveSettings failed after ${saveEnd - saveStart}ms:`, error);
            throw error;
        }
    }

    async resetCatalogs() {
        const resetStart = performance.now();
        this.logger.info("=== RESET CATALOGS START ===");
        
        try {
            await this.storageService.resetCatalogs();
            await this.loadSettings();
            
            const resetEnd = performance.now();
            this.logger.info(`=== RESET CATALOGS COMPLETED in ${resetEnd - resetStart}ms ===`);
            
        } catch (error) {
            const resetEnd = performance.now();
            this.logger.error(`resetCatalogs failed after ${resetEnd - resetStart}ms:`, error);
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