import { App, TAbstractFile, TFile } from "obsidian"; // Import necessary types from Obsidian API
import { CatalogEntry } from "../types"; // Import the CatalogEntry type
import { CatalogModel } from "../models/CatalogModel"; // Import the CatalogModel class

/**
 * Manages the catalog of conversation entries, handling adding,
 * updating, removing, and persisting changes to the catalog.
 */
class CatalogManager {
    private app: App; // Obsidian app instance
    private catalogModel: CatalogModel;
    private catalogFilePath: string;
    private changeLog: (CatalogEntry & {
        action: "add" | "update" | "remove";
    })[] = [];
    private changeLogFilePath: string; // Path for the change log file
    private compactionThreshold: number = 100; // Frequency to compact and rewrite the catalog
    private lastCompactTime: number = Date.now();
    private debouncingTimer: NodeJS.Timeout | null = null; // Timer for debouncing saves

    /**
     * Initializes a new instance of CatalogManager.
     * @param app The Obsidian app instance.
     * @param catalogFilePath The file path of the main catalog.
     */
    constructor(app: App, catalogFilePath: string) {
        this.app = app; // Initialize the app property
        this.catalogModel = new CatalogModel();
        this.catalogFilePath = catalogFilePath;
        this.changeLogFilePath = `${catalogFilePath}.log`; // Log file with .log extension
        this.loadCatalog();
    }

    /**
     * Loads the catalog from the specified file path and initializes the change log.
     */
    async loadCatalog() {
        try {
            const file = this.app.vault.getAbstractFileByPath(
                this.catalogFilePath
            ) as TFile;
            if (file instanceof TFile) {
                const fileData = await this.app.vault.read(file);
                const catalogEntries: { [key: string]: CatalogEntry } =
                    JSON.parse(fileData);
                Object.values(catalogEntries).forEach((entry) =>
                    this.catalogModel.addEntry(entry)
                );

                // Load change log if it exists
                try {
                    const logFile = this.app.vault.getAbstractFileByPath(
                        this.changeLogFilePath
                    ) as TFile;
                    if (logFile instanceof TFile) {
                        const logData = await this.app.vault.read(logFile);
                        const changes: (CatalogEntry & {
                            action: "add" | "update" | "remove";
                        })[] = JSON.parse(logData);
                        this.changeLog.push(...changes);
                    }
                } catch (error) {
                    console.warn(
                        "Change log not found or empty, starting fresh."
                    );
                }
            } else {
                console.error("Catalog file does not exist.");
            }
        } catch (error) {
            console.error("Failed to load catalog:", error);
        }
    }

    /**
     * Adds a new catalog entry and logs the change.
     * @param conversationData The conversation data to add.
     * @param notePath The path to the note associated with the entry.
     * @param fileHash The hash of the file for integrity verification.
     */
    addCatalogEntry(conversationData: any, notePath: string, fileHash: string) {
        const entry: CatalogEntry = {
            conversation_id: conversationData.conversation_id,
            create_time: conversationData.create_time,
            update_time: conversationData.update_time,
            provider: conversationData.provider,
            notePath: notePath,
            messageCount: conversationData.chat_messages.length,
            fileHash: fileHash,
        };

        this.catalogModel.addEntry(entry);
        this.changeLog.push({ ...entry, action: "add" });
        this.scheduleSave();
    }

    /**
     * Updates an existing catalog entry and logs the change.
     * @param conversation_id The ID of the conversation to update.
     * @param updateTime The new update time for the entry.
     * @param messageCount The new message count for the conversation.
     */
    updateCatalogEntry(
        conversation_id: string,
        updateTime: string,
        messageCount: number
    ) {
        this.catalogModel.updateEntry(
            conversation_id,
            updateTime,
            messageCount
        );
        const entry =
            this.catalogModel.findEntryByConversationId(conversation_id);
        if (entry) {
            this.changeLog.push({ ...entry, action: "update" });
        }
        this.scheduleSave();
    }

