// Imports
import {
    Plugin,
    PluginSettingTab,
    Setting,
    TFile,
    TFolder,
    Modal,
    Notice,
    App,
    PluginManifest,
    MarkdownView
} from "obsidian";

import JSZip from "jszip";

import {
    PluginSettings,
    ChatMessage,
    Chat,
    ConversationCatalogEntry,
    CustomError,
    ConfirmationDialogOptions
} from "./types";

import {
    formatTimestamp,
    formatTitle,
    isValidMessage,
    isCustomError,
    generateFileName,
    generateUniqueFileName,
    getFileHash,
    ensureFolderExists,
    doesFilePathExist,
    getConversationId,
    checkAnyNexusFilesActive,
    getProvider
} from "./utils";

// Constants
const DEFAULT_SETTINGS: PluginSettings = {
    archiveFolder: "Nexus AI Chat Imports",
    addDatePrefix: false,
    dateFormat: "YYYY-MM-DD",
};

enum LogLevel {
    INFO,
    WARN,
    ERROR,
}

class Logger {
    private logToConsole(level: LogLevel, message: string, details?: any) {
        const timestamp = new Date().toISOString();
        const logMethod =
            level === LogLevel.ERROR
                ? console.error
                : level === LogLevel.WARN
                ? console.warn
                : console.log;

        logMethod(
            `[${timestamp}] [ChatGPT Import] [${LogLevel[level]}] ${message}`,
            details
        );
    }

    info(message: string, details?: any) {
        this.logToConsole(LogLevel.INFO, message, details);
    }

    warn(message: string, details?: any) {
        this.logToConsole(LogLevel.WARN, message, details);
    }

    error(message: string, details?: any) {
        this.logToConsole(LogLevel.ERROR, message, details);
    }
}

export default class NexusAiChatImporterPlugin extends Plugin {
    clickListenerActive: boolean;
    constructor(app: App, manifest: PluginManifest) {
        super(app, manifest);
        this.conversationCatalog = {}; // Initialise le catalogue des conversations
        this.settings = {
            archiveFolder: "default-folder",
            addDatePrefix: false,
            dateFormat: "YYYY-MM-DD",
        }; // Initialize with default values
    }

    // Properties
    settings: PluginSettings; // Assuming this will be initialized based on user settings
    logger: Logger = new Logger(); // Initialize logger with a new instance
    private importReport: ImportReport = new ImportReport(); // Initialize import report
    private importedArchives: Record<
        string,
        { fileName: string; date: string }
    > = {}; // Stores imported archives
    private conversationCatalog: Record<string, ConversationCatalogEntry> = {}; // Stores conversation entries

    /**
     * Plugin counters
     */
    totalExistingConversations: number = Object.keys(this.conversationCatalog).length;

    /**
     * Selected file conversation counters
     */
    totalNewConversationsToImport: number = 0; // Counts the number of conversations which do not have any existing note in obsidian
    totalExistingConversationsToUpdate: number = 0; // Counts the number of conversations that need to be updated
    totalNewConversationsSuccessfullyImported: number = 0; //Counts the number of conversations that have been created successully
    totalConversationsActuallyUpdated: number = 0; // Counts the number of conversations that have been updated succcessfully

    // Message counters
    totalNonEmptyMessagesToImport: number = 0; // Counts the number of non-empty messages that will need to be imported: We want to avoid importing empty messages
    totalNonEmptyMessagesToAdd: number = 0; // Counts the number of messages that will have to be added to an existing note
    totalNonEmptyMessagesAdded: number = 0; // Counts the number of messages that have actually been added to a specific note

    private tooltipEl: HTMLDivElement;

