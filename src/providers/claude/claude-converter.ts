// src/providers/claude/claude-converter.ts
import { StandardConversation, StandardMessage, StandardAttachment } from "../../types/standard";
import { ClaudeConversation, ClaudeMessage, ClaudeContentBlock } from "./claude-types";
import type NexusAiChatImporterPlugin from "../../main";

export class ClaudeConverter {
    private static plugin: NexusAiChatImporterPlugin;

    static setPlugin(plugin: NexusAiChatImporterPlugin) {
        this.plugin = plugin;
    }

    static async convertChat(chat: ClaudeConversation): Promise<StandardConversation> {
        const createTime = chat.created_at ? Math.floor(new Date(chat.created_at).getTime() / 1000) : 0;
        const messages = await this.convertMessages(chat.chat_messages, chat.uuid, chat.name, createTime);

        return {
            id: chat.uuid,
            title: chat.name || "Untitled",
            createTime: chat.created_at ? Math.floor(new Date(chat.created_at).getTime() / 1000) : 0,
            updateTime: chat.updated_at ? Math.floor(new Date(chat.updated_at).getTime() / 1000) : 0,
            messages: messages,
            provider: "claude",
            conversationUrl: `https://claude.ai/chat/${chat.uuid}`,
            model: chat.model || "claude-3",
            summary: chat.summary || ""
        };
    }

    static async convertMessages(messages: ClaudeMessage[], conversationId?: string, conversationTitle?: string, conversationCreateTime?: number): Promise<StandardMessage[]> {
        const standardMessages: StandardMessage[] = [];

        if (!messages || messages.length === 0) {
            return standardMessages;
        }

        for (const message of messages) {
            if (!this.shouldIncludeMessage(message)) {
                continue;
            }

            // Process content blocks to create message text and attachments
            const { text, attachments } = await this.processContentBlocks(message.content, conversationId, conversationTitle, conversationCreateTime);
            
            // Add file attachments
            const fileAttachments = this.processFileAttachments(message.files);
            
            const standardMessage: StandardMessage = {
                id: message.uuid,
                role: message.sender === 'human' ? 'user' : 'assistant',
                content: text || message.text || "",
                timestamp: Math.floor(new Date(message.created_at).getTime() / 1000),
                attachments: [...attachments, ...fileAttachments]
            };

            standardMessages.push(standardMessage);
        }
        
        return standardMessages;
    }

    private static shouldIncludeMessage(message: ClaudeMessage): boolean {
        // Include all human and assistant messages
        if (message.sender === 'human' || message.sender === 'assistant') {
            // Skip empty messages
            if (!message.text && (!message.content || message.content.length === 0)) {
                return false;
            }
            return true;
        }
        
        return false;
    }

    private static async processContentBlocks(contentBlocks: ClaudeContentBlock[], conversationId?: string, conversationTitle?: string, conversationCreateTime?: number): Promise<{ text: string; attachments: StandardAttachment[] }> {
        const textParts: string[] = [];
        const attachments: StandardAttachment[] = [];
        const artifactMap = new Map<string, any>(); // Track artifacts by ID to handle duplicates

        // Handle empty or null content blocks
        if (!contentBlocks || contentBlocks.length === 0) {
            return { text: "", attachments: [] };
        }

        // First pass: collect all artifacts and keep the most complete version
        for (const block of contentBlocks) {
            if (block.type === 'tool_use' && block.name === 'artifacts' && block.input) {
                const artifactId = block.input.id || 'unknown';
                const content = block.input.content || '';

                // Keep the artifact with the longest content (most complete)
                if (!artifactMap.has(artifactId) || content.length > (artifactMap.get(artifactId).content || '').length) {
                    artifactMap.set(artifactId, block.input);
                }
            }
        }

        // Second pass: process all content blocks
        for (const block of contentBlocks) {
            switch (block.type) {
                case 'text':
                    if (block.text) {
                        textParts.push(block.text);
                    }
                    break;

                case 'thinking':
                    // Filter out thinking blocks - not useful for users
                    break;

                case 'tool_use':
                    // Special handling for artifacts
                    if (block.name === 'artifacts' && block.input) {
                        const artifactId = block.input.id || 'unknown';
                        // Only process if this is the most complete version of this artifact
                        if (artifactMap.get(artifactId) === block.input) {
                            const artifact = await this.formatArtifact(block.input, conversationId, conversationTitle, conversationCreateTime);
                            textParts.push(artifact);
                        }
                    } else if (block.name === 'web_search') {
                        // Filter out web_search tools - not useful for users
                        break;
                    } else if (block.name && block.input) {
                        // Other tools (keep for now, can be filtered later if needed)
                        const code = block.input.code || JSON.stringify(block.input, null, 2);
                        textParts.push(`**[Tool: ${block.name}]**\n\`\`\`\n${code}\n\`\`\``);
                    }
                    break;

                case 'tool_result':
                    // Filter out all tool results - not useful for users
                    break;
            }
        }

        return {
            text: textParts.join('\n\n'),
            attachments
        };
    }

