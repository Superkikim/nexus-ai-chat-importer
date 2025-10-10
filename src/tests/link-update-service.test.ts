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


// src/tests/link-update-service.test.ts
// Simple test to verify link update patterns work correctly

import { LinkUpdateService } from "../services/link-update-service";

/**
 * Test the regex patterns used for link updates
 */
export class LinkUpdateServiceTest {
    
    /**
     * Test attachment link patterns
     */
    static testAttachmentLinkPatterns(): void {
        console.log("Testing attachment link patterns...");
        
        const oldPath = "Nexus/Attachments";
        const newPath = "NewFolder/Attachments";
        
        // Test cases for different link formats
        const testCases = [
            {
                name: "Markdown image link",
                input: `![image](${oldPath}/chatgpt/images/test.png)`,
                expected: `![image](${newPath}/chatgpt/images/test.png)`
            },
            {
                name: "Markdown file link", 
                input: `[document](${oldPath}/claude/documents/file.pdf)`,
                expected: `[document](${newPath}/claude/documents/file.pdf)`
            },
            {
                name: "Obsidian image embed",
                input: `![[${oldPath}/chatgpt/images/screenshot.jpg]]`,
                expected: `![[${newPath}/chatgpt/images/screenshot.jpg]]`
            },
            {
                name: "Obsidian file link",
                input: `[[${oldPath}/claude/artifacts/conv123/artifact_v1.md]]`,
                expected: `[[${newPath}/claude/artifacts/conv123/artifact_v1.md]]`
            }
        ];
        
        testCases.forEach(testCase => {
            const result = this.simulateAttachmentLinkUpdate(testCase.input, oldPath, newPath);
            const passed = result === testCase.expected;
            console.log(`  ${testCase.name}: ${passed ? '✅ PASS' : '❌ FAIL'}`);
            if (!passed) {
                console.log(`    Expected: ${testCase.expected}`);
                console.log(`    Got:      ${result}`);
            }
        });
    }
    
    /**
     * Test conversation link patterns
     */
    static testConversationLinkPatterns(): void {
        console.log("Testing conversation link patterns...");
        
        const oldPath = "Nexus/Conversations";
        const newPath = "NewFolder/Conversations";
        
        // Test cases for conversation links in reports
        const testCases = [
            {
                name: "Obsidian link with alias",
                input: `[[${oldPath}/chatgpt/2024/01/conversation.md|Chat Title]]`,
                expected: `[[${newPath}/chatgpt/2024/01/conversation.md|Chat Title]]`
            },
            {
                name: "Simple Obsidian link",
                input: `[[${oldPath}/claude/2024/02/another-chat.md]]`,
                expected: `[[${newPath}/claude/2024/02/another-chat.md]]`
            },
            {
                name: "Multiple links in one line",
                input: `Links: [[${oldPath}/chatgpt/2024/01/chat1.md|First]] and [[${oldPath}/claude/2024/01/chat2.md|Second]]`,
                expected: `Links: [[${newPath}/chatgpt/2024/01/chat1.md|First]] and [[${newPath}/claude/2024/01/chat2.md|Second]]`
            }
        ];
        
        testCases.forEach(testCase => {
            const result = this.simulateConversationLinkUpdate(testCase.input, oldPath, newPath);
            const passed = result === testCase.expected;
            console.log(`  ${testCase.name}: ${passed ? '✅ PASS' : '❌ FAIL'}`);
            if (!passed) {
                console.log(`    Expected: ${testCase.expected}`);
                console.log(`    Got:      ${result}`);
            }
        });
    }
    
    /**
     * Simulate attachment link update logic
     */
    private static simulateAttachmentLinkUpdate(content: string, oldPath: string, newPath: string): string {
        let updatedContent = content;
        
        // Escape special regex characters in paths
        const escapedOldPath = oldPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        
        // Pattern 1: Markdown image links ![alt](path)
        const imagePattern = new RegExp(`(!\\[[^\\]]*\\]\\()${escapedOldPath}(/[^)]+\\))`, 'g');
        updatedContent = updatedContent.replace(imagePattern, (match, prefix, suffix) => {
            return `${prefix}${newPath}${suffix}`;
        });

        // Pattern 2: Markdown file links [text](path)
        const linkPattern = new RegExp(`(\\[[^\\]]*\\]\\()${escapedOldPath}(/[^)]+\\))`, 'g');
        updatedContent = updatedContent.replace(linkPattern, (match, prefix, suffix) => {
            return `${prefix}${newPath}${suffix}`;
        });

        // Pattern 3: Obsidian image embeds ![[path]]
        const obsidianImagePattern = new RegExp(`(!\\[\\[)${escapedOldPath}(/[^\\]]+\\]\\])`, 'g');
        updatedContent = updatedContent.replace(obsidianImagePattern, (match, prefix, suffix) => {
            return `${prefix}${newPath}${suffix}`;
        });

        // Pattern 4: Obsidian file links [[path]]
        const obsidianLinkPattern = new RegExp(`(\\[\\[)${escapedOldPath}(/[^\\]]+\\]\\])`, 'g');
        updatedContent = updatedContent.replace(obsidianLinkPattern, (match, prefix, suffix) => {
            return `${prefix}${newPath}${suffix}`;
        });
        
        return updatedContent;
    }
    
    /**
     * Simulate conversation link update logic
     */
    private static simulateConversationLinkUpdate(content: string, oldPath: string, newPath: string): string {
        let updatedContent = content;
        
        // Escape special regex characters in paths
        const escapedOldPath = oldPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        
        // Pattern: Obsidian links with aliases [[path|title]]
        const linkWithAliasPattern = new RegExp(`(\\[\\[)${escapedOldPath}(/[^|\\]]+)(\\|[^\\]]+\\]\\])`, 'g');
        updatedContent = updatedContent.replace(linkWithAliasPattern, (match, prefix, pathSuffix, aliasSuffix) => {
            return `${prefix}${newPath}${pathSuffix}${aliasSuffix}`;
        });

        // Pattern: Simple Obsidian links [[path]]
        const simpleLinkPattern = new RegExp(`(\\[\\[)${escapedOldPath}(/[^\\]]+\\]\\])`, 'g');
        updatedContent = updatedContent.replace(simpleLinkPattern, (match, prefix, suffix) => {
            return `${prefix}${newPath}${suffix}`;
        });
        
        return updatedContent;
    }
    
    /**
     * Run all tests
     */
    static runAllTests(): void {
        console.log("🧪 Running Link Update Service Tests");
        console.log("=====================================");
        
        this.testAttachmentLinkPatterns();
        console.log("");
        this.testConversationLinkPatterns();
        
        console.log("");
        console.log("✅ All tests completed!");
    }
}

// Export for potential use in development
if (typeof window !== 'undefined') {
    (window as any).LinkUpdateServiceTest = LinkUpdateServiceTest;
}
