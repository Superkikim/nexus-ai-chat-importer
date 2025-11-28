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


// src/utils/message-utils.ts
import { StandardMessage } from '../types/standard';

/**
 * Sort messages by timestamp with ID as secondary sort
 * Used by ALL providers for consistent chronological ordering
 * 
 * @param messages - Array of StandardMessage to sort
 * @returns Sorted array (does not modify original)
 * 
 * @example
 * const sorted = sortMessagesByTimestamp(messages);
 * // Messages are ordered by timestamp ascending
 * // Messages with same timestamp are ordered by ID (lexicographic)
 */
export function sortMessagesByTimestamp(messages: StandardMessage[]): StandardMessage[] {
    // Early return for empty or single-element arrays
    if (messages.length <= 1) {
        return messages;
    }

    return messages.sort((a, b) => {
        // Primary sort: timestamp (ascending)
        if (a.timestamp !== b.timestamp) {
            return a.timestamp - b.timestamp;
        }

        // Secondary sort: ID (lexicographic order for same timestamp)
        // This ensures consistent ordering when messages have identical timestamps
        return a.id.localeCompare(b.id);
    });
}

/**
 * Validate that a message has the required structure
 * 
 * @param message - Object to validate
 * @returns true if message has valid structure
 */
export function isValidMessage(message: any): message is StandardMessage {
    if (!message || typeof message !== 'object') {
        return false;
    }

    // Required fields
    if (typeof message.id !== 'string' || !message.id) {
        return false;
    }

    if (message.role !== 'user' && message.role !== 'assistant') {
        return false;
    }

    if (typeof message.content !== 'string') {
        return false;
    }

    if (typeof message.timestamp !== 'number' || message.timestamp < 0) {
        return false;
    }

    // Optional attachments field
    if (message.attachments !== undefined && !Array.isArray(message.attachments)) {
        return false;
    }

    return true;
}

/**
 * Filter out invalid messages from an array
 * 
 * @param messages - Array of messages (possibly invalid)
 * @returns Array containing only valid messages
 */
export function filterValidMessages(messages: any[]): StandardMessage[] {
    return messages.filter(isValidMessage);
}

/**
 * Count messages by role
 * 
 * @param messages - Array of messages
 * @returns Object with counts for user and assistant messages
 */
export function countMessagesByRole(messages: StandardMessage[]): { user: number; assistant: number } {
    return messages.reduce(
        (counts, message) => {
            if (message.role === 'user') {
                counts.user++;
            } else if (message.role === 'assistant') {
                counts.assistant++;
            }
            return counts;
        },
        { user: 0, assistant: 0 }
    );
}

