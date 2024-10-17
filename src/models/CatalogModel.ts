import { CatalogEntry } from "../types";

/**
 * Manages a collection of catalog entries.
 */
class CatalogModel {
    private catalog: CatalogEntry[] = [];

    /**
     * Adds a new entry to the catalog.
     * @param entry The catalog entry to add.
     */
    addEntry(entry: CatalogEntry) {
        this.catalog.push(entry);
    }

    /**
     * Retrieves all entries in the catalog.
     * @returns An array of catalog entries.
     */
    getEntries(): CatalogEntry[] {
        return this.catalog;
    }

    /**
     * Finds a catalog entry by its conversation ID.
     * @param conversation_id The ID of the conversation to find.
     * @returns The found catalog entry or undefined if not found.
     */
    findEntryByConversationId(
        conversation_id: string
    ): CatalogEntry | undefined {
        return this.catalog.find(
            (entry) => entry.conversation_id === conversation_id
        );
    }

    /**
     * Updates an existing catalog entry identified by its conversation ID.
     * @param conversation_id The ID of the conversation to update.
     * @param updateTime The new update time for the entry.
     * @param messageCount The new message count for the entry.
     */
    updateEntry(
        conversation_id: string,
        updateTime: string,
        messageCount: number
    ) {
        const entry = this.findEntryByConversationId(conversation_id);
        if (entry) {
            entry.update_time = updateTime;
            entry.messageCount = messageCount;
        }
    }

    /**
     * Removes an entry from the catalog by its conversation ID.
     * @param conversation_id The ID of the conversation to remove.
     * @returns True if an entry was removed; otherwise, false.
     */
    removeEntry(conversation_id: string): boolean {
        const initialLength = this.catalog.length;
        this.catalog = this.catalog.filter(
            (entry) => entry.conversation_id !== conversation_id
        );
        return this.catalog.length < initialLength; // Return true if an entry was removed
    }
}

export { CatalogModel, CatalogEntry };
