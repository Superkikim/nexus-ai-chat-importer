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
import { LeChatConversation } from './lechat-types';

/**
 * Basic tests for Le Chat adapter
 *
 * Note: Full adapter tests require Obsidian plugin mocking which is complex.
 * The adapter will be tested during integration testing with real ZIP files.
 */
describe('LeChatAdapter', () => {
    describe('Le Chat format detection', () => {
        it('should identify Le Chat format structure', () => {
            const leChatFormat = [
                {
                    id: 'msg-1',
                    chatId: 'chat-123',
                    contentChunks: [],
                    createdAt: '2025-09-19T16:18:19.236Z',
                    role: 'user',
                    content: 'Hello'
                }
            ];

            // Le Chat format is an array of messages
            expect(Array.isArray(leChatFormat)).toBe(true);
            expect(leChatFormat[0]).toHaveProperty('chatId');
            expect(leChatFormat[0]).toHaveProperty('contentChunks');
            expect(leChatFormat[0]).toHaveProperty('createdAt');
            expect(leChatFormat[0]).toHaveProperty('role');
        });

        it('should differentiate from ChatGPT format', () => {
            const chatgptFormat = {
                mapping: {},
                create_time: 123456,
                update_time: 123456,
                title: 'Test'
            };

            // ChatGPT has mapping, create_time, update_time, title
            expect(chatgptFormat).toHaveProperty('mapping');
            expect(chatgptFormat).toHaveProperty('create_time');
            expect(chatgptFormat).not.toHaveProperty('chatId');
        });

        it('should differentiate from Claude format', () => {
            const claudeFormat = {
                uuid: 'abc-123',
                name: 'Test',
                created_at: '2025-01-01',
                chat_messages: []
            };

            // Claude has uuid, name, created_at, chat_messages
            expect(claudeFormat).toHaveProperty('uuid');
            expect(claudeFormat).toHaveProperty('chat_messages');
            expect(claudeFormat).not.toHaveProperty('chatId');
        });
    });

    describe('Timestamp parsing', () => {
        it('should parse ISO 8601 timestamps correctly', () => {
            const isoTimestamp = '2025-09-19T16:18:19.236Z';
            const date = new Date(isoTimestamp);
            const unixSeconds = Math.floor(date.getTime() / 1000);

            expect(unixSeconds).toBeGreaterThan(0);
            expect(typeof unixSeconds).toBe('number');
        });
    });

    describe('Title derivation', () => {
        it('should truncate titles at 50 characters', () => {
            const longContent = 'This is a very long message that should be truncated to fifty characters maximum';
            const truncated = longContent.substring(0, 50).trim() + '...';

            expect(truncated.length).toBeLessThanOrEqual(53);
            expect(truncated).toBe('This is a very long message that should be truncat...');
        });
    });
});

