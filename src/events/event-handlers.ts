// src/events/event-handlers.ts
import { TFile, MarkdownView, debounce } from "obsidian";
import { getConversationId, getProvider, isNexusRelated } from "../utils";
import { showDialog } from "../dialogs";
import type NexusAiChatImporterPlugin from "../main";
import { ConversationCatalogEntry } from "../types/plugin";

export class EventHandlers {
    private clickListenerActive = false;
    private handleClickBound: (event: MouseEvent) => Promise<void>;
    private activeNexusFiles = new Set<string>(); // Cache active Nexus files
    private debouncedCheckListener: () => void;

    constructor(private plugin: NexusAiChatImporterPlugin) {
        this.handleClickBound = this.handleClick.bind(this);
        
        // Debounce the expensive check operation
        this.debouncedCheckListener = debounce(
            this.performExpensiveCheck.bind(this), 
            100, // 100ms delay
            true // immediate first call
        );
    }

    registerEvents() {
        // Initial check on plugin load (only once)
        this.initializeActiveFiles();

        // Handle file deletion
        this.plugin.registerEvent(
            this.plugin.app.vault.on("delete", async (file) => {
                if (file instanceof TFile) {
                    // Remove from cache
                    this.activeNexusFiles.delete(file.path);
                    
                    // Check if we need to remove click listener
                    if (this.activeNexusFiles.size === 0 && this.clickListenerActive) {
                        this.removeClickListener();
                    }

                    // Handle catalog cleanup
                    const frontmatter = this.plugin.app.metadataCache.getFileCache(file)?.frontmatter;
                    if (frontmatter?.conversation_id) {
                        await this.handleConversationFileDeletion(frontmatter.conversation_id);
                    }
                }
            })
        );

        // Optimize active leaf change handling
        this.plugin.registerEvent(
            this.plugin.app.workspace.on("active-leaf-change", () => {
                this.handleActiveLeafChange();
            })
        );

        // Handle file modifications to cache
        this.plugin.registerEvent(
            this.plugin.app.metadataCache.on("changed", (file) => {
                if (file instanceof TFile) {
                    this.updateFileCache(file);
                }
            })
        );
    }

    private initializeActiveFiles() {
        const activeFile = this.plugin.app.workspace.getActiveFile();
        if (activeFile && this.isNexusFile(activeFile)) {
            this.activeNexusFiles.add(activeFile.path);
            this.addClickListener();
        }
    }

    private handleActiveLeafChange() {
        const activeFile = this.plugin.app.workspace.getActiveFile();
        
        if (!activeFile) {
            return;
        }

        const isNexus = this.isNexusFile(activeFile);
        
        if (isNexus) {
            // Add to cache and ensure click listener is active
            this.activeNexusFiles.add(activeFile.path);
            if (!this.clickListenerActive) {
                this.addClickListener();
            }
        } else {
            // File is not Nexus-related, but we might still have other Nexus files open
            // Only perform expensive check if we might need to remove the listener
            if (this.clickListenerActive) {
                this.debouncedCheckListener();
            }
        }
    }

    private performExpensiveCheck() {
        // This is the expensive operation we want to minimize
        const leaves = this.plugin.app.workspace.getLeavesOfType("markdown");
        const currentNexusFiles = new Set<string>();
        
        for (const leaf of leaves) {
            const file = leaf.view.file;
            if (file && this.isNexusFile(file)) {
                currentNexusFiles.add(file.path);
            }
        }
        
        // Update our cache
        this.activeNexusFiles = currentNexusFiles;
        
        // Update click listener state
        if (currentNexusFiles.size > 0 && !this.clickListenerActive) {
            this.addClickListener();
        } else if (currentNexusFiles.size === 0 && this.clickListenerActive) {
            this.removeClickListener();
        }
    }

    private updateFileCache(file: TFile) {
        const wasNexus = this.activeNexusFiles.has(file.path);
        const isNexus = this.isNexusFile(file);
        
        if (isNexus && !wasNexus) {
            this.activeNexusFiles.add(file.path);
            if (!this.clickListenerActive) {
                this.addClickListener();
            }
        } else if (!isNexus && wasNexus) {
            this.activeNexusFiles.delete(file.path);
            if (this.activeNexusFiles.size === 0 && this.clickListenerActive) {
                this.removeClickListener();
            }
        }
    }

    private isNexusFile(file: TFile): boolean {
        const frontmatter = this.plugin.app.metadataCache.getFileCache(file)?.frontmatter;
        return !!(frontmatter?.nexus === this.plugin.manifest.id);
    }

    private addClickListener() {
        if (!this.clickListenerActive) {
            document.addEventListener("click", this.handleClickBound);
            this.clickListenerActive = true;
        }
    }

    private removeClickListener() {
        if (this.clickListenerActive) {
            document.removeEventListener("click", this.handleClickBound);
            this.clickListenerActive = false;
        }
    }

    private async handleConversationFileDeletion(conversationId: string) {
        const storage = this.plugin.getStorageService();
        const catalog = storage.getConversationCatalog();
        
        for (const [id, record] of Object.entries(catalog) as [string, ConversationCatalogEntry][]) {
            if (record.conversationId === conversationId) {
                storage.deleteFromConversationCatalog(id);
                await this.plugin.saveSettings();
                break;
            }
        }
    }

    private async handleClick(event: MouseEvent) {
        // Early exit if no active Nexus files
        if (this.activeNexusFiles.size === 0) {
            return;
        }

        const target = event.target as HTMLElement;
        const markdownView = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
        
        if (!markdownView) return;

        const container = markdownView.containerEl;
        if (!container.contains(target)) return;

        const activeFile = this.plugin.app.workspace.getActiveFile();
        if (!activeFile || !this.isNexusFile(activeFile)) return;

        if (target.classList.contains("inline-title")) {
            await this.handleTitleClick(activeFile);
        }
    }

    private async handleTitleClick(file: TFile) {
        const conversationId = getConversationId(file);
        if (!conversationId) return;

        const provider = getProvider(file);
        if (provider === "chatgpt") {
            const url = `https://chatgpt.com/c/${conversationId}`;
            
            const userConfirmed = await showDialog(
                this.plugin.app,
                "confirmation",
                "Open link",
                [
                    `Original conversation URL: ${url}.`,
                    `Do you want to go there?`
                ],
                "NOTE: If the conversation has been deleted, it will not show.",
                { button1: "Let's go", button2: "No" }
            );

            if (userConfirmed) {
                window.open(url, "_blank");
            }
        }
    }

    cleanup() {
        this.removeClickListener();
        this.activeNexusFiles.clear();
    }
}