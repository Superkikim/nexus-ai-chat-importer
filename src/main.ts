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
    MarkdownView,
} from "obsidian";

import JSZip from "jszip";

import {
    PluginSettings,
    ChatMessage,
    Chat,
    ConversationCatalogEntry,
    CustomError,
    ConfirmationDialogOptions,
} from "./types";

import { formatTimestamp } from "./utils/date-utils";

import { Logger } from "./utils/logger";
import { showDialog } from "./components/dialogs";
import { Upgrader } from "./services/upgrader";
import { ImportReport } from "./models/import-report";
import { NexusAiChatImporterError } from "./models/nexus-ai-chat-importer-error";
import { checkAnyNexusFilesActive } from "./utils/activity-utils";
import { isCustomError, isValidMessage } from "./utils/validation-utils";
import {
    getConversationId,
    getProvider,
    isNexusRelated,
} from "./utils/metadata-utils";

import {
    ensureFolderExists,
    getFileHash,
    writeToFile,
    doesFilePathExist,
    generateUniqueFileName,
} from "./utils/file-utils";

import { generateFileName, formatTitle } from "./utils/string-utils";

// Constants
const DEFAULT_SETTINGS: PluginSettings = {
    archiveFolder: "Nexus AI Chat Imports",
    addDatePrefix: false,
    dateFormat: "YYYY-MM-DD",
    hasShownUpgradeNotice: false,
    hasCompletedUpgrade: false,
};

export default class NexusAiChatImporterPlugin extends Plugin {
    clickListenerActive: boolean;
    handleClickBound: (event: { target: any }) => Promise<void>;
    logger: Logger = new Logger();
    settings!: PluginSettings;
    private conversationCatalog: Record<string, ConversationCatalogEntry> = {};
    private importReport: ImportReport = new ImportReport(
        this.app,
        this.manifest
    );

    constructor(app: App, manifest: PluginManifest) {
        super(app, manifest);
        this.clickListenerActive = false; // Initialize other properties where needed
        this.handleClickBound = this.handleClick.bind(this); // Bind click handler

        // Now initialize importReport
        this.importReport = new ImportReport(app, manifest); // Pass the app and manifest
    }

    // Properties
    private importedArchives: Record<
        string,
        { fileName: string; date: string }
    > = {}; // Stores imported archives

    // Group Conversation Counters
    private conversationCounters = {
        totalExistingConversations: 0,
        totalNewConversationsToImport: 0,
        potentialUpdates: 0,
        totalNewConversationsSuccessfullyImported: 0,
        confirmedUpdates: 0,
        totalConversationsProcessed: 0,
    };

