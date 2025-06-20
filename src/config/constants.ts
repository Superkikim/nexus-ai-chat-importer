// src/config/constants.ts
import { PluginSettings } from "../types";

export const DEFAULT_SETTINGS: PluginSettings = {
    archiveFolder: "Nexus AI Chat Imports",
    addDatePrefix: false,
    dateFormat: "YYYY-MM-DD",
    hasShownUpgradeNotice: false,
    hasCompletedUpgrade: false,
};

export const GITHUB = {
    RAW_BASE: "https://raw.githubusercontent.com/Superkikim/nexus-ai-chat-importer",
    REPO_BASE: "https://github.com/Superkikim/nexus-ai-chat-importer"
} as const;
