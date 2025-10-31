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


// src/providers/claude/claude-types.ts

export interface ClaudeUser {
    uuid: string;
    full_name: string;
    email_address: string;
    verified_phone_number?: string;
}

export interface ClaudeProject {
    uuid: string;
    name: string;
    description: string;
    is_private: boolean;
    is_starter_project: boolean;
    prompt_template: string;
    created_at: string;
    updated_at: string;
    creator: {
        uuid: string;
        full_name: string;
    };
    docs: ClaudeProjectDoc[];
}

export interface ClaudeProjectDoc {
    uuid: string;
    filename: string;
    content: string;
    created_at: string;
}

export interface ClaudeFile {
    file_name: string;
}

export interface ClaudeContentBlock {
    start_timestamp: string;
    stop_timestamp: string;
    type: 'text' | 'thinking' | 'tool_use' | 'tool_result';
    text?: string;
    thinking?: string;
    citations?: any[];
    summaries?: Array<{
        summary: string;
    }>;
    // Tool use specific fields
    name?: string;
    input?: {
        code?: string;
        [key: string]: any;
    };
    // Tool result specific fields
    content?: Array<{
        type: string;
        text: string;
        uuid: string;
    }>;
}

export interface ClaudeMessage {
    uuid: string;
    text: string;
    sender: 'human' | 'assistant';
    created_at: string;
    content: ClaudeContentBlock[];
    attachments: any[]; // Usually empty, files are used instead
    files: ClaudeFile[];
}

export interface ClaudeConversation {
    uuid: string;
    name: string;
    account: {
        uuid: string;
    };
    created_at: string;
    updated_at: string;
    chat_messages: ClaudeMessage[];
    summary?: string;
    model?: string;
    is_starred?: boolean;
    current_leaf_message_uuid?: string;
    project_uuid?: string;
}

// Export data structure
export interface ClaudeExportData {
    conversations: ClaudeConversation[];
    users: ClaudeUser[];
    projects: ClaudeProject[];
}

// For compatibility with provider adapter
export type ClaudeChat = ClaudeConversation;
export type ClaudeChatMessage = ClaudeMessage;
