// src/events/event-handlers.ts
import { TFile, MarkdownView } from "obsidian";
import { getConversationId, getProvider, checkAnyNexusFilesActive } from "../utils";
import { showDialog } from "../dialogs";
import type NexusAiChatImporterPlugin from "../main";
import { ConversationCatalogEntry } from "../types/plugin";

export class EventHandlers {
    private clickListenerActive = false;
    private handleClickBound: (event: MouseEvent) => Promise<void>;

    constructor(private plugin: NexusAiChatImporterPlugin) {
        this.handleClickBound = this.handleClick.bind(this);
    }

    registerEvents() {
        // Check if a Nexus file is already active on plugin load
        this.checkAndSetupClickListener();

        // Handle file deletion
        this.plugin.registerEvent(
            this.plugin.app.vault.on("delete", async (file) => {
                if (file instanceof TFile) {
                    const frontmatter = this.plugin.app.metadataCache.getFileCache(file)?.frontmatter;
                    if (frontmatter?.conversation_id) {
                        const storage = this.plugin.getStorageService();
                        const catalog = storage.getConversationCatalog();
                        
                        for (const [id, record] of Object.entries(catalog) as [string, ConversationCatalogEntry][]) {
                            if (record.conversationId === frontmatter.conversation_id) {
                                storage.deleteFromConversationCatalog(id);
                                await this.plugin.saveSettings();
                                break;
                            }
                        }
                    }
                }
            })
        );

        // Detect if active file is from this plugin
        this.plugin.registerEvent(
            this.plugin.app.workspace.on("active-leaf-change", () => {
                this.checkAndSetupClickListener();
            })
        );
    }

    private checkAndSetupClickListener() {
        const file = this.plugin.app.workspace.getActiveFile();
        if (file instanceof TFile) {
            const frontmatter = this.plugin.app.metadataCache.getFileCache(file)?.frontmatter;
            const isNexusRelated = frontmatter && frontmatter.nexus;

            if (isNexusRelated && !this.clickListenerActive) {
                this.addClickListener();
            } else if (!isNexusRelated && this.clickListenerActive) {
                this.removeClickListenerIfNotNeeded();
            }
        } else {
            this.removeClickListenerIfNotNeeded();
        }
    }

    private addClickListener() {
        if (!this.clickListenerActive) {
            document.addEventListener("click", this.handleClickBound);
            this.clickListenerActive = true;
        }
    }

    private removeClickListenerIfNotNeeded() {
        const anyNexusFilesActive = checkAnyNexusFilesActive(this.plugin.app);
        if (!anyNexusFilesActive && this.clickListenerActive) {
            document.removeEventListener("click", this.handleClickBound);
            this.clickListenerActive = false;
        }
    }

    private async handleClick(event: MouseEvent) {
        const target = event.target as HTMLElement;
        const markdownView = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
        
        if (!markdownView) return;

        // Use the view's container element directly
        const container = markdownView.containerEl;

        if (!container.contains(target)) return;

        const activeFile = this.plugin.app.workspace.getActiveFile();
        if (!activeFile) return;

        if (target.classList.contains("inline-title")) {
            const file = this.plugin.app.vault.getAbstractFileByPath(activeFile.path);
            if (file instanceof TFile) {
                const conversationId = getConversationId(file);
                if (conversationId) {
                    const provider = getProvider(activeFile);
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
            }
        }
    }

    cleanup() {
        if (this.clickListenerActive) {
            document.removeEventListener("click", this.handleClickBound);
            this.clickListenerActive = false;
        }
    }
}