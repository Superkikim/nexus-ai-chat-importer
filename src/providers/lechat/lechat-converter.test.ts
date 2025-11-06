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

import { describe, it, expect } from 'vitest';
import { LeChatConverter } from './lechat-converter';
import { LeChatConversation, LeChatMessage } from './lechat-types';

describe('LeChatConverter', () => {
    describe('convertChat', () => {
        it('should convert a simple Le Chat conversation', () => {
            const chat: LeChatConversation = [
                {
                    id: 'msg-1',
                    version: 0,
                    chatId: 'chat-123',
                    content: 'Hello, how are you?',
                    contentChunks: null,
                    role: 'user',
                    createdAt: '2025-09-19T16:18:19.236Z',
                    reaction: 'neutral',
                    reactionDetail: null,
                    reactionComment: null,
                    preference: null,
                    preferenceOver: null,
                    context: null,
                    canvas: [],
                    quotes: [],
                    files: []
                },
                {
                    id: 'msg-2',
                    version: 0,
                    chatId: 'chat-123',
                    content: 'I am doing well, thank you!',
                    contentChunks: null,
                    role: 'assistant',
                    createdAt: '2025-09-19T16:18:19.851Z',
                    reaction: 'neutral',
                    reactionDetail: null,
                    reactionComment: null,
                    preference: null,
                    preferenceOver: null,
                    context: null,
                    canvas: [],
                    quotes: [],
                    files: []
                }
            ];

            const result = LeChatConverter.convertChat(chat);

            expect(result.id).toBe('chat-123');
            expect(result.title).toBe('Hello, how are you?');
            expect(result.provider).toBe('lechat');
            expect(result.messages).toHaveLength(2);
            expect(result.messages[0].role).toBe('user');
            expect(result.messages[1].role).toBe('assistant');
            expect(result.chatUrl).toBe('https://chat.mistral.ai/chat/chat-123');
        });

        it('should truncate long titles to 50 characters', () => {
            const longContent = 'This is a very long message that should be truncated to fifty characters maximum';
            const chat: LeChatConversation = [
                {
                    id: 'msg-1',
                    version: 0,
                    chatId: 'chat-123',
                    content: longContent,
                    contentChunks: null,
                    role: 'user',
                    createdAt: '2025-09-19T16:18:19.236Z',
                    reaction: 'neutral',
                    reactionDetail: null,
                    reactionComment: null,
                    preference: null,
                    preferenceOver: null,
                    context: null,
                    canvas: [],
                    quotes: [],
                    files: []
                }
            ];

            const result = LeChatConverter.convertChat(chat);

            expect(result.title).toBe('This is a very long message that should be truncat...');
            expect(result.title.length).toBeLessThanOrEqual(53); // 50 + '...'
        });

        it('should use "Untitled" when no user message exists', () => {
            const chat: LeChatConversation = [
                {
                    id: 'msg-1',
                    version: 0,
                    chatId: 'chat-123',
                    content: 'Assistant message only',
                    contentChunks: null,
                    role: 'assistant',
                    createdAt: '2025-09-19T16:18:19.236Z',
                    reaction: 'neutral',
                    reactionDetail: null,
                    reactionComment: null,
                    preference: null,
                    preferenceOver: null,
                    context: null,
                    canvas: [],
                    quotes: [],
                    files: []
                }
            ];

            const result = LeChatConverter.convertChat(chat);

            expect(result.title).toBe('Untitled');
        });

        it('should calculate correct create and update times', () => {
            const chat: LeChatConversation = [
                {
                    id: 'msg-1',
                    version: 0,
                    chatId: 'chat-123',
                    content: 'First message',
                    contentChunks: null,
                    role: 'user',
                    createdAt: '2025-09-19T16:18:19.236Z',
                    reaction: 'neutral',
                    reactionDetail: null,
                    reactionComment: null,
                    preference: null,
                    preferenceOver: null,
                    context: null,
                    canvas: [],
                    quotes: [],
                    files: []
                },
                {
                    id: 'msg-2',
                    version: 0,
                    chatId: 'chat-123',
                    content: 'Last message',
                    contentChunks: null,
                    role: 'assistant',
                    createdAt: '2025-09-19T16:20:30.500Z',
                    reaction: 'neutral',
                    reactionDetail: null,
                    reactionComment: null,
                    preference: null,
                    preferenceOver: null,
                    context: null,
                    canvas: [],
                    quotes: [],
                    files: []
                }
            ];

            const result = LeChatConverter.convertChat(chat);

            // First message timestamp
            expect(result.createTime).toBe(Math.floor(new Date('2025-09-19T16:18:19.236Z').getTime() / 1000));
            // Last message timestamp
            expect(result.updateTime).toBe(Math.floor(new Date('2025-09-19T16:20:30.500Z').getTime() / 1000));
        });

        it('should throw error for empty conversation', () => {
            const chat: LeChatConversation = [];

            expect(() => LeChatConverter.convertChat(chat)).toThrow('Le Chat conversation is empty');
        });

        it('should sort messages chronologically even when in random order', () => {
            // Messages in RANDOM order (as they appear in real Le Chat exports)
            const chat: LeChatConversation = [
                {
                    id: 'msg-3',
                    version: 0,
                    chatId: 'chat-123',
                    content: 'Third message',
                    contentChunks: null,
                    role: 'assistant',
                    createdAt: '2025-09-19T16:18:21.000Z', // LATEST
                    reaction: 'neutral',
                    reactionDetail: null,
                    reactionComment: null,
                    preference: null,
                    preferenceOver: null,
                    context: null,
                    canvas: [],
                    quotes: [],
                    files: []
                },
                {
                    id: 'msg-1',
                    version: 0,
                    chatId: 'chat-123',
                    content: 'First user message',
                    contentChunks: null,
                    role: 'user',
                    createdAt: '2025-09-19T16:18:19.000Z', // EARLIEST
                    reaction: 'neutral',
                    reactionDetail: null,
                    reactionComment: null,
                    preference: null,
                    preferenceOver: null,
                    context: null,
                    canvas: [],
                    quotes: [],
                    files: []
                },
                {
                    id: 'msg-2',
                    version: 0,
                    chatId: 'chat-123',
                    content: 'Second message',
                    contentChunks: null,
                    role: 'assistant',
                    createdAt: '2025-09-19T16:18:20.000Z', // MIDDLE
                    reaction: 'neutral',
                    reactionDetail: null,
                    reactionComment: null,
                    preference: null,
                    preferenceOver: null,
                    context: null,
                    canvas: [],
                    quotes: [],
                    files: []
                }
            ];

            const result = LeChatConverter.convertChat(chat);

            // Title should be from first USER message chronologically
            expect(result.title).toBe('First user message');

            // Messages should be sorted chronologically
            expect(result.messages).toHaveLength(3);
            expect(result.messages[0].id).toBe('msg-1'); // Earliest
            expect(result.messages[1].id).toBe('msg-2'); // Middle
            expect(result.messages[2].id).toBe('msg-3'); // Latest
        });
    });

    describe('convertMessages', () => {
        it('should filter out tool calls from messages', () => {
            const chat: LeChatConversation = [
                {
                    id: 'msg-1',
                    version: 0,
                    chatId: 'chat-123',
                    content: 'Search for information about AI',
                    contentChunks: [
                        {
                            type: 'text',
                            text: 'Search for information about AI'
                        },
                        {
                            type: 'tool_call',
                            name: 'web_search',
                            publicArguments: 'artificial intelligence',
                            isDone: true,
                            success: true,
                            toolType: 'rag'
                        }
                    ],
                    role: 'assistant',
                    createdAt: '2025-09-19T16:18:19.236Z',
                    reaction: 'neutral',
                    reactionDetail: null,
                    reactionComment: null,
                    preference: null,
                    preferenceOver: null,
                    context: null,
                    canvas: [],
                    quotes: [],
                    files: []
                }
            ];

            const result = LeChatConverter.convertMessages(chat);

            expect(result).toHaveLength(1);
            expect(result[0].content).toContain('Search for information about AI');
            // Tool calls should be filtered out (not displayed to users)
            expect(result[0].content).not.toContain('🔍');
            expect(result[0].content).not.toContain('web_search');
            expect(result[0].content).not.toContain('artificial intelligence');
        });

        it('should convert messages with file attachments', () => {
            const chat: LeChatConversation = [
                {
                    id: 'msg-1',
                    version: 0,
                    chatId: 'chat-123',
                    content: 'Here is an image',
                    contentChunks: null,
                    role: 'user',
                    createdAt: '2025-09-19T16:18:19.236Z',
                    reaction: 'neutral',
                    reactionDetail: null,
                    reactionComment: null,
                    preference: null,
                    preferenceOver: null,
                    context: null,
                    canvas: [],
                    quotes: [],
                    files: [
                        {
                            type: 'image',
                            name: 'test-image.png'
                        }
                    ]
                }
            ];

            const result = LeChatConverter.convertMessages(chat);

            expect(result).toHaveLength(1);
            expect(result[0].attachments).toHaveLength(1);
            expect(result[0].attachments[0].fileName).toBe('test-image.png');
            expect(result[0].attachments[0].fileType).toBe('image/*');
        });

        it('should handle messages with references', () => {
            const chat: LeChatConversation = [
                {
                    id: 'msg-1',
                    version: 0,
                    chatId: 'chat-123',
                    content: 'According to sources',
                    contentChunks: [
                        {
                            type: 'text',
                            text: 'According to sources'
                        },
                        {
                            type: 'reference',
                            referenceIds: [1, 2, 3]
                        }
                    ],
                    role: 'assistant',
                    createdAt: '2025-09-19T16:18:19.236Z',
                    reaction: 'neutral',
                    reactionDetail: null,
                    reactionComment: null,
                    preference: null,
                    preferenceOver: null,
                    context: null,
                    canvas: [],
                    quotes: [],
                    files: []
                }
            ];

            const result = LeChatConverter.convertMessages(chat);

            expect(result).toHaveLength(1);
            expect(result[0].content).toContain('[^1][^2][^3]');
        });
    });
});

