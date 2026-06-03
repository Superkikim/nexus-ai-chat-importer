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

/**
 * Type definitions for Mistral Vibe (formerly Le Chat) export format
 *
 * Mistral Vibe exports conversations as individual JSON files in the format:
 * - chat-{uuid}.json - Array of messages
 * - chat-{uuid}-files/ - Directory containing attachments
 *
 * Each message contains:
 * - Basic fields: id, chatId, role, content, createdAt
 * - Content chunks: text, tool_call, reference, custom_element
 * - Files: Array of attached files
 */

/**
 * Content chunk types in Le Chat messages
 */
export interface MistralVibeTextChunk {
    type: "text";
    text: string;
}

export interface MistralVibeToolCallChunk {
    type: "tool_call";
    id?: string;
    name?: string;
    turn?: number;
    isDone?: boolean;
    endTime?: number;
    success?: boolean;
    toolType?: string;
    startTime?: number;
    publicResult?: unknown;
    isInterrupted?: boolean;
    publicArguments?: string;
    requiresConfirmation?: boolean;
}

export interface MistralVibeReferenceChunk {
    type: "reference";
    referenceIds?: number[];
}

export interface MistralVibeCustomElementChunk {
    type: "custom_element";
    [key: string]: unknown;
}

export interface MistralVibeImageUrlChunk {
    type: "image_url";
    imageUrl: string;
}

export type MistralVibeContentChunk =
    | MistralVibeTextChunk
    | MistralVibeToolCallChunk
    | MistralVibeReferenceChunk
    | MistralVibeCustomElementChunk
    | MistralVibeImageUrlChunk;

/**
 * File attachment in Le Chat message
 */
export interface MistralVibeFile {
    type: "image" | "text" | "document";
    name: string;
}

/**
 * Le Chat message structure
 */
export interface MistralVibeMessage {
    id: string;
    version: number;
    chatId: string;
    content: string;
    contentChunks: MistralVibeContentChunk[] | null;
    role: "user" | "assistant";
    createdAt: string; // ISO 8601 format
    reaction: string;
    reactionDetail: string | null;
    reactionComment: string | null;
    preference: string | null;
    preferenceOver: string | null;
    context: unknown | null;
    canvas: unknown[];
    quotes: unknown[];
    files: MistralVibeFile[];
}

/**
 * Le Chat conversation structure
 * Note: Le Chat exports are arrays of messages, not wrapped in a conversation object
 */
export type MistralVibeConversation = MistralVibeMessage[];

/**
 * Alias for compatibility with provider adapter interface
 */
export type MistralVibeChat = MistralVibeConversation;
