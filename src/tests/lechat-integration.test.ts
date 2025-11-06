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
import JSZip from 'jszip';
import * as fs from 'fs';
import * as path from 'path';
import { LeChatConverter } from '../providers/lechat/lechat-converter';

/**
 * Integration test for Le Chat provider
 * 
 * Tests the complete workflow with the real sample export file
 */
describe('Le Chat Integration Test', () => {
    const zipPath = path.join(__dirname, '../../local_resources/le_chat/chat-export-1760124530481.zip');

    it('should load and parse the sample Le Chat export', async () => {
        // Check if file exists
        if (!fs.existsSync(zipPath)) {
            console.warn(`Skipping integration test: ${zipPath} not found`);
            return;
        }

        // Load ZIP file
        const zipBuffer = fs.readFileSync(zipPath);
        const zip = await JSZip.loadAsync(zipBuffer);

        // Find all chat-{uuid}.json files
        const fileNames = Object.keys(zip.files);
        const chatFiles = fileNames.filter(name => name.match(/^chat-[a-f0-9-]+\.json$/));

        expect(chatFiles.length).toBeGreaterThan(0);
        console.log(`Found ${chatFiles.length} conversation files`);

        // Load first conversation
        const firstFile = zip.file(chatFiles[0]);
        expect(firstFile).toBeTruthy();

        if (firstFile) {
            const content = await firstFile.async('string');
            const conversation = JSON.parse(content);

            // Verify Le Chat structure
            expect(Array.isArray(conversation)).toBe(true);
            expect(conversation.length).toBeGreaterThan(0);
            expect(conversation[0]).toHaveProperty('chatId');
            expect(conversation[0]).toHaveProperty('contentChunks');
            expect(conversation[0]).toHaveProperty('createdAt');
            expect(conversation[0]).toHaveProperty('role');

            console.log(`First conversation has ${conversation.length} messages`);
            console.log(`Chat ID: ${conversation[0].chatId}`);
        }
    });

    it('should convert Le Chat conversations to StandardConversation', async () => {
        if (!fs.existsSync(zipPath)) {
            console.warn(`Skipping integration test: ${zipPath} not found`);
            return;
        }

        const zipBuffer = fs.readFileSync(zipPath);
        const zip = await JSZip.loadAsync(zipBuffer);

        const fileNames = Object.keys(zip.files);
        const chatFiles = fileNames.filter(name => name.match(/^chat-[a-f0-9-]+\.json$/));

        // Convert first conversation
        const firstFile = zip.file(chatFiles[0]);
        if (firstFile) {
            const content = await firstFile.async('string');
            const leChatConversation = JSON.parse(content);

            // Convert to standard format
            const standardConversation = LeChatConverter.convertChat(leChatConversation);

            // Verify conversion
            expect(standardConversation).toHaveProperty('id');
            expect(standardConversation).toHaveProperty('title');
            expect(standardConversation).toHaveProperty('createTime');
            expect(standardConversation).toHaveProperty('updateTime');
            expect(standardConversation).toHaveProperty('messages');
            expect(Array.isArray(standardConversation.messages)).toBe(true);

            console.log(`Converted conversation:`);
            console.log(`  ID: ${standardConversation.id}`);
            console.log(`  Title: ${standardConversation.title}`);
            console.log(`  Messages: ${standardConversation.messages.length}`);
        }
    });

    it('should detect Le Chat format structure', async () => {
        if (!fs.existsSync(zipPath)) {
            console.warn(`Skipping integration test: ${zipPath} not found`);
            return;
        }

        const zipBuffer = fs.readFileSync(zipPath);
        const zip = await JSZip.loadAsync(zipBuffer);

        const fileNames = Object.keys(zip.files);
        const chatFiles = fileNames.filter(name => name.match(/^chat-[a-f0-9-]+\.json$/));

        // Load all conversations
        const conversations: any[] = [];
        for (const fileName of chatFiles) {
            const file = zip.file(fileName);
            if (file) {
                const content = await file.async('string');
                conversations.push(JSON.parse(content));
            }
        }

        // Verify Le Chat structure
        expect(conversations.length).toBeGreaterThan(0);

        const firstConv = conversations[0];
        expect(Array.isArray(firstConv)).toBe(true);
        expect(firstConv[0]).toHaveProperty('chatId');
        expect(firstConv[0]).toHaveProperty('contentChunks');

        console.log(`Le Chat format verified`);
        console.log(`Total conversations: ${conversations.length}`);
    });
});