    /**
     * Removes a catalog entry by its conversation ID and logs the change.
     * @param conversation_id The ID of the conversation to remove.
     */
    removeCatalogEntry(conversation_id: string) {
        const entry =
            this.catalogModel.findEntryByConversationId(conversation_id);
        if (entry) {
            this.catalogModel.removeEntry(conversation_id);
            this.changeLog.push({ ...entry, action: "remove" });
            this.scheduleSave();
        }
    }

    /**
     * Saves the current changes in the change log to the change log file.
     */
    private async saveChangeLog() {
        if (this.changeLog.length === 0) return; // No changes to save
        const jsonString = JSON.stringify(this.changeLog, null, 2);
        try {
            await this.app.vault.modify(
                this.app.vault.getAbstractFileByPath(
                    this.changeLogFilePath
                ) as TFile,
                jsonString
            );
            this.changeLog = []; // Clear the in-memory log after saving
        } catch (error) {
            console.error("Failed to save change log:", error);
        }
    }

    /**
     * Merges the current changes from the change log with the main catalog.
     */
    private async mergeCatalog() {
        const mergedEntries = new Map<string, CatalogEntry>(); // Use a Map for faster lookups
        this.catalogModel
            .getEntries()
            .forEach((entry) =>
                mergedEntries.set(entry.conversation_id, entry)
            );

        const changesToApply = this.changeLog
            .map((change) => {
                if (change.action === "add") return change;
                if (change.action === "update") {
                    return {
                        ...change,
                        update_time: change.update_time,
                        messageCount: change.messageCount,
                    };
                }
                return null; // For 'remove' actions; we'll handle that later
            })
            .filter(
                (
                    change
                ): change is CatalogEntry & {
                    action: "add" | "update" | "remove";
                } => change !== null
            );

        changesToApply.forEach((change) => {
            if (change) {
                if (change.action === "add") {
                    mergedEntries.set(change.conversation_id, change); // Add new entry
                } else if (change.action === "update") {
                    const existingEntry = mergedEntries.get(
                        change.conversation_id
                    );
                    if (existingEntry) {
                        existingEntry.update_time = change.update_time;
                        existingEntry.messageCount = change.messageCount;
                    }
                } else if (change.action === "remove") {
                    mergedEntries.delete(change.conversation_id); // Remove entry by conversation_id
                }
            }
        });

        const jsonString = JSON.stringify(
            Array.from(mergedEntries.values()),
            null,
            2
        );
        try {
            await this.app.vault.modify(
                this.app.vault.getAbstractFileByPath(
                    this.catalogFilePath
                ) as TFile,
                jsonString
            );
        } catch (error) {
            console.error("Failed to merge and save catalog:", error);
        }
    }

    /**
     * Compacts the catalog by merging changes and clearing the change log file.
     */
    private async compactCatalog() {
        await this.mergeCatalog();
        const logFile = this.app.vault.getAbstractFileByPath(
            this.changeLogFilePath
        ) as TAbstractFile;

        if (logFile) {
            await this.app.vault.delete(logFile);
        } else {
            console.warn("Change log file does not exist, nothing to delete.");
        }

        this.lastCompactTime = Date.now(); // Reset last compact time
    }

    /**
     * Schedules the saving of changes and compaction of the catalog.
     */
    private scheduleSave() {
        // Clear the previous timer to debounce the save operation
        if (this.debouncingTimer) {
            clearTimeout(this.debouncingTimer);
        }

        // Set a new timer
        this.debouncingTimer = setTimeout(() => {
            const now = Date.now();

            if (
                this.changeLog.length > 0 &&
                now - this.lastCompactTime > this.compactionThreshold
            ) {
                this.saveChangeLog(); // Save the change log if the threshold is exceeded
            }

            // Conditionally compact if no changes are pending
            if (this.changeLog.length === 0) {
                this.compactCatalog();
            }
        }, 300); // Adjust the debounce delay time (e.g., 300 ms)
    }
}

export { CatalogManager }; // Export the CatalogManager class
