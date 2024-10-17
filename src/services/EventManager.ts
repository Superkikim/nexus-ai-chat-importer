import { App, TAbstractFile, TFile } from "obsidian"; // Import necessary types from Obsidian API
import { CatalogManager } from "../services/CatalogManager"; // Adjust the path as necessary
import { debounce } from "lodash"; // Import debounce if you're using it

class EventManager {
    private app: App;
    private catalogManager: CatalogManager;

    constructor(app: App, catalogManager: CatalogManager) {
        this.app = app;
        this.catalogManager = catalogManager;
        this.registerEvents();
    }

    private registerEvents() {
        this.app.vault.on(
            "delete",
            debounce(async (file: TAbstractFile) => {
                // Explicitly type the 'file' parameter
                if (file instanceof TFile) {
                    const frontmatter =
                        this.app.metadataCache.getFileCache(file)?.frontmatter;

                    if (frontmatter?.conversation_id) {
                        this.catalogManager.removeCatalogEntry(
                            frontmatter.conversation_id
                        );
                        // No need to call saveCatalog here since it's managed by scheduleSave
                    }
                }
            }, 300) // Delay to group delete events, adjust as needed
        );
    }
}

export { EventManager }; // Exporting the EventManager class