    private static processFileAttachments(files: any[]): StandardAttachment[] {
        const attachments: StandardAttachment[] = [];
        
        // Handle empty or null files array
        if (!files || files.length === 0) {
            return attachments;
        }
        
        for (const file of files) {
            if (file && file.file_name) {
                attachments.push({
                    fileName: file.file_name,
                    fileSize: 0, // Size not provided in Claude export
                    fileType: this.getFileTypeFromName(file.file_name),
                    fileId: file.file_name, // Use filename as ID
                    extractedContent: ""
                });
            }
        }
        
        return attachments;
    }

    private static getFileTypeFromName(fileName: string): string {
        const extension = fileName.split('.').pop()?.toLowerCase();

        switch (extension) {
            case 'png':
            case 'jpg':
            case 'jpeg':
            case 'gif':
            case 'webp':
                return `image/${extension}`;
            case 'pdf':
                return 'application/pdf';
            case 'txt':
                return 'text/plain';
            case 'md':
                return 'text/markdown';
            case 'json':
                return 'application/json';
            default:
                return 'application/octet-stream';
        }
    }

    /**
     * Format Claude artifacts as links to separate files only
     */
    private static async formatArtifact(artifactInput: any, conversationId?: string, conversationTitle?: string, conversationCreateTime?: number): Promise<string> {
        const title = artifactInput.title || 'Untitled Artifact';
        let language = artifactInput.language || 'text';
        const command = artifactInput.command || 'create';
        const artifactId = artifactInput.id || 'unknown';
        const content = artifactInput.content || '';

        // Auto-detect language if marked as "text" but content suggests otherwise
        if (language.toLowerCase() === 'text' && content) {
            const detectedLanguage = this.detectLanguageFromContent(content);
            if (detectedLanguage !== 'text') {
                language = detectedLanguage;
            }
        }

        let formattedContent = `<div class="nexus-artifact-box">\n\n**🎨 Artifact: ${title}**\n\n`;

        if (command === 'edit') {
            formattedContent += `*[Artifact edited]*\n\n`;
        }

        // Add metadata with detected language
        formattedContent += `> **Language:** ${language}`;
        if (artifactInput.language !== language) {
            formattedContent += ` (detected from content, original: ${artifactInput.language})`;
        }
        formattedContent += `\n`;
        formattedContent += `> **Type:** ${artifactInput.type || 'code'}\n`;
        formattedContent += `> **ID:** ${artifactId}\n\n`;

        // Save artifact to file and link to it
        if (content && this.plugin) {
            try {
                const filePath = await this.saveArtifactToFile(artifactId, title, language, content, conversationId, conversationTitle, conversationCreateTime);
                formattedContent += `📎 **[View Artifact](${filePath})**\n\n`;
            } catch (error) {
                formattedContent += `❌ **Error saving artifact:** ${error instanceof Error ? error.message : 'Unknown error'}\n\n`;
            }
        }

        formattedContent += `</div>\n\n`;
        return formattedContent;
    }

