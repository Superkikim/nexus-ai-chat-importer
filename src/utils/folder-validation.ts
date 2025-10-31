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

// src/utils/folder-validation.ts

export interface FolderValidationResult {
    valid: boolean;
    error?: string;
}

/**
 * Validates that a folder path is not nested inside another folder path
 * @param pathToCheck The path to validate
 * @param existingPath The existing path to check against
 * @returns true if pathToCheck is inside existingPath
 */
export function isPathInsidePath(pathToCheck: string, existingPath: string): boolean {
    if (!pathToCheck || !existingPath) {
        return false;
    }

    // Normalize paths (remove trailing slashes)
    const normalizedCheck = pathToCheck.replace(/\/$/, '');
    const normalizedExisting = existingPath.replace(/\/$/, '');

    // Same path is not considered "inside"
    if (normalizedCheck === normalizedExisting) {
        return false;
    }

    // Check if pathToCheck starts with existingPath followed by a slash
    return normalizedCheck.startsWith(normalizedExisting + '/');
}

/**
 * Validates that the three main folders (conversations, reports, attachments) are not nested inside each other
 * @param folderType The type of folder being changed ('conversationFolder' | 'reportFolder' | 'attachmentFolder')
 * @param newPath The new path for the folder
 * @param conversationFolder Current conversation folder path
 * @param reportFolder Current report folder path
 * @param attachmentFolder Current attachment folder path
 * @returns Validation result with error message if invalid
 */
export function validateFolderNesting(
    folderType: 'conversationFolder' | 'reportFolder' | 'attachmentFolder',
    newPath: string,
    conversationFolder: string,
    reportFolder: string,
    attachmentFolder: string
): FolderValidationResult {
    // Normalize the new path
    const normalizedNewPath = newPath.trim().replace(/\/$/, '');

    if (!normalizedNewPath) {
        return {
            valid: false,
            error: "Folder path cannot be empty"
        };
    }

    // Check based on which folder is being changed
    switch (folderType) {
        case 'conversationFolder':
            // Conversation folder cannot be inside Reports or Attachments
            if (isPathInsidePath(normalizedNewPath, reportFolder)) {
                return {
                    valid: false,
                    error: `Conversation folder cannot be inside the Report folder (${reportFolder})`
                };
            }
            if (isPathInsidePath(normalizedNewPath, attachmentFolder)) {
                return {
                    valid: false,
                    error: `Conversation folder cannot be inside the Attachment folder (${attachmentFolder})`
                };
            }
            break;

        case 'reportFolder':
            // Report folder cannot be inside Conversations or Attachments
            if (isPathInsidePath(normalizedNewPath, conversationFolder)) {
                return {
                    valid: false,
                    error: `Report folder cannot be inside the Conversation folder (${conversationFolder})`
                };
            }
            if (isPathInsidePath(normalizedNewPath, attachmentFolder)) {
                return {
                    valid: false,
                    error: `Report folder cannot be inside the Attachment folder (${attachmentFolder})`
                };
            }
            break;

        case 'attachmentFolder':
            // Attachment folder cannot be inside Conversations or Reports
            if (isPathInsidePath(normalizedNewPath, conversationFolder)) {
                return {
                    valid: false,
                    error: `Attachment folder cannot be inside the Conversation folder (${conversationFolder})`
                };
            }
            if (isPathInsidePath(normalizedNewPath, reportFolder)) {
                return {
                    valid: false,
                    error: `Attachment folder cannot be inside the Report folder (${reportFolder})`
                };
            }
            break;
    }

    return { valid: true };
}

