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

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LeChatReportNamingStrategy } from './lechat-report-naming';
import { LeChatConversation } from './lechat-types';

describe('LeChatReportNamingStrategy', () => {
    let strategy: LeChatReportNamingStrategy;

    beforeEach(() => {
        strategy = new LeChatReportNamingStrategy();
        
        // Mock current date to 2025-04-25
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2025-04-25T12:00:00Z'));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('extractReportPrefix', () => {
        it('should extract date from Le Chat ZIP filename with timestamp', () => {
            // Timestamp: 1760124530481 = 2025-10-10 (approximately)
            const zipFileName = 'chat-export-1760124530481.zip';
            const result = strategy.extractReportPrefix(zipFileName);

            // Should contain import date (2025.04.25) and archive date from timestamp
            expect(result).toContain('imported-2025.04.25');
            expect(result).toContain('archive-');
        });

        it('should handle timestamp in milliseconds', () => {
            // Known timestamp: 1609459200000 = 2021-01-01 00:00:00 UTC
            const zipFileName = 'chat-export-1609459200000.zip';
            const result = strategy.extractReportPrefix(zipFileName);

            expect(result).toContain('imported-2025.04.25');
            expect(result).toContain('archive-2021.01.01');
        });

        it('should fallback to current date if no timestamp found', () => {
            const zipFileName = 'invalid-filename.zip';
            const result = strategy.extractReportPrefix(zipFileName);

            // Both dates should be current date
            expect(result).toBe('imported-2025.04.25-archive-2025.04.25');
        });

        it('should handle various ZIP filename formats', () => {
            const validNames = [
                'chat-export-1234567890123.zip',
                'chat-export-9876543210.zip',
                'prefix-chat-export-1234567890123-suffix.zip'
            ];

            validNames.forEach(name => {
                const result = strategy.extractReportPrefix(name);
                expect(result).toContain('imported-');
                expect(result).toContain('archive-');
            });
        });
    });

    describe('getProviderName', () => {
        it('should return "lechat"', () => {
            expect(strategy.getProviderName()).toBe('lechat');
        });
    });

    describe('getProviderSpecificColumn', () => {
        it('should return Attachments column configuration', () => {
            const column = strategy.getProviderSpecificColumn();

            expect(column.header).toBe('Attachments');
            expect(typeof column.getValue).toBe('function');
        });

        it('should count file attachments in conversation', () => {
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
                            id: 'file-1',
                            name: 'image.png',
                            type: 'image',
                            size: 12345
                        }
                    ]
                },
                {
                    id: 'msg-2',
                    version: 0,
                    chatId: 'chat-123',
                    content: 'Here are two documents',
                    contentChunks: null,
                    role: 'user',
                    createdAt: '2025-09-19T16:20:00.000Z',
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
                            id: 'file-2',
                            name: 'document1.pdf',
                            type: 'document',
                            size: 54321
                        },
                        {
                            id: 'file-3',
                            name: 'document2.docx',
                            type: 'document',
                            size: 98765
                        }
                    ]
                }
            ];

            const column = strategy.getProviderSpecificColumn();
            const count = column.getValue(null, chat);

            expect(count).toBe(3); // 1 image + 2 documents
        });

        it('should return 0 for conversation without attachments', () => {
            const chat: LeChatConversation = [
                {
                    id: 'msg-1',
                    version: 0,
                    chatId: 'chat-123',
                    content: 'Simple message',
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

            const column = strategy.getProviderSpecificColumn();
            const count = column.getValue(null, chat);

            expect(count).toBe(0);
        });

        it('should handle invalid conversation format', () => {
            const column = strategy.getProviderSpecificColumn();
            const count = column.getValue(null, null);

            expect(count).toBe(0);
        });
    });
});

