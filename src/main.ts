// src/main.ts
import { Plugin, App, PluginManifest } from "obsidian";
import { DEFAULT_SETTINGS } from "./config/constants";
import { PluginSettings } from "./types";
import { NexusAiChatImporterPluginSettingTab } from "./ui/settings-tab";
import { CommandRegistry } from "./commands/command-registry";
import { EventHandlers } from "./events/event-handlers";
import { ImportService } from "./services/import-service";
import { StorageService } from "./services/storage-service";
import { Upgrader } from "./upgrade";
import { Logger } from "./logger";

export default class NexusAiChatImporterPlugin extends Plugin {
    settings: PluginSettings;
    logger: Logger = new Logger();
    
    private storageService: StorageService;
    private importService: ImportService;
    private commandRegistry: CommandRegistry;
    private eventHandlers: EventHandlers;

    constructor(app: App, manifest: PluginManifest) {
        super(app, manifest);
        this.storageService = new StorageService(this);
        this.importService = new ImportService(this);
        this.commandRegistry = new CommandRegistry(this);
        this.eventHandlers = new EventHandlers(this);
    }

    async onload() {
        await this.loadSettings();
        
        // Initialize services
        this.addSettingTab(new NexusAiChatImporterPluginSettingTab(this.app, this));
        
        // Register commands and events
        this.commandRegistry.registerCommands();
        this.eventHandlers.registerEvents();
        
        // Add ribbon icon
        const ribbonIconEl = this.addRibbonIcon(
            "message-square-plus",
            "Nexus AI Chat Importer - Import new file",
            () => this.importService.selectZipFile()
        );
        ribbonIconEl.addClass("nexus-ai-chat-ribbon");

        // Check for upgrades
        const upgrader = new Upgrader(this);
        await upgrader.checkForUpgrade();
    }

    async onunload() {
        this.eventHandlers.cleanup();
        await this.saveSettings();
    }

    async loadSettings() {
        const data = await this.loadData();
        this.settings = Object.assign({}, DEFAULT_SETTINGS, data?.settings || {});
        this.storageService.loadCatalogs(data);
    }

    async saveSettings() {
        await this.storageService.saveData({
            settings: this.settings,
            importedArchives: this.storageService.getImportedArchives(),
            conversationCatalog: this.storageService.getConversationCatalog()
        });
    }

    async resetCatalogs() {
        await this.storageService.resetCatalogs();
        await this.loadSettings();
    }

    getStorageService(): StorageService {
        return this.storageService;
    }

    getImportService(): ImportService {
        return this.importService;
    }
}