    // Lifecycle methods
    async onload() {
        // Bind the handleClick method to the current context and store it
        this.handleClickBound = this.handleClick.bind(this);
    
        // Initialize the logger
        this.logger = new Logger();
    
        // Load the plugin settings
        await this.loadSettings();
    
        // Add the plugin's settings tab to Obsidian's settings
        this.addSettingTab(new NexusAiChatImporterPluginSettingTab(this.app, this));
    
        // Add a ribbon icon to the sidebar with a click event to import a new file
        const ribbonIconEl = this.addRibbonIcon(
            "message-square-plus",
            "Nexus AI Chat Importer - Import new file",
            (evt: MouseEvent) => {
                this.selectZipFile();
            }
        );

        ribbonIconEl.addClass("nexus-ai-chat-ribbon");
    
        // Register an event to handle file deletion
        this.registerEvent(
            this.app.vault.on("delete", async (file) => {
                console.log("File has been deleted: ", file);
                if (file instanceof TFile) {
                    const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
                    if (frontmatter?.conversation_id) {
                        for (const [id, record] of Object.entries(this.conversationCatalog)) {
                            if (record.conversationId === frontmatter.conversation_id) {
                                delete this.conversationCatalog[id];
                                await this.saveSettings();
                                break;
                            }
                        }
                    }
                }
            })
        );

        // Register an event to track changes in the active file
        this.registerEvent(
            this.app.workspace.on("active-leaf-change", (leaf) => {
                const file = this.app.workspace.getActiveFile();
                if (file instanceof TFile) {
                    this.initializeListenerIfNeeded(file);
                }
            })
        );
    
        // Register an event to track file closures
        this.registerEvent(
            this.app.workspace.on("file-close", (file) => {
                this.fileClosed(file);
            })
        );
    
        // Register a command to select a ZIP file for processing
        this.addCommand({
            id: "nexus-ai-chat-importer-select-zip",
            name: "Select ZIP file to process",
            callback: () => {
                this.selectZipFile();
            },
        });
    
        // Register a command to reset the import catalogs
        this.addCommand({
            id: "reset-nexus-ai-chat-importer-catalogs",
            name: "Reset Catalogs",
            callback: () => {
                const modal = new Modal(this.app);
                modal.contentEl.createEl("p", {
                    text: "This will reset all import catalogs. This action cannot be undone.",
                });
                const buttonDiv = modal.contentEl.createEl("div", {
                    cls: "modal-button-container",
                });
                buttonDiv
                    .createEl("button", { text: "Cancel" })
                    .addEventListener("click", () => modal.close());
                buttonDiv
                    .createEl("button", { text: "Reset", cls: "mod-warning" })
                    .addEventListener("click", () => {
                        this.resetCatalogs();
                        modal.close();
                    });
                modal.open();
            },
        });
    
        console.log("NexusAiChatImporterPlugin loaded.");
    }
    
    
    async loadSettings() {
        const data = await this.loadData();
        this.settings = Object.assign(
            {},
            DEFAULT_SETTINGS,
            data?.settings || {}
        );
        this.importedArchives = data?.importedArchives || {};
        this.conversationCatalog = data?.conversationCatalog || {};
    }
    async saveSettings() {
        await this.saveData({
            settings: this.settings,
            importedArchives: this.importedArchives,
            conversationCatalog: this.conversationCatalog,
        });
    }

    async onload() {
        // Bind the handleClick method to the current context and store it
        this.handleClickBound = this.handleClick.bind(this);
    
        // Initialize the logger
        this.logger = new Logger();
    
        // Load the plugin settings
        await this.loadSettings();
    
        // Add the plugin's settings tab to Obsidian's settings
        this.addSettingTab(new NexusAiChatImporterPluginSettingTab(this.app, this));
    
        // Add a ribbon icon to the sidebar with a click event to import a new file
        const ribbonIconEl = this.addRibbonIcon(
            "message-square-plus",
            "Nexus AI Chat Importer - Import new file",
            (evt: MouseEvent) => {
                this.selectZipFile();
            }
        );
        ribbonIconEl.addClass("nexus-ai-chat-ribbon");
    
        // Register an event to handle file deletion
        this.registerEvent(
            this.app.vault.on("delete", async (file) => {
                console.log("File has been deleted: ", file);
                if (file instanceof TFile) {
                    const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
                    if (frontmatter?.conversation_id) {
                        for (const [id, record] of Object.entries(this.conversationCatalog)) {
                            if (record.conversationId === frontmatter.conversation_id) {
                                delete this.conversationCatalog[id];
                                await this.saveSettings();
                                break;
                            }
                        }
                    }
                }
            })
        );
    
        // Register an event to track changes in the active file
        this.registerEvent(
            this.app.workspace.on("active-leaf-change", (leaf) => {
                const file = this.app.workspace.getActiveFile();
                if (file instanceof TFile) {
                    this.initializeListenerIfNeeded(file);
                }
            })
        );
    
        // Register an event to track file closures
        this.registerEvent(
            this.app.workspace.on("file-close", (file) => {
                this.fileClosed(file);
            })
        );
    
        // Register a command to select a ZIP file for processing
        this.addCommand({
            id: "nexus-ai-chat-importer-select-zip",
            name: "Select ZIP file to process",
            callback: () => {
                this.selectZipFile();
            },
        });
    
        // Register a command to reset the import catalogs
        this.addCommand({
            id: "reset-nexus-ai-chat-importer-catalogs",
            name: "Reset Nexus AI Chat Importer Catalogs",
            callback: () => {
                const modal = new Modal(this.app);
                modal.contentEl.createEl("p", {
                    text: "This will reset all import catalogs. This action cannot be undone.",
                });
                const buttonDiv = modal.contentEl.createEl("div", {
                    cls: "modal-button-container",
                });
                buttonDiv
                    .createEl("button", { text: "Cancel" })
                    .addEventListener("click", () => modal.close());
                buttonDiv
                    .createEl("button", { text: "Reset", cls: "mod-warning" })
                    .addEventListener("click", () => {
                        this.resetCatalogs();
                        modal.close();
                    });
                modal.open();
            },
        });
    
        console.log("NexusAiChatImporterPlugin loaded.");
    }
    

    // Initialize or remove click listener based on file relevance
    initializeListenerIfNeeded(file: TFile) {
        const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
        const isNexusRelated = frontmatter && frontmatter.nexus;

        if (isNexusRelated && !this.clickListenerActive) {
            this.addClickListener();
        } else if (!isNexusRelated && this.clickListenerActive) {
            this.removeClickListenerIfNotNeeded();
        }
    }

