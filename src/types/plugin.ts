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


// src/types/plugin.ts
export interface PluginSettings {
    // ========================================
    // 📁 FOLDER STRUCTURE
    // ========================================
    conversationFolder: string;
    reportFolder: string;
    attachmentFolder: string;

    // ========================================
    // 🎨 DISPLAY OPTIONS
    // ========================================
    addDatePrefix: boolean;
    dateFormat: 'YYYY-MM-DD' | 'YYYYMMDD';

    // ========================================
    // 🔧 INTERNAL SETTINGS (not shown in UI)
    // ========================================
    lastConversationsPerPage: number;

    // ========================================
    // 🔄 MIGRATION FLAGS
    // ========================================
    hasShownUpgradeNotice: boolean;
    hasCompletedUpgrade: boolean;
    currentVersion: string;
    previousVersion: string;

    // ========================================
    // 🗑️ DEPRECATED (will be removed in migration)
    // ========================================
    archiveFolder?: string;  // Renamed to conversationFolder
    importAttachments?: boolean;  // Always true now
    skipMissingAttachments?: boolean;  // Always handle attachments
    showAttachmentDetails?: boolean;  // Removed
    defaultImportMode?: 'all' | 'selective';  // Removed
    rememberLastImportMode?: boolean;  // Removed
    conversationPageSize?: number;  // Replaced by lastConversationsPerPage
    autoSelectAllOnOpen?: boolean;  // Removed
}

export interface ConversationRecord {
    path: string;
    updateTime: number;
}

export interface ReportEntry {
    title: string;
    filePath: string;
    createDate: string;
    updateDate: string;
    messageCount: number;
    reason?: string;
}

export interface ConversationCatalogEntry {
    conversationId: string;
    provider: string;
    updateTime: number;
    path: string;
    create_time: number;
    update_time: number;
}

export interface CustomError {
    message: string;
    name?: string;
}

export function isCustomError(error: unknown): error is CustomError {
    return (
        typeof error === 'object' &&
        error !== null &&
        'message' in error
    );
}

export interface ConfirmationDialogOptions {
    url: string;
    message?: string;
    note?: string;
}

export interface AttachmentStats {
    total: number;
    found: number;
    missing: number;
    failed: number;
}