    /**
     * Save artifact as markdown note in attachments/artifacts/ folder
     */
    private static async saveArtifactToFile(artifactId: string, title: string, language: string, content: string, conversationId?: string, conversationTitle?: string, conversationCreateTime?: number): Promise<string> {
        const safeTitle = title.replace(/[^a-zA-Z0-9\-_]/g, '_');
        const fileName = `${safeTitle}_${artifactId}.md`;

        const artifactFolder = `${this.plugin.settings.attachmentFolder}/claude/artifacts`;

        // Ensure folder exists
        const { ensureFolderExists } = await import("../../utils");
        const folderResult = await ensureFolderExists(artifactFolder, this.plugin.app.vault);
        if (!folderResult.success) {
            throw new Error(`Failed to create artifacts folder: ${folderResult.error}`);
        }

        const filePath = `${artifactFolder}/${fileName}`;

        // Generate conversation link with proper path if conversationId and title are provided
        let conversationLink = '';
        if (conversationId && conversationTitle && conversationCreateTime) {
            const createDate = new Date(conversationCreateTime * 1000);
            const year = createDate.getFullYear();
            const month = String(createDate.getMonth() + 1).padStart(2, '0');
            const { generateFileName } = await import("../../utils");
            const safeTitle = generateFileName(conversationTitle);

            // Use absolute path from vault root
            const conversationPath = `${this.plugin.settings.archiveFolder}/claude/${year}/${month}/${safeTitle}`;
            conversationLink = `[[${conversationPath}|${conversationTitle}]]`;
        }

        // Create markdown content with enhanced frontmatter
        let markdownContent = `---
nexus: nexus-ai-chat-importer
plugin_version: ${this.plugin.manifest.version}
provider: claude
aliases: ["${title}", "${artifactId}"]
conversation_id: ${conversationId || 'unknown'}
format: ${language}
---

# ${title}

**Type:** Claude Artifact
**Language:** ${language}
**ID:** ${artifactId}`;

        if (conversationLink) {
            markdownContent += `
**Conversation:** ${conversationLink}`;
        }

        markdownContent += `\n\n## Content\n\n`;

        // Add content based on language
        if (language.toLowerCase() === 'markdown') {
            // For markdown, include content directly
            markdownContent += content;
        } else {
            // For other languages, use code blocks
            markdownContent += `\`\`\`${language}\n${content}\n\`\`\``;
        }

        // Save the artifact as markdown
        await this.plugin.app.vault.create(filePath, markdownContent);

        return filePath;
    }

    /**
     * Auto-detect language from content when marked as "text"
     */
    private static detectLanguageFromContent(content: string): string {
        if (!content || content.trim().length === 0) return 'text';

        const trimmedContent = content.trim();

        // Check for common patterns
        if (trimmedContent.startsWith('<?php')) return 'php';
        if (trimmedContent.startsWith('#!/bin/bash') || trimmedContent.startsWith('#!/bin/sh')) return 'bash';
        if (trimmedContent.startsWith('<!DOCTYPE html') || trimmedContent.includes('<html')) return 'html';
        if (trimmedContent.startsWith('{') && trimmedContent.endsWith('}')) {
            try {
                JSON.parse(trimmedContent);
                return 'json';
            } catch {}
        }

        // Check for markdown patterns
        if (trimmedContent.includes('# ') || trimmedContent.includes('## ') ||
            trimmedContent.includes('**') || trimmedContent.includes('```')) {
            return 'markdown';
        }

        // Check for Python patterns
        if (trimmedContent.includes('def ') || trimmedContent.includes('import ') ||
            trimmedContent.includes('from ') || trimmedContent.includes('class ')) {
            return 'python';
        }

        // Check for JavaScript patterns
        if (trimmedContent.includes('function ') || trimmedContent.includes('const ') ||
            trimmedContent.includes('let ') || trimmedContent.includes('var ') ||
            trimmedContent.includes('=>')) {
            return 'javascript';
        }

        // Check for CSS patterns
        if (trimmedContent.includes('{') && trimmedContent.includes(':') &&
            trimmedContent.includes(';') && trimmedContent.includes('}')) {
            return 'css';
        }

        // Check for SQL patterns
        if (trimmedContent.toUpperCase().includes('SELECT ') ||
            trimmedContent.toUpperCase().includes('INSERT ') ||
            trimmedContent.toUpperCase().includes('UPDATE ') ||
            trimmedContent.toUpperCase().includes('CREATE TABLE')) {
            return 'sql';
        }

        return 'text';
    }

    /**
     * Get file extension from language
     */
    private static getExtensionFromLanguage(language: string): string {
        switch (language.toLowerCase()) {
            case 'python': return 'py';
            case 'javascript': return 'js';
            case 'typescript': return 'ts';
            case 'html': return 'html';
            case 'css': return 'css';
            case 'markdown': return 'md';
            case 'json': return 'json';
            case 'yaml': return 'yml';
            case 'xml': return 'xml';
            case 'sql': return 'sql';
            case 'bash': return 'sh';
            case 'shell': return 'sh';
            case 'php': return 'php';
            default: return 'txt';
        }
    }

    /**
     * Count artifacts in a conversation
     */
    static countArtifacts(chat: ClaudeConversation): number {
        let artifactCount = 0;

        for (const message of chat.chat_messages) {
            if (message.content) {
                for (const block of message.content) {
                    if (block.type === 'tool_use' && block.name === 'artifacts') {
                        artifactCount++;
                    }
                }
            }
        }

        return artifactCount;
    }
}