    // Add click listener if not already active
    addClickListener() {
        if (!this.clickListenerActive) {
            // Add click event listener
            document.addEventListener('click', this.handleClickBound);
            this.clickListenerActive = true;
            console.log('Click listener activated.');
        }
    }

    // Remove click listener if no nexus-related files are active
    removeClickListenerIfNotNeeded() {
        const anyNexusFilesActive = checkAnyNexusFilesActive(this.app);
        if (!anyNexusFilesActive && this.clickListenerActive) {
            document.removeEventListener('click', this.handleClickBound);
            this.clickListenerActive = false;
            console.log('Click listener deactivated.');
        }
    }

    // Triggered when a file is closed
    fileClosed(file: TFile) {
        if (file && this.clickListenerActive) {
            this.removeClickListenerIfNotNeeded();
        }
    }

    async handleClick(event: { target: any; }) {
        const target = event.target;
    
        // Check if the click is within the active editor
        const editorContainer = this.app.workspace.getActiveViewOfType(MarkdownView)?.editor.containerEl;
        if (!editorContainer || !editorContainer.contains(target)) {
            return; // Exit if not inside the active editor
        }
    
        // Check for active file
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            return; // Exit if there is no active file
        }
    
        // Check if the click is specifically on the inline-title class
        if (target.classList.contains('inline-title')) {
    
            // Fetch the abstract file to check if it's a TFile
            const file = this.app.vault.getAbstractFileByPath(activeFile.path);
            if (file instanceof TFile) {
                // Fetch the conversation ID using the utility function
    
                const conversationId = getConversationId(file); // Use the utility function

                if (conversationId) {
                    const provider = getProvider(activeFile);
                    if (provider === "chatgpt") {
                        const url = `https://chatgpt.com/c/${conversationId}`;
                
                        const userConfirmed = await this.showUrlConfirmationDialog({
                            url: url, // Correctly setting the URL
                            message: "Do you want to go there?", // Optional message
                            note: "If the conversation has been deleted, it will not show." // Optional note
                        });
                
                        if (userConfirmed) {
                            window.open(url, "_blank"); // Open the URL in a new tab or window
                        }
                    }
                }
    
            } else {
                console.log('File is not an instance of TFile. Exiting...');
            }
        } else {
            console.log('Click is not on inline-title. Exiting...');
        }
    }

    async showUrlConfirmationDialog(options: ConfirmationDialogOptions): Promise<boolean> {
        return new Promise((resolve) => {
            const modal = new Modal(this.app);
            modal.contentEl.createEl("p", { text: `Original conversation URL: ${options.url}` });
            
            const message = options.message || "Do you want to go there?";
            const note = options.note || "If the conversation has been deleted, it will not show.";
            
            modal.contentEl.createEl("p", { text: message });
            modal.contentEl.createEl("p", { text: note });
    
            const buttonDiv = modal.contentEl.createEl("div", {
                cls: "modal-button-container"
            });
            
            buttonDiv.createEl("button", { text: "Yes" })
                .addEventListener("click", () => {
                    modal.close();
                    resolve(true); // User confirmed
                });
    
            buttonDiv.createEl("button", { text: "No" })
                .addEventListener("click", () => {
                    modal.close();
                    resolve(false); // User canceled
                });
    
            modal.open();
        });
    }
    

    // Core functionality methods
    async handleZipFile(file: File) {
        this.importReport = new ImportReport(); // Initialize the import log at the beginning
        try {
            const fileHash = await getFileHash(file);

            // Check if the archive has already been imported
            if (this.importedArchives[fileHash]) {
                const shouldReimport = await this.showConfirmationDialog(
                    `This archive (${file.name}) has already been imported on ${this.importedArchives[fileHash].date}. Do you want to process it again?`
                );

                // If the user cancels re-importing
                if (!shouldReimport) {
                    this.logger.info("Import cancelled by user", {
                        fileName: file.name,
                    });
                    new Notice("Import cancelled.");
                    return; // Exit early if not re-importing
                }
            }

            const zip = await this.validateZipFile(file); // Validate the ZIP file
            await this.processConversations(zip, file); // Process the conversations in the ZIP

            // Update imported archives with the new entry
            this.importedArchives[fileHash] = {
                fileName: file.name,
                date: new Date().toISOString(),
            };

            await this.saveSettings(); // Save the updated settings
            this.logger.info("Import completed successfully", {
                fileName: file.name,
            });
        } catch (error: unknown) {
            // Handle errors
            const message = isCustomError(error)
                ? error.message
                : error instanceof Error
                ? error.message
                : "An unknown error occurred";

            this.logger.error("Error handling zip file", { message });
        } finally {
            // This will always run, even if there's an error
            await this.writeImportReport(file.name);
            new Notice(
                this.importReport.hasErrors()
                    ? "An error occurred during import. Please check the log file for details."
                    : "Import completed. Log file created in the archive folder."
            );
        }
    }

    async processConversations(zip: JSZip, file: File): Promise<void> {
        try {
            const chats = await this.extractChatsFromZip(zip);
            this.logger.info(`Extracted ${chats.length} chats from zip file`, {
                fileName: file.name,
            });
            const existingConversations = this.conversationCatalog;


            for (const chat of chats) {
                await this.processSingleChat(chat, existingConversations);
            }

            this.updateImportReport(file.name);

            this.logger.info(`Processed ${chats.length} conversations`, {
                new: this.totalNewConversationsSuccessfullyImported,
                updated: this.totalConversationsActuallyUpdated,
                skipped:
                    this.totalExistingConversations -
                    this.totalConversationsActuallyUpdated,
            });

        } catch (error: CustomError) {
            this.logger.error("Error processing conversations", error.message);
        }
    }

    async updateExistingNote(
        chat: Chat,
        filePath: string,
        totalMessageCount: number
    ): Promise<void> {
        try {
            const file = this.app.vault.getAbstractFileByPath(filePath);
            if (file instanceof TFile) {
                let content = await this.app.vault.read(file);
                let originalContent = content;

                content = this.updateMetadata(content, chat.update_time);

                const existingMessageIds =
                    this.extractMessageUIDsFromNote(content);
                const newMessages = this.getNewMessages(
                    chat,
                    existingMessageIds
                );

                if (newMessages.length > 0) {
                    content += "\n\n" + this.formatNewMessages(newMessages);
                    this.totalConversationsActuallyUpdated++;
                    this.totalNonEmptyMessagesAdded += newMessages.length;
                }

                if (content !== originalContent) {
                    await this.writeToFile(filePath, content);
                    this.importReport.addUpdated(
                        chat.title || "Untitled",
                        filePath,
                        `${formatTimestamp(
                            chat.create_time,
                            "date"
                        )} ${formatTimestamp(chat.create_time, "time")}`,
                        `${formatTimestamp(
                            chat.update_time,
                            "date"
                        )} ${formatTimestamp(chat.update_time, "time")}`,
                        totalMessageCount
                    );
                } else {
                    this.importReport.addSkipped(
                        chat.title || "Untitled",
                        filePath,
                        `${formatTimestamp(
                            chat.create_time,
                            "date"
                        )} ${formatTimestamp(chat.create_time, "time")}`,
                        `${formatTimestamp(
                            chat.update_time,
                            "date"
                        )} ${formatTimestamp(chat.update_time, "time")}`,
                        totalMessageCount,
                        "No changes needed"
                    );
                }
            }
        } catch (error: unknown) {
            // Error handling logic
            if (isCustomError(error)) { // Check if it's a CustomError
                this.logger.error("Error updating note", error.message);
            } else if (error instanceof Error) {
                this.logger.error("General error updating note", error.message);
            } else {
                this.logger.error("Unknown error updating note", "An unknown error occurred");
            }
        }
        
    }

    private async createNewNote(
        chat: Chat,
        filePath: string,
        existingConversations: Record<string, ConversationCatalogEntry> // Change this line
    ): Promise<void> {
        try {
            const content = this.generateMarkdownContent(chat);
            await this.writeToFile(filePath, content);

            const messageCount = Object.values(chat.mapping).filter((msg) =>
                isValidMessage(msg.message)
            ).length;

            this.importReport.addCreated(
                chat.title || "Untitled",
                filePath,
                `${formatTimestamp(chat.create_time, "date")} ${formatTimestamp(
                    chat.create_time,
                    "time"
                )}`,
                `${formatTimestamp(chat.update_time, "date")} ${formatTimestamp(
                    chat.update_time,
                    "time"
                )}`,
                messageCount
            );
            this.totalNewConversationsSuccessfullyImported++;
            this.totalNonEmptyMessagesToImport += messageCount;

            // Add the new conversation to existingConversations
            existingConversations[chat.id] = filePath;
        } catch (error: CustomError) {
            this.logger.error("Error creating new note", error.message);
            this.importReport.addFailed(
                chat.title || "Untitled",
                filePath,
                formatTimestamp(chat.create_time, "date") +
                    " " +
                    formatTimestamp(chat.create_time, "time"),
                formatTimestamp(chat.update_time, "date") +
                    " " +
                    formatTimestamp(chat.update_time, "time"),
                error.message
            );
            throw error;
        }
    }

    // Helper methods
    private async extractChatsFromZip(zip: JSZip): Promise<Chat[]> {
        const conversationsJson = await zip
            .file("conversations.json")
            .async("string");
        return JSON.parse(conversationsJson);
    }

    private async generateFilePath(
        title: string, 
        createdTime: number, 
        prefixFormat: string,
        archivePath: string

    ) {
        const date = new Date(createdTime * 1000);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");

        const folderPath = `${archivePath}/${year}/${month}`;
        const folderResult = await ensureFolderExists(folderPath, this.app.vault);
        if (!folderResult.success) {
            throw new Error(folderResult.error || "Failed to ensure folder exists."); // Handle the error appropriately
        }

        let fileName = generateFileName(title) + '.md';
        
        if (this.settings.addDatePrefix) {
            const day = String(date.getDate()).padStart(2, "0");
        
            // Create the prefix based on the specified format
            let prefix = '';
            if (prefixFormat === "YYYY-MM-DD") {
                prefix = `${year}-${month}-${day}`;
            } else if (prefixFormat === "YYYYMMDD") {
                prefix = `${year}${month}${day}`;
            }
        
            // Add the prefix to the filename
            fileName = `${prefix} - ${fileName}`;
        }

        let filePath = `${folderPath}/${fileName}`

        if (await doesFilePathExist(filePath, this.app.vault)) {
            // If the file path exists, generate a unique filename
            filePath = await generateUniqueFileName(filePath, this.app.vault.adapter);
//            filePath = `${folderPath}/${fileName}`; // Update filePath after generating unique filename
        }

        return filePath;

    }

    private async processSingleChat(chat: Chat, existingConversations: Record<string, ConversationCatalogEntry>): Promise<void> {
        try {

            // Check if the conversation already exists
            if (existingConversations[chat.id]) {
                await this.handleExistingChat(
                    chat,
                    existingConversations[chat.id] // Pass the full ConversationCatalogEntry object
                );
            } else {
                // Check if the file needs to be made unique
                const filePath = await this.generateFilePath(chat.title,chat.create_time, this.settings.dateFormat, this.settings.archiveFolder)
                await this.handleNewChat(chat, filePath, existingConversations);
                this.updateConversationCatalogEntry(chat, filePath);
            }
        } catch (chatError) {
            console.error(`[processSingleChat] Error processing chat: ${chat.id}`, chatError);
            this.logger.error(`Error processing chat: ${chat.title || "Untitled"}`, chatError.message);
        }
    }
    
    private async handleExistingChat(
        chat: Chat,
        existingRecord: ConversationCatalogEntry
    ): Promise<void> {
        const totalMessageCount = Object.values(chat.mapping).filter((msg) =>
            isValidMessage(msg.message)
        ).length;

        if (existingRecord.updateTime >= chat.update_time) {
            this.importReport.addSkipped(
                chat.title || "Untitled",
                existingRecord.path,
                formatTimestamp(chat.create_time, "date"),
                formatTimestamp(chat.update_time, "date"),
                totalMessageCount,
                "No Updates"
            );
        } else {
            this.totalExistingConversationsToUpdate++;
            await this.updateExistingNote(
                chat,
                existingRecord.path,
                totalMessageCount
            );
        }
    }

    private async handleNewChat(
        chat: Chat,
        filePath: string,
        existingConversations: Record<string, ConversationCatalogEntry> // Change this line
    ): Promise<void> {
        this.totalNewConversationsToImport++;
        await this.createNewNote(chat, filePath, existingConversations);
    }

    private updateConversationCatalogEntry(chat: Chat, filePath: string): void {
        this.conversationCatalog[chat.id] = {
            conversationId: chat.id, // Add this line to include the conversation ID
            path: filePath, // Use the determined filePath directly
            updateTime: chat.update_time,
            provider: "chatgpt", // Default provider
        };
    }

    private updateImportReport(zipFileName: string): void {
        const totalExistingConversations = Object.keys(
            this.conversationCatalog
        ).length; // Calculate the count here

        this.importReport.addSummary(
            zipFileName,
            totalExistingConversations, // Use the calculated count directly
            this.totalNewConversationsSuccessfullyImported,
            this.totalConversationsActuallyUpdated,
            this.totalNonEmptyMessagesAdded
        );
    }

    updateMetadata(content: string, updateTime: number): string {
        const updateTimeStr = `${formatTimestamp(
            updateTime,
            "date"
        )} at ${formatTimestamp(updateTime, "time")}`;

        // Update parameters
        content = content.replace(
            /^update_time: .*$/m,
            `update_time: ${updateTimeStr}`
        );

        // Update header
        content = content.replace(
            /^Last Updated: .*$/m,
            `Last Updated: ${updateTimeStr}`
        );

        return content;
    }

    getNewMessages(chat: Chat, existingMessageIds: string[]): ChatMessage[] {
        return Object.values(chat.mapping)
            .filter(
                (message) =>
                    message &&
                    message.id &&
                    !existingMessageIds.includes(message.id) &&
                    isValidMessage(message.message)
            )
            .map((message) => message.message);
    }

    formatNewMessages(messages: ChatMessage[]): string {
        return messages
            .filter((message) => message !== undefined)
            .map((message) => this.formatMessage(message))
            .filter((formattedMessage) => formattedMessage !== "")
            .join("\n\n");
    }

    generateMarkdownContent(chat: any): string {
        const formattedTitle = formatTitle(chat.title);
        const create_time_str = `${formatTimestamp(
            chat.create_time,
            "date"
        )} at ${formatTimestamp(chat.create_time, "time")}`;
        const update_time_str = `${formatTimestamp(
            chat.update_time,
            "date"
        )} at ${formatTimestamp(chat.update_time, "time")}`;

        let content = this.generateHeader(
            formattedTitle,
            chat.id,
            create_time_str,
            update_time_str
        );
        content += this.generateMessagesContent(chat);

        return content;
    }

    generateHeader(
        title: string,
        conversationId: string,
        createTimeStr: string,
        updateTimeStr: string
    ) {
        return `---
nexus: ${this.manifest.id}
provider: chatgpt
aliases: "${title}"
conversation_id: ${conversationId}
create_time: ${createTimeStr}
update_time: ${updateTimeStr}
---

# Title: ${title}

Created: ${createTimeStr}
Last Updated: ${updateTimeStr}\n\n
`;
    }

    generateMessagesContent(chat: Chat) {
        let messagesContent = "";
        for (const messageId in chat.mapping) {
            const messageObj = chat.mapping[messageId];
            if (
                messageObj &&
                messageObj.message &&
                isValidMessage(messageObj.message)
            ) {
                messagesContent += this.formatMessage(messageObj.message);
            }
        }
        return messagesContent;
    }

    formatMessage(message: ChatMessage): string {
        if (!message || typeof message !== "object") {
            console.error("Invalid message object:", message);
            return ""; // Return empty string for invalid messages
        }

        const messageTime =
            formatTimestamp(message.create_time || Date.now() / 1000, "date") +
            " at " +
            formatTimestamp(message.create_time || Date.now() / 1000, "time");

        let authorName = "Unknown";
        if (
            message.author &&
            typeof message.author === "object" &&
            "role" in message.author
        ) {
            authorName = message.author.role === "user" ? "User" : "ChatGPT";
        } else {
            console.warn(
                "Author information missing or invalid:",
                message.author
            );
        }

        const headingLevel = authorName === "User" ? "###" : "####";
        const quoteChar = authorName === "User" ? ">" : ">>";

        let messageContent = `${headingLevel} ${authorName}, on ${messageTime};\n`;

        if (
            message.content &&
            typeof message.content === "object" &&
            Array.isArray(message.content.parts) &&
            message.content.parts.length > 0
        ) {
            const messageText = message.content.parts
                .filter((part) => typeof part === "string")
                .join("\n");
            messageContent += messageText
                .split("\n")
                .map((line) => `${quoteChar} ${line}`)
                .join("\n");
        } else {
            console.warn(
                "Message content missing or invalid:",
                message.content
            );
            messageContent += `${quoteChar} [No content]`;
        }

        messageContent += `\n<!-- UID: ${message.id || "unknown"} -->\n`;

        if (authorName === "ChatGPT") {
            messageContent += "\n---\n";
        }
        return messageContent + "\n\n";
    }

    async writeToFile(filePath: string, content: string): Promise<void> {
        try {
            const file = this.app.vault.getAbstractFileByPath(filePath); // Use filePath instead of fileName
    
            if (file instanceof TFile) {
                // Update existing file
                await this.app.vault.modify(file, content);
            } else if (file instanceof TFolder) {
                // Optional: Handle the case where the path is a folder
                throw new Error(`Cannot write to '${filePath}'; it is a folder.`);
            } else {
                // Create a new file
                await this.app.vault.create(filePath, content);
            }
        } catch (error: CustomError) {
            this.logger.error(`Error creating or modifying file '${filePath}'`, error.message);
            throw error; // Propagate the error
        }
    }

    extractMessageUIDsFromNote(content: string): string[] {
        const uidRegex = /<!-- UID: (.*?) -->/g;
        const uids = [];
        let match;
        while ((match = uidRegex.exec(content)) !== null) {
            uids.push(match[1]);
        }
        return uids;
    }

    async writeImportReport(zipFileName: string): Promise<void> {
        const now = new Date();
        let prefix = formatTimestamp(now.getTime() / 1000, "prefix");

        let logFileName = `${prefix} - Nexus AI Chat Chat Importer Report.md`;
        const logFolderPath = `${this.settings.archiveFolder}/Reports`;

        const folderResult = await ensureFolderExists(logFolderPath, this.app.vault);
        if (!folderResult.success) {
            this.logger.error(
                `Failed to create or access log folder: ${logFolderPath}`,
                folderResult.error
            );
            new Notice("Failed to create log file. Check console for details.");
            return;
        }

        let logFilePath = `${logFolderPath}/${logFileName}`;

        let counter = 1;
        while (await this.app.vault.adapter.exists(logFilePath)) {
            logFileName = `${prefix}-${counter} - Nexus AI Chat Chat Importer Report.md`;
            logFilePath = `${logFolderPath}/${logFileName}`;
            counter++;
        }

        const currentDate = `${formatTimestamp(
            now.getTime() / 1000,
            "date"
        )} ${formatTimestamp(now.getTime() / 1000, "time")}`;

        const logContent = `---
importdate: ${currentDate}
zipFile: ${zipFileName}
totalSuccessfulImports: ${this.importReport.created.length}
totalUpdatedImports: ${this.importReport.updated.length}
totalSkippedImports: ${this.importReport.skipped.length}
---

${this.importReport.generateReportContent()}
`;

        try {
            await this.writeToFile(logFilePath, logContent);
        } catch (error: CustomError) {
            this.logger.error(`Failed to write import log`, error.message);
            new Notice("Failed to create log file. Check console for details.");
        }
    }

    async resetCatalogs() {
        // Clear all internal data structures
        this.importedArchives = {};
        this.conversationCatalog = {};
        this.totalExistingConversations = 0;
        this.totalNewConversationsToImport = 0;
        this.totalNonEmptyMessagesToImport = 0;
        this.totalNonEmptyMessagesToAdd = 0;
        this.totalExistingConversationsToUpdate = 0;
        this.totalNewConversationsSuccessfullyImported = 0;
        this.totalConversationsActuallyUpdated = 0;
        this.totalNonEmptyMessagesAdded = 0;

        // Reset settings to default
        this.settings = Object.assign({}, DEFAULT_SETTINGS);

        // Clear the data file
        await this.saveData({});

        // Optionally, you can also delete the data.json file completely
        // Be careful with this as it might require additional error handling
        try {
            await this.app.vault.adapter.remove(
                `${this.manifest.dir}/data.json`
            );
        } catch (error: CustomError) {
            console.log(
                "No data.json file to remove or error removing it:",
                error
            );
        }

        // Reload the plugin to ensure a fresh start
        await this.loadSettings();

        new Notice(
            "All plugin data has been reset. You may need to restart Obsidian for changes to take full effect."
        );
        console.log("[Nexus AI Chat Importer] All plugin data has been reset.");
    }

    // Logging Methods
    private logError(message: string, details: string): void {
        this.logger.error(message, details);
        this.importReport.addError(message, details);
    }
    private logInfo(message: string, details?: any): void {
        this.logger.info(message, details);
    }
    private logWarn(message: string, details?: any): void {
        this.logger.warn(message, details);
    }

    // UI-related methods
    selectZipFile() {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".zip";
        input.onchange = (e) => {
            const file = e.target.files?.[0];
            if (file) {
                this.handleZipFile(file);
            }
        };
        // Reset the input value to allow selecting the same file again
        input.value = "";
        input.click();
    }
    async validateZipFile(file: File): Promise<JSZip> {
        try {
            const zip = new JSZip();
            const content = await zip.loadAsync(file);
            const fileNames = Object.keys(content.files);

            if (!fileNames.includes("conversations.json")) {
                throw new NexusAiChatImporterError(
                    "Invalid ZIP structure",
                    "File 'conversations.json' not found in the zip"
                );
            }

            return zip;
        } catch (error: CustomError) {
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
    showConfirmationDialog(message: string): Promise<boolean> {
        return new Promise((resolve) => {
            const modal = new Modal(this.app);
            modal.contentEl.createEl("p", { text: message });

            const buttonContainer = modal.contentEl.createDiv();

            buttonContainer
                .createEl("button", { text: "Yes" })
                .addEventListener("click", () => {
                    modal.close();
                    resolve(true);
                });

            buttonContainer
                .createEl("button", { text: "No" })
                .addEventListener("click", () => {
                    modal.close();
                    resolve(false);
                });

            modal.open();
        });
    }
}

class NexusAiChatImporterPluginSettingTab extends PluginSettingTab {
    // Settings tab implementation

    plugin: NexusAiChatImporterPlugin;

    constructor(app: App, plugin: NexusAiChatImporterPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        new Setting(containerEl)
            .setName("Nexus AI Chat Importer Folder")
            .setDesc("Choose a folder to store AI Chat conversations")
            .addText((text) =>
                text
                    .setPlaceholder("Enter folder name")
                    .setValue(this.plugin.settings.archiveFolder)
                    .onChange(async (value) => {
                        this.plugin.settings.archiveFolder = value;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("Add Date Prefix to Filenames")
            .setDesc("Add creation date as a prefix to conversation filenames")
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.addDatePrefix)
                    .onChange(async (value) => {
                        this.plugin.settings.addDatePrefix = value;
                        await this.plugin.saveSettings();
                        // Optionally refresh display logic could go here
                        this.display(); // Be careful of infinite loops here!
                    })
            );

        if (this.plugin.settings.addDatePrefix) {
            new Setting(containerEl)
                .setName("Date Format")
                .setDesc("Choose the format for the date prefix")
                .addDropdown(
                    (dropdown) =>
                        dropdown
                            .addOption("YYYY-MM-DD", "YYYY-MM-DD")
                            .addOption("YYYYMMDD", "YYYYMMDD")
                            .setValue(this.plugin.settings.dateFormat)
                            .onChange(async (value: string) => {
                                if (
                                    value === "YYYY-MM-DD" ||
                                    value === "YYYYMMDD"
                                ) {
                                    this.plugin.settings.dateFormat = value as
                                        | "YYYY-MM-DD"
                                        | "YYYYMMDD";
                                    await this.plugin.saveSettings();
                                } // Correct closure for the if statement
                            }) // Closing the arrow function correctly
                ); // Ensures proper closure of dropdown
        }
    }
}

class ImportReport {
    // Properties and methods
    private created: ReportEntry[] = [];
    private updated: ReportEntry[] = [];
    private skipped: ReportEntry[] = [];
    private failed: ReportEntry[] = [];
    private globalErrors: { message: string; details: string }[] = [];
    private summary: string = "";

    addParameters(currentDate: string, zipFileName: string): string {
        return `---
nexus: ${this.manifest.name}
importdate: ${currentDate}
zipFile: ${zipFileName}
totalSuccessfulImports: ${this.created.length}
totalUpdatedImports: ${this.updated.length}
totalSkippedImports: ${this.skipped.length}
---\n`;
    }

    addSummary(
        zipFileName: string,
        totalProcessed: number,
        totalCreated: number,
        totalUpdated: number,
        totalMessagesAdded: number
    ) {
        this.summary = `
## Summary
- Processed ZIP file: ${zipFileName}
- ${
            totalCreated > 0 ? `[[#Created notes]]` : "Created notes"
        }: ${totalCreated} out of ${totalProcessed} conversations
- ${
            totalUpdated > 0 ? `[[#Updated notes]]` : "Updated notes"
        }: ${totalUpdated} with a total of ${totalMessagesAdded} new messages
- ${this.skipped.length > 0 ? `[[#Skipped notes]]` : "Skipped notes"}: ${
            this.skipped.length
        } out of ${totalProcessed} conversations
- ${this.failed.length > 0 ? `[[#Failed imports]]` : "Failed imports"}: ${
            this.failed.length
        }
- ${
            this.globalErrors.length > 0
                ? `[[#global-errors|Global Errors]]`
                : "Global Errors"
        }: ${this.globalErrors.length}
`;
    }

    addCreated(
        title: string,
        filePath: string,
        createDate: string,
        updateDate: string,
        messageCount: number
    ) {
        this.created.push({
            title,
            filePath,
            createDate,
            updateDate,
            messageCount,
        });
    }

    addUpdated(
        title: string,
        filePath: string,
        createDate: string,
        updateDate: string,
        messageCount: number
    ) {
        this.updated.push({
            title,
            filePath,
            createDate,
            updateDate,
            messageCount,
        });
    }

    addSkipped(
        title: string,
        filePath: string,
        createDate: string,
        updateDate: string,
        messageCount: number,
        reason: string
    ) {
        this.skipped.push({
            title,
            filePath,
            createDate,
            updateDate,
            messageCount,
            reason,
        });
    }

    addFailed(
        title: string,
        filePath: string,
        createDate: string,
        updateDate: string,
        errorMessage: string
    ) {
        this.failed.push({
            title,
            filePath,
            createDate,
            updateDate,
            errorMessage,
        });
    }

    addError(message: string, details: string) {
        this.globalErrors.push({ message, details });
    }



    generateReportContent(): string {
        let content = "# Nexus AI Chat Importer Report\n\n";

        if (this.summary) {
            content += this.summary + "\n\n";
        }

        content += "## Legend\n";
        content +=
            "✨ Created | 🔄 Updated | ⏭️ Skipped | 🚫 Failed | ⚠️ Global Errors\n\n";

        if (this.created.length > 0) {
            content += this.generateTable("Created Notes", this.created, "✨", [
                "Title",
                "Created",
                "Updated",
                "Messages",
            ]);
        }
        if (this.updated.length > 0) {
            content += this.generateTable("Updated Notes", this.updated, "🔄", [
                "Title",
                "Created",
                "Updated",
                "Added Messages",
            ]);
        }
        if (this.skipped.length > 0) {
            content += this.generateTable("Skipped Notes", this.skipped, "⏭️", [
                "Title",
                "Created",
                "Updated",
                "Messages",
            ]);
        }
        if (this.failed.length > 0) {
            content += this.generateTable("Failed Imports", this.failed, "🚫", [
                "Title",
                "Created",
                "Updated",
                "Error",
            ]);
        }
        if (this.globalErrors.length > 0) {
            content += this.generateErrorTable(
                "Global Errors",
                this.globalErrors,
                "⚠️"
            );
        }

        return content;
    }

    private generateTable(
        title: string,
        entries: ReportEntry[],
        emoji: string,
        headers: string[]
    ): string {
        let table = `## ${title}\n\n`;
        table += "| " + headers.join(" | ") + " |\n";
        table += "|:---:".repeat(headers.length) + "|\n";
        entries.forEach((entry) => {
            const sanitizedTitle = entry.title.replace(/\n/g, " ").trim();
            const row = headers.map((header) => {
                switch (header) {
                    case "Title":
                        return `[[${entry.filePath}\\|${sanitizedTitle}]]`;
                    case "Created":
                        return entry.createDate || "-";
                    case "Updated":
                        return entry.updateDate || "-";
                    case "Messages":
                        return entry.messageCount?.toString() || "-";
                    case "Reason":
                        return entry.reason || "-";
                    default:
                        return "-";
                }
            });
            table += `| ${emoji} | ${row.join(" | ")} |\n`;
        });
        return table + "\n\n";
    }

    private generateErrorTable(
        title: string,
        entries: { message: string; details: string }[],
        emoji: string
    ): string {
        let table = `## ${title}\n\n`;
        table += "| | Error | Details |\n";
        table += "|---|:---|:---|\n";
        entries.forEach((entry) => {
            table += `| ${emoji} | ${entry.message} | ${entry.details} |\n`;
        });
        return table + "\n\n";
    }

    hasErrors(): boolean {
        return this.failed.length > 0 || this.globalErrors.length > 0;
    }
}

class NexusAiChatImporterError extends Error {
    // Implementation
    constructor(message: string, public details?: any) {
        super(message);
        this.name = "NexusAiChatImporterError";
    }
}
function removeClickListenerIfNotNeeded() {
    throw new Error("Function not implemented.");
}