    // Group Message Counters
    private messageCounters = {
        totalNonEmptyMessagesToImport: 0,
        totalNonEmptyMessagesToAdd: 0,
        totalNonEmptyMessagesAdded: 0,
    };

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
        try {
            await this.saveData({
                settings: this.settings,
                importedArchives: this.importedArchives,
                conversationCatalog: this.conversationCatalog,
            });
        } catch (error) {
            this.logger.error("Error saving settings", error);
        }
    }

    async onload() {
        // Load the plugin settings
        await this.loadSettings();

        // Initialize the logger
        this.logger = new Logger();

        // Add the plugin's settings tab to Obsidian's settings
        this.addSettingTab(
            new NexusAiChatImporterPluginSettingTab(this.app, this)
        );

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
                if (file instanceof TFile) {
                    const frontmatter =
                        this.app.metadataCache.getFileCache(file)?.frontmatter;
                    if (frontmatter?.conversation_id) {
                        for (const [id, record] of Object.entries(
                            this.conversationCatalog
                        )) {
                            if (
                                record.conversationId ===
                                frontmatter.conversation_id
                            ) {
                                delete this.conversationCatalog[id];
                                await this.saveSettings();
                                break;
                            }
                        }
                    }
                }
            })
        );

        // Register an event to detect if active file is from this plugin or not
        this.registerEvent(
            this.app.workspace.on("active-leaf-change", (leaf) => {
                const file = this.app.workspace.getActiveFile();
                if (file instanceof TFile) {
                    // Use the isNexusRelated function
                    const isNexusRelatedFile = isNexusRelated(file, this.app); // Call the function
                    if (isNexusRelatedFile && !this.clickListenerActive) {
                        this.addClickListener();
                    } else if (
                        !isNexusRelatedFile &&
                        this.clickListenerActive
                    ) {
                        this.removeClickListenerIfNotNeeded();
                    }
                } else {
                    this.removeClickListenerIfNotNeeded();
                }
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
            name: "Reset catalogs",
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

        const upgrader = new Upgrader(this);
        await upgrader.checkForUpgrade();
    }

    async onunload() {
        // Remove the click listener if it's active
        if (this.clickListenerActive) {
            document.removeEventListener("click", this.handleClickBound);
            this.clickListenerActive = false;
        }

        // Save any unsaved settings
        await this.saveSettings();

        // Clear any runtime data that shouldn't persist
        this.conversationCounters.totalNewConversationsToImport = 0;
        this.conversationCounters.potentialUpdates = 0;
        this.conversationCounters.totalNewConversationsSuccessfullyImported = 0;
        this.conversationCounters.confirmedUpdates = 0;
        this.messageCounters.totalNonEmptyMessagesToImport = 0;
        this.messageCounters.totalNonEmptyMessagesToAdd = 0;
        this.messageCounters.totalNonEmptyMessagesAdded = 0;

        // Perform any other necessary cleanup
    }

    // Add click listener if not already active
    addClickListener() {
        if (!this.clickListenerActive) {
            // Add click event listener
            document.addEventListener("click", this.handleClickBound);
            this.clickListenerActive = true;
        }
    }

    // Remove click listener if no nexus-related files are active
    removeClickListenerIfNotNeeded() {
        const anyNexusFilesActive = checkAnyNexusFilesActive(this.app);
        if (!anyNexusFilesActive && this.clickListenerActive) {
            document.removeEventListener("click", this.handleClickBound);
            this.clickListenerActive = false;
        }
    }

    async handleClick(event: { target: any }) {
        const target = event.target;

        // Get the active Markdown view
        const markdownView =
            this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!markdownView) {
            return; // No active Markdown view
        }

        // Determine if we are in Reading View or Editor View
        const isEditorView = markdownView.getMode() === "source";
        const container = isEditorView
            ? markdownView.editor.containerEl
            : markdownView.contentEl;

        //        const container = isEditorView
        //            ? markdownView.editor.containerEl
        //            : markdownView.contentEl;

        // Exit if the click is outside the appropriate container
        if (!container.contains(target)) {
            return;
        }

        // Check for the active file
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            return; // Exit if there is no active file
        }

        // Check if the click is specifically on the inline-title class
        if (target.classList.contains("inline-title")) {
            // Fetch the abstract file
            const file = this.app.vault.getAbstractFileByPath(activeFile.path);
            if (file instanceof TFile) {
                // Fetch the conversation ID using the utility function
                const conversationId = getConversationId(file, this.app);
                if (conversationId) {
                    const provider = getProvider(activeFile, this.app);
                    if (provider === "chatgpt") {
                        const url = `https://chatgpt.com/c/${conversationId}`;
                        const conversationMessage = `Original conversation URL: ${url}\nDo you want to go there?\nIf the conversation has been deleted, it will not show.`;

                        const userConfirmed = await showDialog(
                            this.app, // Pass the app instance
                            "confirmation", // Type of dialog
                            "Open link", // Title
                            [
                                // Array of paragraphs
                                `Original conversation URL: ${url}.`,
                                `Do you want to go there?`,
                            ],
                            "NOTE: If the conversation has been deleted, it will not show.", // Optional note
                            { button1: "Let's go", button2: "No" } // Custom button labels
                        );

                        if (userConfirmed) {
                            window.open(url, "_blank"); // Open the URL in a new tab or window
                        }
                    }
                }
            }
        }
    }

    // Core functionality methods
    async handleZipFile(file: File) {
        this.importReport = new ImportReport(this.app, this.manifest); // Pass app and manifest

        // Resetting counters before processing a new ZIP file
        this.conversationCounters = {
            totalExistingConversations: Object.keys(this.conversationCatalog)
                .length,
            totalNewConversationsToImport: 0,
            potentialUpdates: 0,
            totalNewConversationsSuccessfullyImported: 0,
            confirmedUpdates: 0,
            totalConversationsProcessed: 0,
        };

        this.messageCounters = {
            totalNonEmptyMessagesToImport: 0,
            totalNonEmptyMessagesToAdd: 0,
            totalNonEmptyMessagesAdded: 0,
        };

        try {
            const fileHash = await getFileHash(file);

            // Check if the archive has already been imported
            if (this.importedArchives[fileHash]) {
                const shouldReimport = await showDialog(
                    this.app, // Pass the app instance
                    "confirmation", // Type of dialog
                    "Already processed", // Title
                    [
                        // Array of paragraphs
                        `File ${file.name} has already been imported.`,
                        `Do you want to reprocess it ?`,
                    ],
                    "NOTE: This will not alter existing notes", // Optional note
                    { button1: "Let's do this", button2: "Forget it" } // Custom button labels
                );

                // If the user cancels re-importing
                if (!shouldReimport) {
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
            await this.importReport.writeImportReport(file.name, this.settings); // Pass both parameters

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
            const existingConversations = this.conversationCatalog;

            for (const chat of chats) {
                await this.processSingleChat(chat, existingConversations);
            }

            this.updateImportReport(file.name);
        } catch (error: unknown) {
            if (isCustomError(error)) {
                this.logger.error(
                    "Error processing conversations",
                    error.message
                );
            } else if (error instanceof Error) {
                this.logger.error(
                    "General error processing conversations",
                    error.message
                );
            } else {
                this.logger.error(
                    "Unknown error processing conversations",
                    "An unknown error occurred"
                );
            }
        }
    }

    async updateExistingNote(
        chat: Chat,
        filePath: string,
        totalMessageCount: number
    ): Promise<void> {
        try {
            this.logger.info(`Attempting to update note at path: ${filePath}`);

            const file = this.app.vault.getAbstractFileByPath(filePath);
            if (file instanceof TFile) {
                this.logger.info(`Found file: ${filePath}. Reading content...`);

                let content = await this.app.vault.read(file);
                let originalContent = content;

                // Log raw timestamps
                this.logger.info(
                    `Raw create_time: ${chat.create_time}, update_time: ${chat.update_time}`
                );

                // Check if timestamps are valid; if not, set them to the current time
                const createTime =
                    chat.create_time || Math.floor(Date.now() / 1000);
                const updateTime =
                    chat.update_time || Math.floor(Date.now() / 1000);

                // Update metadata with new update_time
                content = this.updateMetadata(content, updateTime);
                this.logger.info(
                    `Updated metadata with new update time: ${updateTime}`
                );

                // Extract existing message IDs from the note
                const existingMessageIds =
                    this.extractMessageUIDsFromNote(content);
                this.logger.info(
                    `Extracted existing message IDs: ${existingMessageIds.join(
                        ", "
                    )}`
                );

                // Get new messages that are not already in the note
                const newMessages = this.getNewMessages(
                    chat,
                    existingMessageIds
                );
                this.logger.info(
                    `Retrieved new messages: ${newMessages.length} new messages found`
                );

                // Log the new messages for debugging
                if (newMessages.length > 0) {
                    this.logger.info(
                        `New message IDs: ${newMessages
                            .map((msg) => msg.id)
                            .join(", ")}`
                    );
                } else {
                    this.logger.info("No new messages to add.");
                }

                // Only add messages if there are new ones
                if (newMessages.length > 0) {
                    content += "\n\n" + this.formatNewMessages(newMessages);
                    this.logger.info(`Appending new messages to content.`);

                    // Increment counters for updates
                    this.conversationCounters.confirmedUpdates++;
                    this.messageCounters.totalNonEmptyMessagesAdded +=
                        newMessages.length;

                    // If content has changed, write it back to the file
                    if (content !== originalContent) {
                        this.logger.info(
                            `Content has changed. Writing updates back to file...`
                        );
                        await writeToFile(filePath, content, this.app);
                        // Record that the note was updated
                        this.importReport.addUpdated(
                            chat.title || "Untitled",
                            filePath,
                            `${formatTimestamp(
                                createTime,
                                "date"
                            )} ${formatTimestamp(createTime, "time")}`,
                            `${formatTimestamp(
                                updateTime,
                                "date"
                            )} ${formatTimestamp(updateTime, "time")}`,
                            totalMessageCount
                        );
                        this.logger.info(
                            `File updated successfully: ${filePath}`
                        );
                    } else {
                        this.logger.info(
                            "No changes were made to the content after the updates."
                        );
                        this.importReport.addSkipped(
                            chat.title || "Untitled",
                            filePath,
                            `${formatTimestamp(
                                createTime,
                                "date"
                            )} ${formatTimestamp(createTime, "time")}`,
                            `${formatTimestamp(
                                updateTime,
                                "date"
                            )} ${formatTimestamp(updateTime, "time")}`,
                            totalMessageCount,
                            "No changes needed"
                        );
                    }
                } else {
                    this.logger.info(
                        "No new messages found to add to the note."
                    );
                }
            } else {
                this.logger.warn(`No file found at path: ${filePath}`);
            }
        } catch (error: unknown) {
            // Error handling logic
            if (isCustomError(error)) {
                this.logger.error("Error updating note", error.message);
            } else if (error instanceof Error) {
                this.logger.error("General error updating note", error.message);
            } else {
                this.logger.error(
                    "Unknown error updating note",
                    "An unknown error occurred"
                );
            }
        }
    }

    private async createNewNote(
        chat: Chat,
        filePath: string,
        existingConversations: Record<string, ConversationCatalogEntry>
    ): Promise<void> {
        let messageCount = 0; // Declare messageCount here

        try {
            const content = this.generateMarkdownContent(chat);
            await writeToFile(filePath, content, this.app);

            messageCount = Object.values(chat.mapping).filter(
                (msg) => isValidMessage(msg as ChatMessage) // Type assertion for clarity
            ).length; // Assign valid message count

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

            this.conversationCounters
                .totalNewConversationsSuccessfullyImported++;
            this.messageCounters.totalNonEmptyMessagesToImport += messageCount;

            existingConversations[chat.id] = {
                conversationId: chat.id,
                path: filePath,
                updateTime: chat.update_time,
                provider: "chatgpt",
            };
        } catch (error: unknown) {
            let errorMessage = "Unknown error occurred";

            if (error instanceof Error) {
                this.logger.error("Error creating new note", error.message);
                errorMessage = error.message;
            } else {
                this.logger.error("Error creating new note", errorMessage);
            }

            this.importReport.addFailed(
                chat.title || "Untitled",
                filePath,
                formatTimestamp(chat.create_time, "date") +
                    " " +
                    formatTimestamp(chat.create_time, "time"),
                formatTimestamp(chat.update_time, "date") +
                    " " +
                    formatTimestamp(chat.update_time, "time"),
                errorMessage,
                messageCount // messageCount is now accessible here
            );
        }
    }

    // Helper methods
    private async extractChatsFromZip(zip: JSZip): Promise<Chat[]> {
        const conversationsFile = zip.file("conversations.json");

        if (!conversationsFile) {
            throw new Error(
                "The file 'conversations.json' was not found in the ZIP archive."
            ); // Handle the null case
        }

        const conversationsJson = await conversationsFile.async("string");
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
        const folderResult = await ensureFolderExists(
            folderPath,
            this.app.vault
        );
        if (!folderResult.success) {
            throw new Error(
                folderResult.error || "Failed to ensure folder exists."
            ); // Handle the error appropriately
        }

        let fileName = generateFileName(title) + ".md";

        if (this.settings.addDatePrefix) {
            const day = String(date.getDate()).padStart(2, "0");

            // Create the prefix based on the specified format
            let prefix = "";
            if (prefixFormat === "YYYY-MM-DD") {
                prefix = `${year}-${month}-${day}`;
            } else if (prefixFormat === "YYYYMMDD") {
                prefix = `${year}${month}${day}`;
            }

            // Add the prefix to the filename
            fileName = `${prefix} - ${fileName}`;
        }

        let filePath = `${folderPath}/${fileName}`;

        if (await doesFilePathExist(filePath, this.app.vault)) {
            // If the file path exists, generate a unique filename
            filePath = await generateUniqueFileName(
                filePath,
                this.app.vault.adapter
            );
            //            filePath = `${folderPath}/${fileName}`; // Update filePath after generating unique filename
        }

        return filePath;
    }

    private async processSingleChat(
        chat: Chat,
        existingConversations: Record<string, ConversationCatalogEntry>
    ): Promise<void> {
        try {
            // Check if the conversation already exists
            if (existingConversations[chat.id]) {
                await this.handleExistingChat(
                    chat,
                    existingConversations[chat.id] // Pass the full ConversationCatalogEntry object
                );
            } else {
                // Check if the file needs to be made unique
                const filePath = await this.generateFilePath(
                    chat.title,
                    chat.create_time,
                    this.settings.dateFormat,
                    this.settings.archiveFolder
                );
                await this.handleNewChat(chat, filePath, existingConversations);
                this.updateConversationCatalogEntry(chat, filePath);
            }
            this.conversationCounters.totalConversationsProcessed++;
        } catch (chatError: unknown) {
            const errorMessage =
                (chatError as Error).message || "Unknown error occurred";
            this.logErrorInReport(
                `Error processing chat: ${chat.title || "Untitled"}`,
                errorMessage
            );
        }
    }

    private async handleExistingChat(
        chat: Chat,
        existingRecord: ConversationCatalogEntry
    ): Promise<void> {
        const totalMessageCount = Object.values(chat.mapping).filter(
            (msg) => isValidMessage(msg.message as ChatMessage) // Ensure we use msg.message correctly
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
            this.conversationCounters.potentialUpdates++;
            await this.updateExistingNote(
                chat,
                existingRecord.path,
                totalMessageCount
            );
        }
    }

    async handleNewChat(
        chat: Chat,
        filePath: string,
        existingConversations: Record<string, ConversationCatalogEntry>
    ): Promise<void> {
        this.conversationCounters.totalNewConversationsToImport++;
        await this.createNewNote(chat, filePath, existingConversations);

        // Update existingConversations to reflect the correct structure
        existingConversations[chat.id] = {
            conversationId: chat.id,
            path: filePath,
            updateTime: chat.update_time,
            provider: "chatgpt", // Adjust as needed for your logic
        };
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
        ).length;

        this.importReport.addSummary(
            zipFileName,
            this.conversationCounters.totalConversationsProcessed,
            this.conversationCounters.totalNewConversationsSuccessfullyImported,
            this.conversationCounters.confirmedUpdates,
            this.messageCounters.totalNonEmptyMessagesAdded
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
            .filter((message) => isValidMessage(message as ChatMessage)) // Assert message type
            .map((message) => message as ChatMessage) // Map to ensure type consistency
            .filter((message) => !existingMessageIds.includes(message.id)); // You can also filter out existing IDs here
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
                messageObj.message && // Check this is present
                isValidMessage(messageObj.message as ChatMessage) // Ensure valid call
            ) {
                messagesContent += this.formatMessage(
                    messageObj.message as ChatMessage
                );
            }
        }
        return messagesContent;
    }

    formatMessage(message: ChatMessage): string {
        if (!message || typeof message !== "object") {
            this.logger.error("Invalid message object:", message);
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
            this.logger.warn(
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
            this.logger.warn(
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

    extractMessageUIDsFromNote(content: string): string[] {
        const uidRegex = /<!-- UID: (.*?) -->/g;
        const uids = [];
        let match;
        while ((match = uidRegex.exec(content)) !== null) {
            uids.push(match[1]);
        }
        return uids;
    }

    async resetCatalogs() {
        // Clear all internal data structures
        this.importedArchives = {};
        this.conversationCatalog = {};

        // Reset settings to default
        this.settings = Object.assign({}, DEFAULT_SETTINGS);

        // Clear the data file
        await this.saveData({});

        /*         // Optionally, you can also delete the data.json file completely
        // Be careful with this as it might require additional error handling
        try {
            await this.app.vault.adapter.remove(
                `${this.manifest.dir}/data.json`
            );
        } catch (error: CustomError) {
            this.logger.error(
                "No data.json file to remove or error removing it:",
                error
            );
        }
 */
        // Reload the plugin to ensure a fresh start
        await this.loadSettings();

        new Notice(
            "All plugin data has been reset. You may need to restart Obsidian for changes to take full effect."
        );
    }

    // Logging Methods
    private logErrorInReport(message: string, details: string): void {
        this.logger.error(message, details);
        this.importReport.addError(message, details);
    }

    // UI-related methods
    selectZipFile() {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".zip";
        input.multiple = true; // Allow multiple files
        input.onchange = async (e) => {
            const target = e.target as HTMLInputElement;
            if (target && target.files) {
                const files = Array.from(target.files); // Convert FileList to an array

                // Sort files by last modified date (descending order)
                files.sort((a, b) => {
                    return a.lastModified - b.lastModified; // Sort by last modified timestamp
                });

                // Process each file sequentially in sorted order
                for (const file of files) {
                    await this.handleZipFile(file); // Process each file
                }
            }
        };

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
                    "File 'conversations.json' not found in the zip file"
                );
            }

            return zip;
        } catch (error: unknown) {
            if (error instanceof NexusAiChatImporterError) {
                throw error;
            } else if (error instanceof Error) {
                // Add this type check
                throw new NexusAiChatImporterError(
                    "Error validating zip file",
                    error.message // Safely access message if error is indeed an Error
                );
            } else {
                throw new NexusAiChatImporterError(
                    "Error validating zip file",
                    "An unknown error occurred" // Fallback for when error is neither
                );
            }
        }
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
            .setName("Conversations folder")
            .setDesc(
                "Choose a folder to store ChatGPT conversations and import reports"
            )
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
            .setName("Add date prefix to filenames")
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
                .setName("Date format")
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

function removeClickListenerIfNotNeeded() {
    throw new Error("Function not implemented.");
}
