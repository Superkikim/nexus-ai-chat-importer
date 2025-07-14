// src/config/constants.ts
import { PluginSettings } from "../types/plugin";

export const DEFAULT_SETTINGS: PluginSettings = {
    archiveFolder: "Nexus AI Chat Imports",
    addDatePrefix: false,
    dateFormat: "YYYY-MM-DD",
    hasShownUpgradeNotice: false,
    hasCompletedUpgrade: false,
    
    // Version tracking - will be set from manifest in main.ts
    currentVersion: "0.0.0",
    previousVersion: "0.0.0",
    
    // Attachment defaults with "best effort" approach
    importAttachments: true,
    attachmentFolder: "Nexus AI Chat Imports/Attachments",
    skipMissingAttachments: false,
    showAttachmentDetails: true,
};

export const GITHUB = {
    RAW_BASE: "https://raw.githubusercontent.com/Superkikim/nexus-ai-chat-importer",
    REPO_BASE: "https://github.com/Superkikim/nexus-ai-chat-importer"
} as const;