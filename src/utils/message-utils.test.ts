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


// src/utils/message-utils.test.ts
import { describe, it, expect } from 'vitest';
import { 
    sortMessagesByTimestamp, 
    isValidMessage, 
    filterValidMessages,
    countMessagesByRole 
} from './message-utils';
import { StandardMessage } from '../types/standard';

describe('sortMessagesByTimestamp', () => {
    it('should return empty array for empty input', () => {
        const result = sortMessagesByTimestamp([]);
        expect(result).toEqual([]);
    });

    it('should return same array for single message', () => {
        const messages: StandardMessage[] = [
            { id: 'msg-1', timestamp: 1000, role: 'user', content: 'Hello' }
        ];
        const result = sortMessagesByTimestamp(messages);
        expect(result).toEqual(messages);
    });

    it('should sort messages by timestamp ascending', () => {
        const messages: StandardMessage[] = [
            { id: 'msg-3', timestamp: 1500, role: 'assistant', content: 'Third' },
            { id: 'msg-1', timestamp: 500, role: 'user', content: 'First' },
            { id: 'msg-2', timestamp: 1000, role: 'user', content: 'Second' }
        ];
        
        const sorted = sortMessagesByTimestamp(messages);
        
        expect(sorted[0].id).toBe('msg-1');
        expect(sorted[0].timestamp).toBe(500);
        expect(sorted[1].id).toBe('msg-2');
        expect(sorted[1].timestamp).toBe(1000);
        expect(sorted[2].id).toBe('msg-3');
        expect(sorted[2].timestamp).toBe(1500);
    });

    it('should use ID as secondary sort for same timestamp', () => {
        const messages: StandardMessage[] = [
            { id: 'msg-c', timestamp: 1000, role: 'assistant', content: 'C' },
            { id: 'msg-a', timestamp: 1000, role: 'user', content: 'A' },
            { id: 'msg-b', timestamp: 1000, role: 'user', content: 'B' }
        ];
        
        const sorted = sortMessagesByTimestamp(messages);
        
        expect(sorted[0].id).toBe('msg-a');
        expect(sorted[1].id).toBe('msg-b');
        expect(sorted[2].id).toBe('msg-c');
    });

    it('should handle mixed timestamps and IDs correctly', () => {
        const messages: StandardMessage[] = [
            { id: 'msg-z', timestamp: 2000, role: 'assistant', content: 'Last' },
            { id: 'msg-b', timestamp: 1000, role: 'user', content: 'Second B' },
            { id: 'msg-a', timestamp: 1000, role: 'user', content: 'Second A' },
            { id: 'msg-1', timestamp: 500, role: 'user', content: 'First' }
        ];
        
        const sorted = sortMessagesByTimestamp(messages);
        
        expect(sorted[0].id).toBe('msg-1');
        expect(sorted[1].id).toBe('msg-a');
        expect(sorted[2].id).toBe('msg-b');
        expect(sorted[3].id).toBe('msg-z');
    });
});

describe('isValidMessage', () => {
    it('should return true for valid message', () => {
        const message: StandardMessage = {
            id: 'msg-1',
            role: 'user',
            content: 'Hello',
            timestamp: 1000
        };
        expect(isValidMessage(message)).toBe(true);
    });

    it('should return true for valid message with attachments', () => {
        const message: StandardMessage = {
            id: 'msg-1',
            role: 'assistant',
            content: 'Response',
            timestamp: 2000,
            attachments: [{ fileName: 'test.png' }]
        };
        expect(isValidMessage(message)).toBe(true);
    });

    it('should return false for null', () => {
        expect(isValidMessage(null)).toBe(false);
    });

    it('should return false for undefined', () => {
        expect(isValidMessage(undefined)).toBe(false);
    });

    it('should return false for non-object', () => {
        expect(isValidMessage('string')).toBe(false);
        expect(isValidMessage(123)).toBe(false);
        expect(isValidMessage(true)).toBe(false);
    });

    it('should return false for missing id', () => {
        const message = {
            role: 'user',
            content: 'Hello',
            timestamp: 1000
        };
        expect(isValidMessage(message)).toBe(false);
    });

    it('should return false for empty id', () => {
        const message = {
            id: '',
            role: 'user',
            content: 'Hello',
            timestamp: 1000
        };
        expect(isValidMessage(message)).toBe(false);
    });

    it('should return false for invalid role', () => {
        const message = {
            id: 'msg-1',
            role: 'system',
            content: 'Hello',
            timestamp: 1000
        };
        expect(isValidMessage(message)).toBe(false);
    });

    it('should return false for missing content', () => {
        const message = {
            id: 'msg-1',
            role: 'user',
            timestamp: 1000
        };
        expect(isValidMessage(message)).toBe(false);
    });

    it('should return false for non-string content', () => {
        const message = {
            id: 'msg-1',
            role: 'user',
            content: 123,
            timestamp: 1000
        };
        expect(isValidMessage(message)).toBe(false);
    });

    it('should return false for missing timestamp', () => {
        const message = {
            id: 'msg-1',
            role: 'user',
            content: 'Hello'
        };
        expect(isValidMessage(message)).toBe(false);
    });

    it('should return false for negative timestamp', () => {
        const message = {
            id: 'msg-1',
            role: 'user',
            content: 'Hello',
            timestamp: -100
        };
        expect(isValidMessage(message)).toBe(false);
    });

    it('should return false for invalid attachments type', () => {
        const message = {
            id: 'msg-1',
            role: 'user',
            content: 'Hello',
            timestamp: 1000,
            attachments: 'not-an-array'
        };
        expect(isValidMessage(message)).toBe(false);
    });
});

