// src/config/constants.ts
import { PluginSettings } from "../types/plugin";

export const DEFAULT_SETTINGS: PluginSettings = {
    archiveFolder: "Nexus AI Chat Imports",
    addDatePrefix: false,
    dateFormat: "YYYY-MM-DD",
    hasShownUpgradeNotice: false,
    hasCompletedUpgrade: false,
    
    // Attachment defaults with "best effort" approach
    importAttachments: true,  // Enable by default
    attachmentFolder: "Nexus AI Chat Imports/Attachments",
    skipMissingAttachments: false, // Show notes for missing attachments by default
    showAttachmentDetails: true,   // Show detailed status in reports
};

export const GITHUB = {
    RAW_BASE: "https://raw.githubusercontent.com/Superkikim/nexus-ai-chat-importer",
    REPO_BASE: "https://github.com/Superkikim/nexus-ai-chat-importer"
} as const;