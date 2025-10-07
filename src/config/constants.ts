// src/config/constants.ts
import { PluginSettings } from "../types/plugin";

export const DEFAULT_SETTINGS: PluginSettings = {
    // ========================================
    // 📁 FOLDER STRUCTURE
    // ========================================
    conversationFolder: "Nexus/Conversations",
    reportFolder: "Nexus/Reports",
    attachmentFolder: "Nexus/Attachments",

    // ========================================
    // 🎨 DISPLAY OPTIONS
    // ========================================
    addDatePrefix: false,
    dateFormat: "YYYY-MM-DD",

    // ========================================
    // 🔧 INTERNAL SETTINGS
    // ========================================
    lastConversationsPerPage: 50,

    // ========================================
    // 🔄 MIGRATION FLAGS
    // ========================================
    hasShownUpgradeNotice: false,
    hasCompletedUpgrade: false,
    currentVersion: "0.0.0",
    previousVersion: "0.0.0",
};

export const GITHUB = {
    RAW_BASE: "https://raw.githubusercontent.com/Superkikim/nexus-ai-chat-importer",
    REPO_BASE: "https://github.com/Superkikim/nexus-ai-chat-importer"
} as const;