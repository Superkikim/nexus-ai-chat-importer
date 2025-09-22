// src/config/constants.ts
import { PluginSettings } from "../types/plugin";

export const DEFAULT_SETTINGS: PluginSettings = {
    archiveFolder: "Nexus/Conversations", // Default only for first install; preserved if user already set
    addDatePrefix: false,
    dateFormat: "YYYY-MM-DD",
    hasShownUpgradeNotice: false,
    hasCompletedUpgrade: false,

    // Version tracking - will be set from manifest in main.ts
    currentVersion: "0.0.0",
    previousVersion: "0.0.0",

    // Attachment defaults
    importAttachments: true,
    attachmentFolder: "Nexus_attachments", // Default only for first install; preserved if user already set
    reportFolder: "", // Will be computed as <archiveFolder>/Reports on load
    skipMissingAttachments: false,
    showAttachmentDetails: true,

    // Conversation selection defaults
    defaultImportMode: "all",
    rememberLastImportMode: false,
    conversationPageSize: 20,
    autoSelectAllOnOpen: false,
};

export const GITHUB = {
    RAW_BASE: "https://raw.githubusercontent.com/Superkikim/nexus-ai-chat-importer",
    REPO_BASE: "https://github.com/Superkikim/nexus-ai-chat-importer"
} as const;