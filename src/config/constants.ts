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