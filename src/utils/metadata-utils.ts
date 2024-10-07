// utils/metadata-utils.ts

import { TFile, App } from "obsidian";

export function getConversationId(file: TFile, app: App): string | undefined {
    const frontmatter = app.metadataCache.getFileCache(file)?.frontmatter; // Use the passed file
    return frontmatter?.conversation_id; // Return the conversation_id from frontmatter
}

export function getProvider(file: TFile, app: App): string | undefined {
    const frontmatter = app.metadataCache.getFileCache(file)?.frontmatter; // Use the passed file
    return frontmatter?.provider; // Return the provider from frontmatter
}

export function isNexusRelated(file: TFile, app: App): boolean {
    const frontmatter = app.metadataCache.getFileCache(file)?.frontmatter; // Use the passed file
    return frontmatter?.nexus === "nexus-ai-chat-importer"; // Return true if the nexus matches
}