describe('filterValidMessages', () => {
    it('should filter out invalid messages', () => {
        const messages = [
            { id: 'msg-1', role: 'user', content: 'Valid', timestamp: 1000 },
            { id: '', role: 'user', content: 'Invalid - empty id', timestamp: 2000 },
            { id: 'msg-2', role: 'assistant', content: 'Valid', timestamp: 3000 },
            { role: 'user', content: 'Invalid - no id', timestamp: 4000 },
            { id: 'msg-3', role: 'user', content: 'Valid', timestamp: 5000 }
        ];

        const valid = filterValidMessages(messages);

        expect(valid).toHaveLength(3);
        expect(valid[0].id).toBe('msg-1');
        expect(valid[1].id).toBe('msg-2');
        expect(valid[2].id).toBe('msg-3');
    });

    it('should return empty array for all invalid messages', () => {
        const messages = [
            { id: '', role: 'user', content: 'Invalid', timestamp: 1000 },
            { role: 'user', content: 'Invalid', timestamp: 2000 }
        ];

        const valid = filterValidMessages(messages);
        expect(valid).toEqual([]);
    });

    it('should return all messages if all valid', () => {
        const messages: StandardMessage[] = [
            { id: 'msg-1', role: 'user', content: 'Valid 1', timestamp: 1000 },
            { id: 'msg-2', role: 'assistant', content: 'Valid 2', timestamp: 2000 }
        ];

        const valid = filterValidMessages(messages);
        expect(valid).toEqual(messages);
    });
});

describe('countMessagesByRole', () => {
    it('should count messages by role correctly', () => {
        const messages: StandardMessage[] = [
            { id: 'msg-1', role: 'user', content: 'User 1', timestamp: 1000 },
            { id: 'msg-2', role: 'assistant', content: 'Assistant 1', timestamp: 2000 },
            { id: 'msg-3', role: 'user', content: 'User 2', timestamp: 3000 },
            { id: 'msg-4', role: 'assistant', content: 'Assistant 2', timestamp: 4000 },
            { id: 'msg-5', role: 'user', content: 'User 3', timestamp: 5000 }
        ];

        const counts = countMessagesByRole(messages);

        expect(counts.user).toBe(3);
        expect(counts.assistant).toBe(2);
    });

    it('should return zero counts for empty array', () => {
        const counts = countMessagesByRole([]);
        expect(counts.user).toBe(0);
        expect(counts.assistant).toBe(0);
    });

    it('should handle all user messages', () => {
        const messages: StandardMessage[] = [
            { id: 'msg-1', role: 'user', content: 'User 1', timestamp: 1000 },
            { id: 'msg-2', role: 'user', content: 'User 2', timestamp: 2000 }
        ];

        const counts = countMessagesByRole(messages);
        expect(counts.user).toBe(2);
        expect(counts.assistant).toBe(0);
    });

    it('should handle all assistant messages', () => {
        const messages: StandardMessage[] = [
            { id: 'msg-1', role: 'assistant', content: 'Assistant 1', timestamp: 1000 },
            { id: 'msg-2', role: 'assistant', content: 'Assistant 2', timestamp: 2000 }
        ];

        const counts = countMessagesByRole(messages);
        expect(counts.user).toBe(0);
        expect(counts.assistant).toBe(2);
    });
});

