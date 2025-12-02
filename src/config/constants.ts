/**
 * Nexus AI Chat Importer - Obsidian Plugin
 * Copyright (C) 2024 Akim Sissaoui
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */


// src/config/constants.ts
import { PluginSettings, MessageTimestampFormat } from "../types/plugin";

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

    // Message timestamp format
    useCustomMessageTimestampFormat: false,
    messageTimestampFormat: "locale",

    // ========================================
    // 🔧 INTERNAL SETTINGS
    // ========================================
    lastConversationsPerPage: 50,

	    // ========================================
	    // 🔄 MIGRATION FLAGS
	    // ========================================
	    hasShownUpgradeNotice: false,
	    hasSeenClaude132UpgradeNotice: false,
	    hasCompletedUpgrade: false,
	    currentVersion: "0.0.0",
	    previousVersion: "0.0.0",
};

// Internal threshold for switching to streaming/large-archive mode (100 MB uncompressed)
export const LARGE_ARCHIVE_THRESHOLD_BYTES = 100 * 1024 * 1024;

// Limit detailed rows in very large import reports to avoid generating huge markdown files
export const MAX_REPORT_DETAILED_ENTRIES = 1000;

export const GITHUB = {
    RAW_BASE: "https://raw.githubusercontent.com/Superkikim/nexus-ai-chat-importer",
    REPO_BASE: "https://github.com/Superkikim/nexus-ai-chat-importer"
} as const;

/**
 * Provider-specific URLs
 */
export const PROVIDER_URLS = {
    CHATGPT: {
        BASE: 'https://chatgpt.com',
        CHAT: (id: string) => `https://chatgpt.com/c/${id}`
    },
    CLAUDE: {
        BASE: 'https://claude.ai',
        CHAT: (id: string) => `https://claude.ai/chat/${id}`
    }
} as const;

/**
 * Provider names as constants
 */
export const PROVIDERS = {
    CHATGPT: 'chatgpt',
    CLAUDE: 'claude'
} as const;

export type Provider = typeof PROVIDERS[keyof typeof PROVIDERS];

/**
 * Nexus custom callout types
 */
export const NEXUS_CALLOUTS = {
    USER: 'nexus_user',
    AGENT: 'nexus_agent',
    ATTACHMENT: 'nexus_attachment',
    ARTIFACT: 'nexus_artifact',
    PROMPT: 'nexus_prompt'
} as const;

/**
 * Message timestamp format definitions
 */
export const MESSAGE_TIMESTAMP_FORMATS: Record<MessageTimestampFormat, {
    label: string;
    description: string;
    dateFormat: string;
    timeFormat: string;
    separator: string;
}> = {
    locale: {
        label: 'Auto (Obsidian Language)',
        description: 'Follows Obsidian language setting',
        dateFormat: 'L',      // moment.js locale-aware
        timeFormat: 'LTS',    // moment.js locale-aware
        separator: ' at '
    },
    iso: {
        label: 'YYYY-MM-DD HH:mm:ss (Universal)',
        description: 'YYYY-MM-DD HH:mm:ss - Sortable, unambiguous',
        dateFormat: 'YYYY-MM-DD',
        timeFormat: 'HH:mm:ss',
        separator: ' '
    },
    us: {
        label: 'MM/DD/YYYY h:mm:ss AM/PM (US)',
        description: 'MM/DD/YYYY h:mm:ss AM/PM',
        dateFormat: 'MM/DD/YYYY',
        timeFormat: 'h:mm:ss A',
        separator: ' at '
    },
    eu: {
        label: 'DD/MM/YYYY HH:mm:ss (Europe)',
        description: 'DD/MM/YYYY HH:mm:ss',
        dateFormat: 'DD/MM/YYYY',
        timeFormat: 'HH:mm:ss',
        separator: ' at '
    },
    de: {
        label: 'DD.MM.YYYY HH:mm:ss (German/Swiss)',
        description: 'DD.MM.YYYY HH:mm:ss',
        dateFormat: 'DD.MM.YYYY',
        timeFormat: 'HH:mm:ss',
        separator: ' '
    },
    jp: {
        label: 'YYYY/MM/DD HH:mm:ss (Japanese)',
        description: 'YYYY/MM/DD HH:mm:ss',
        dateFormat: 'YYYY/MM/DD',
        timeFormat: 'HH:mm:ss',
        separator: ' '
    }
};
