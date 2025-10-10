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


// src/providers/claude/claude-converter.ts
import { StandardConversation, StandardMessage, StandardAttachment } from "../../types/standard";
import { ClaudeConversation, ClaudeMessage, ClaudeContentBlock } from "./claude-types";
import { generateSafeAlias } from "../../utils";
import type NexusAiChatImporterPlugin from "../../main";

export class ClaudeConverter {
    private static plugin: NexusAiChatImporterPlugin;

    // Nexus custom callouts with icons
    private static readonly CALLOUTS = {
        USER: 'nexus_user',      // 👤 User messages
        AGENT: 'nexus_agent',    // 🤖 Assistant/Agent messages
        ATTACHMENT: 'nexus_attachment', // 📎 Attachments
        ARTIFACT: 'nexus_artifact',     // 🛠️ Claude artifacts
        PROMPT: 'nexus_prompt'          // 💭 System prompts
    };

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
            chatUrl: `https://claude.ai/chat/${chat.uuid}`,
            metadata: {
                model: chat.model || "claude-3",
                summary: chat.summary || "",
                is_starred: chat.is_starred,
                current_leaf_message_uuid: chat.current_leaf_message_uuid,
                project_uuid: chat.project_uuid
            }
        };
    }

    static async convertMessages(messages: ClaudeMessage[], conversationId?: string, conversationTitle?: string, conversationCreateTime?: number): Promise<StandardMessage[]> {
        const standardMessages: StandardMessage[] = [];

        if (!messages || messages.length === 0) {
            return standardMessages;
        }

        // PHASE 1: Collect ALL artifacts from entire conversation
        const allArtifacts: Array<{artifact: any, messageIndex: number, blockIndex: number}> = [];

        for (let msgIndex = 0; msgIndex < messages.length; msgIndex++) {
            const message = messages[msgIndex];
            if (message.content) {
                for (let blockIndex = 0; blockIndex < message.content.length; blockIndex++) {
                    const block = message.content[blockIndex];
                    if (block.type === 'tool_use' && block.name === 'artifacts' && block.input) {
                        const command = block.input.command || 'create';
                        const versionUuid = block.input.version_uuid;

                        // Skip view commands only
                        if (command !== 'view' && versionUuid) {
                            allArtifacts.push({
                                artifact: block.input,
                                messageIndex: msgIndex,
                                blockIndex: blockIndex
                            });
                        }
                    }
                }
            }
        }

        // PHASE 2: Process ALL artifacts and create files
        const artifactVersionMap = await this.processAllArtifacts(allArtifacts, conversationId, conversationTitle, conversationCreateTime);

        // PHASE 3: Process messages and replace artifacts with links
        for (const message of messages) {
            if (!this.shouldIncludeMessage(message)) {
                continue;
            }

            // Process content blocks to create message text and attachments
            const { text, attachments } = await this.processContentBlocksForDisplay(
                message.content,
                artifactVersionMap,
                conversationId,
                conversationTitle,
                conversationCreateTime
            );
            
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

        // Sort messages by timestamp to maintain chronological order
        return this.sortMessagesByTimestamp(standardMessages);
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

    /**
     * Sort messages by timestamp with UUID as secondary sort for chronological order
     */
    private static sortMessagesByTimestamp(messages: StandardMessage[]): StandardMessage[] {
        if (messages.length <= 1) return messages;

        // Use native sort with proper comparison function
        return messages.sort((a, b) => {
            // Primary sort: timestamp
            if (a.timestamp !== b.timestamp) {
                return a.timestamp - b.timestamp;
            }

            // Secondary sort: UUID (lexicographic order for same timestamp)
            // This ensures consistent ordering when messages have identical timestamps
            return a.id.localeCompare(b.id);
        });
    }

    /**
     * Process ALL artifacts from entire conversation and create files
     */
    private static async processAllArtifacts(
        allArtifacts: Array<{artifact: any, messageIndex: number, blockIndex: number}>,
        conversationId?: string,
        conversationTitle?: string,
        conversationCreateTime?: number
    ): Promise<Map<string, {versionNumber: number, title: string}>> {

        const artifactVersionMap = new Map<string, {versionNumber: number, title: string}>();
        const versionCounters = new Map<string, number>();
        const artifactContents = new Map<string, string>();
        const artifactLanguages = new Map<string, string>(); // Track language per artifact ID

        this.plugin.logger.debug(`Claude converter: Processing ${allArtifacts.length} artifacts from entire conversation`);

        for (const {artifact} of allArtifacts) {
            const artifactId = artifact.id || 'unknown';
            const command = artifact.command || 'create';

            // Increment version number for this artifact ID
            const currentVersion = (versionCounters.get(artifactId) || 0) + 1;
            versionCounters.set(artifactId, currentVersion);

            let finalContent = '';

            if (command === 'create' || command === 'rewrite') {
                // Complete content provided - RESET cumulative content
                finalContent = artifact.content || '';
                artifactContents.set(artifactId, finalContent);

                // For create/rewrite: detect and store the language
                const detectedLanguage = this.detectLanguageFromContent(finalContent, artifact.type);
                artifactLanguages.set(artifactId, detectedLanguage);
            } else if (command === 'update') {
                // Apply update to PREVIOUS content
                const previousContent = artifactContents.get(artifactId) || '';

                if (artifact.old_str && artifact.new_str) {
                    // sed-like replacement on previous content
                    finalContent = previousContent.replace(artifact.old_str, artifact.new_str);
                } else if (artifact.content && artifact.content.length > 0) {
                    // Complete updated content provided
                    finalContent = artifact.content;
                } else {
                    // Empty update - keep previous content
                    finalContent = previousContent;
                }

                // Update cumulative content for next version
                artifactContents.set(artifactId, finalContent);
            }

            try {
                // Get stored language (from create/rewrite) or detect for this version
                const storedLanguage = artifactLanguages.get(artifactId);
                const languageToUse = storedLanguage || this.detectLanguageFromContent(finalContent, artifact.type);

                // Save this specific version
                await this.saveSingleArtifactVersionWithContent(
                    artifactId,
                    artifact,
                    currentVersion,
                    finalContent,
                    conversationId,
                    conversationTitle,
                    conversationCreateTime,
                    languageToUse
                );

                // Track version info for linking
                artifactVersionMap.set(artifact.version_uuid, {
                    versionNumber: currentVersion,
                    title: artifact.title || artifactId
                });

            } catch (error) {
                console.error(`Failed to save ${artifactId} v${currentVersion}:`, error);
            }
        }

        return artifactVersionMap;
    }

    /**
     * Process content blocks for display (with artifact links)
     */
    private static async processContentBlocksForDisplay(
        contentBlocks: ClaudeContentBlock[],
        artifactVersionMap: Map<string, {versionNumber: number, title: string}>,
        conversationId?: string,
        conversationTitle?: string,
        conversationCreateTime?: number
    ): Promise<{ text: string; attachments: StandardAttachment[] }> {
        const textParts: string[] = [];
        const attachments: StandardAttachment[] = [];

        // Handle empty or null content blocks
        if (!contentBlocks || contentBlocks.length === 0) {
            return { text: "", attachments: [] };
        }

        // Process content blocks for display
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
                    // Create specific artifact links
                    if (block.name === 'artifacts' && block.input) {
                        const command = block.input.command || 'create';
                        const versionUuid = block.input.version_uuid;

                        // Skip view commands
                        if (command === 'view') {
                            break;
                        }

                        if (versionUuid && artifactVersionMap.has(versionUuid)) {
                            const versionInfo = artifactVersionMap.get(versionUuid)!;
                            const artifactId = block.input.id || 'unknown';
                            const conversationFolder = `${this.plugin.settings.attachmentFolder}/claude/artifacts/${conversationId}`;
                            const versionFile = `${conversationFolder}/${artifactId}_v${versionInfo.versionNumber}`;
                            const specificLink = `>[!${this.CALLOUTS.ARTIFACT}] **${versionInfo.title}** v${versionInfo.versionNumber}\n> 🎨 [[${versionFile}|View Artifact]]`;
                            textParts.push(specificLink);
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
            attachments: attachments
        };
    }

    private static async processContentBlocks(
        contentBlocks: ClaudeContentBlock[],
        conversationId?: string,
        conversationTitle?: string,
        conversationCreateTime?: number,
        versionCounters?: Map<string, number>,
        artifactSummaries?: Map<string, any>
    ): Promise<{ text: string; attachments: StandardAttachment[] }> {
        const textParts: string[] = [];
        const attachments: StandardAttachment[] = [];
        const artifactVersionsMap = new Map<string, any[]>(); // Track all versions by artifact ID

        // Handle empty or null content blocks
        if (!contentBlocks || contentBlocks.length === 0) {
            return { text: "", attachments: [] };
        }

        // First pass: collect ALL significant artifact versions
        for (const block of contentBlocks) {
            if (block.type === 'tool_use' && block.name === 'artifacts' && block.input) {
                const artifactId = block.input.id || 'unknown';
                const content = block.input.content || '';
                const command = block.input.command || 'create';
                const versionUuid = block.input.version_uuid;

                // Skip empty updates and view commands - they're just UI updates without content
                if ((command === 'update' && content.length === 0) || command === 'view') {
                    continue;
                }

                // Only keep significant versions (create, rewrite, or substantial updates)
                const isSignificant = command === 'create' ||
                                    command === 'rewrite' ||
                                    (command === 'update' && content.length > 100);

                if (isSignificant && versionUuid) {
                    this.plugin.logger.debug(`Claude converter: Found significant artifact version - ID: ${artifactId}, Command: ${command}, Content length: ${content.length}, UUID: ${versionUuid}`);
                    if (!artifactVersionsMap.has(artifactId)) {
                        artifactVersionsMap.set(artifactId, []);
                    }
                    artifactVersionsMap.get(artifactId)!.push(block.input);
                } else {
                    this.plugin.logger.debug(`Claude converter: Skipped artifact - ID: ${artifactId}, Command: ${command}, Content length: ${content.length}, Significant: ${isSignificant}, Has UUID: ${!!versionUuid}`);
                }
            }
        }

        // Second pass: process artifacts in messages and create specific links
        // Use provided counters or create new ones (for backward compatibility)
        if (!versionCounters) versionCounters = new Map<string, number>();
        if (!artifactSummaries) artifactSummaries = new Map<string, any>();

        // Global artifact content tracking for cumulative updates
        const artifactContents = new Map<string, string>();

        // Third pass: process non-artifact content blocks
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
                    // Filter out internal tool usage (like [Tool: repl]) - not valuable for users
                    if (block.name === 'repl' || block.name === 'str_replace_editor' || block.name === 'bash') {
                        // Skip internal tool usage
                        break;
                    }

                    // Handle artifacts specifically
                    if (block.name === 'artifacts' && block.input) {
                        const artifactId = block.input.id || 'unknown';
                        const command = block.input.command || 'create';
                        const versionUuid = block.input.version_uuid;

                        // Skip view commands
                        if (command === 'view') {
                            break;
                        }

                        if (versionUuid) {
                            // Increment version number for this artifact ID
                            const currentVersion = (versionCounters.get(artifactId) || 0) + 1;
                            versionCounters.set(artifactId, currentVersion);

                            let finalContent = '';

                            if (command === 'create' || command === 'rewrite') {
                                // Complete content provided - RESET cumulative content
                                finalContent = block.input.content || '';
                                artifactContents.set(artifactId, finalContent);
                            } else if (command === 'update') {
                                // Apply update to PREVIOUS content
                                const previousContent = artifactContents.get(artifactId) || '';

                                if (block.input.old_str && block.input.new_str) {
                                    // sed-like replacement on previous content
                                    finalContent = previousContent.replace(block.input.old_str, block.input.new_str);
                                } else if (block.input.content && block.input.content.length > 0) {
                                    // Complete updated content provided
                                    finalContent = block.input.content;
                                } else {
                                    // Empty update - keep previous content
                                    finalContent = previousContent;
                                }

                                // Update cumulative content for next version
                                artifactContents.set(artifactId, finalContent);
                            }

                            console.log(`Processing ${artifactId} v${currentVersion} (${command}, ${finalContent.length} chars)`);

                            try {
                                // Save this specific version
                                await this.saveSingleArtifactVersionWithContent(
                                    artifactId,
                                    block.input,
                                    currentVersion,
                                    finalContent,
                                    conversationId,
                                    conversationTitle,
                                    conversationCreateTime
                                );

                                // Create specific link for THIS version
                                const title = block.input.title || artifactId;
                                const conversationFolder = `${this.plugin.settings.attachmentFolder}/claude/artifacts/${conversationId}`;
                                const versionFile = `${conversationFolder}/${artifactId}_v${currentVersion}`;
                                const specificLink = `>[!${this.CALLOUTS.ARTIFACT}] **${title}** v${currentVersion}\n> 🎨 [[${versionFile}|View Artifact]]`;
                                textParts.push(specificLink);

                            } catch (error) {
                                console.error(`Failed to save ${artifactId} v${currentVersion}:`, error);
                                textParts.push(`>[!${this.CALLOUTS.ARTIFACT}] **${block.input.title || artifactId}** v${currentVersion}\n> ❌ Error saving artifact`);
                            }
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
     * Save a single artifact version with computed content
     */
    private static async saveSingleArtifactVersionWithContent(
        artifactId: string,
        artifactData: any,
        versionNumber: number,
        finalContent: string,
        conversationId?: string,
        conversationTitle?: string,
        conversationCreateTime?: number,
        forcedLanguage?: string
    ): Promise<void> {
        if (!this.plugin) {
            throw new Error('Plugin not available');
        }

        const { ensureFolderExists } = await import("../../utils");

        // Create conversation-specific artifact folder
        const conversationFolder = `${this.plugin.settings.attachmentFolder}/claude/artifacts/${conversationId}`;
        const folderResult = await ensureFolderExists(conversationFolder, this.plugin.app.vault);
        if (!folderResult.success) {
            throw new Error(`Failed to create artifacts folder: ${folderResult.error}`);
        }

        // Sanitize artifactId to avoid filesystem issues
        const safeArtifactId = artifactId.replace(/[\/\\:*?"<>|]/g, '_');
        const fileName = `${safeArtifactId}_v${versionNumber}.md`;
        const filePath = `${conversationFolder}/${fileName}`;

        // Check if already exists
        const shouldSkip = await this.shouldSkipArtifactVersion(filePath, artifactData.version_uuid);
        if (shouldSkip) {
            return;
        }

        await this.saveIndividualArtifactVersion(
            artifactData,
            filePath,
            versionNumber,
            finalContent,
            conversationId,
            conversationTitle,
            conversationCreateTime,
            forcedLanguage
        );
    }



    /**
     * Create artifact summary for conversation
     */
    private static createArtifactSummary(artifactId: string, info: any, conversationId?: string): string {
        const title = info.title || artifactId;
        const totalVersions = info.totalVersions || 1;
        const latestVersion = info.latestVersion || 1;

        const conversationFolder = `${this.plugin.settings.attachmentFolder}/claude/artifacts/${conversationId}`;
        const latestFile = `${conversationFolder}/${artifactId}_v${latestVersion}`;

        let summary = `<div class="nexus-artifact-box">**🎨 Artifact: ${title}**`;

        if (totalVersions > 1) {
            summary += ` (${totalVersions} versions)`;
        }

        summary += `\n\n📎 **[[${latestFile}|View Latest Version]]**`;

        if (totalVersions > 1) {
            summary += ` | **[[${conversationFolder}/|All Versions]]**`;
        }

        summary += `</div>`;
        return summary;
    }





    /**
     * Format artifact summary for conversation display
     */
    private static formatArtifactSummary(firstVersion: any, savedVersions: string[], latestVersion: string, conversationFolder: string): string {
        const title = firstVersion?.title || 'Untitled Artifact';
        const versionCount = savedVersions.length;

        if (!latestVersion) {
            console.error('Claude converter: No latest version available for artifact summary');
            return `<div class="nexus-artifact-box">**🎨 Artifact: ${title}** (Error: No accessible version)</div>`;
        }

        let formattedContent = `<div class="nexus-artifact-box">**🎨 Artifact: ${title}**`;

        if (versionCount > 1) {
            formattedContent += ` (${versionCount} versions)`;
        }

        // Use vault-relative paths for Obsidian links (remove .md extension for links)
        const latestVersionLink = latestVersion.replace(/\.md$/, '');
        formattedContent += `\n\n📎 **[[${latestVersionLink}|View Latest Version]]**`;

        if (versionCount > 1) {
            formattedContent += ` | **[[${conversationFolder}/|All Versions]]**`;
        }

        formattedContent += `</div>`;
        return formattedContent;
    }



    /**
     * Save a single artifact version with specific content
     */
    private static async saveIndividualArtifactVersion(
        artifactInput: any,
        filePath: string,
        versionNumber: number,
        versionContent: string,
        conversationId?: string,
        conversationTitle?: string,
        conversationCreateTime?: number,
        forcedLanguage?: string
    ): Promise<void> {
        const title = artifactInput.title || 'Untitled Artifact';
        let language = artifactInput.language || 'text';
        const command = artifactInput.command || 'create';
        const artifactId = artifactInput.id || 'unknown';
        const versionUuid = artifactInput.version_uuid;

        // Use forced language (from create/rewrite) or auto-detect
        if (forcedLanguage) {
            language = forcedLanguage;
        } else if ((language.toLowerCase() === 'text' || !language || language === 'undefined') && versionContent) {
            const detectedLanguage = this.detectLanguageFromContent(versionContent, artifactInput.type);
            if (detectedLanguage !== 'text') {
                language = detectedLanguage;
            }
        }

        // Generate conversation link with proper path if conversationId and title are provided
        let conversationLink = '';
        if (conversationId && conversationTitle && conversationCreateTime) {
            const createDate = new Date(conversationCreateTime * 1000);
            const year = createDate.getFullYear();
            const month = String(createDate.getMonth() + 1).padStart(2, '0');

            // Import utilities
            const { generateConversationFileName } = await import("../../utils");

            // Generate the exact filename that would be used for the conversation
            const fileName = generateConversationFileName(
                conversationTitle,
                conversationCreateTime,
                this.plugin.settings.addDatePrefix,
                this.plugin.settings.dateFormat
            );

            // Use absolute path from vault root (without .md extension for links)
            const conversationPath = `${this.plugin.settings.conversationFolder}/claude/${year}/${month}/${fileName}`;
            conversationLink = `[[${conversationPath}|${conversationTitle}]]`;
        }

        // Generate safe aliases for frontmatter
        const safeArtifactTitle = generateSafeAlias(title);
        const safeArtifactAlias = generateSafeAlias(`${artifactId}_v${versionNumber}`);

        // Create markdown content with enhanced frontmatter
        let markdownContent = `---
nexus: nexus-ai-chat-importer
plugin_version: ${this.plugin.manifest.version}
provider: claude
artifact_id: ${artifactId}
version_uuid: ${versionUuid}
version_number: ${versionNumber}
command: ${command}
conversation_id: ${conversationId || 'unknown'}
format: ${language}
aliases: [${safeArtifactTitle}, ${safeArtifactAlias}]
---

# ${title} (Version ${versionNumber})

**Type:** Claude Artifact
**Language:** ${language}`;

        if (artifactInput.language !== language) {
            markdownContent += ` (detected from content, original: ${artifactInput.language})`;
        }

        markdownContent += `
**Command:** ${command}
**Version:** ${versionNumber}
**ID:** ${artifactId}
**UUID:** ${versionUuid}`;

        if (conversationLink) {
            markdownContent += `
**Conversation:** ${conversationLink}`;
        }

        markdownContent += `\n\n## Content\n\n`;

        // Add content based on language
        if (language.toLowerCase() === 'markdown') {
            // For markdown, include content directly
            markdownContent += versionContent;
        } else {
            // For other languages, use code blocks
            markdownContent += `\`\`\`${language}\n${versionContent}\n\`\`\``;
        }

        // Save the artifact as markdown
        try {
            await this.plugin.app.vault.create(filePath, markdownContent);
        } catch (error) {
            console.error(`Failed to create artifact file ${filePath}:`, error);
            throw error;
        }
    }





    /**
     * Check if we should skip saving this artifact version (already exists)
     */
    private static async shouldSkipArtifactVersion(filePath: string, versionUuid: string): Promise<boolean> {
        try {
            const existingFile = this.plugin.app.vault.getAbstractFileByPath(filePath);
            if (!existingFile) {
                return false; // File doesn't exist, don't skip
            }

            const existingContent = await this.plugin.app.vault.read(existingFile as any);

            // Check if the version_uuid matches (same version)
            if (existingContent.includes(`version_uuid: ${versionUuid}`)) {
                return true; // Same version, skip
            }

            // Different version_uuid but same file path - this shouldn't happen in normal cases
            // but could happen if there are conflicts. Let's update the file.
            return false;
        } catch (error) {
            // If we can't read the file, don't skip (try to create/update)
            return false;
        }
    }

    /**
     * Determine if we should replace the current artifact with a new one
     * Priority: create > rewrite > update (with content) > view
     */
    private static shouldReplaceArtifact(current: any, candidate: any): boolean {
        const currentCommand = current.command || 'create';
        const candidateCommand = candidate.command || 'create';
        const currentContent = (current.content || '').length;
        const candidateContent = (candidate.content || '').length;

        // Command priority scores
        const commandPriority: Record<string, number> = {
            'create': 4,
            'rewrite': 3,
            'update': 2,
            'view': 1
        };

        const currentPriority = commandPriority[currentCommand as string] || 1;
        const candidatePriority = commandPriority[candidateCommand as string] || 1;

        // Higher priority command wins
        if (candidatePriority > currentPriority) {
            return true;
        }

        // Same priority: longer content wins
        if (candidatePriority === currentPriority) {
            return candidateContent > currentContent;
        }

        return false;
    }

    /**
     * Auto-detect language from content and artifact type
     */
    private static detectLanguageFromContent(content: string, artifactType?: string): string {
        if (!content || content.trim().length === 0) return 'text';

        // First check artifact type for hints
        if (artifactType) {
            if (artifactType.includes('react') || artifactType.includes('jsx')) return 'jsx';
            if (artifactType.includes('vue')) return 'vue';
            if (artifactType.includes('svelte')) return 'svelte';
            if (artifactType.includes('html')) return 'html';
            if (artifactType.includes('css')) return 'css';
            if (artifactType.includes('json')) return 'json';
            if (artifactType.includes('xml')) return 'xml';
            if (artifactType.includes('svg')) return 'xml';
        }

        const trimmedContent = content.trim();

        // Check for specific file type patterns
        if (trimmedContent.startsWith('<?php')) return 'php';
        if (trimmedContent.startsWith('#!/bin/bash') || trimmedContent.startsWith('#!/bin/sh')) return 'bash';
        if (trimmedContent.startsWith('<!DOCTYPE html') || trimmedContent.includes('<html')) return 'html';

        // Check for React/JSX patterns
        if (trimmedContent.includes('import React') || trimmedContent.includes('from "react"') ||
            trimmedContent.includes('useState') || trimmedContent.includes('useEffect') ||
            trimmedContent.includes('className=') || trimmedContent.includes('jsx')) {
            return 'jsx';
        }

        // Check for JSON
        if (trimmedContent.startsWith('{') && trimmedContent.endsWith('}')) {
            try {
                JSON.parse(trimmedContent);
                return 'json';
            } catch {}
        }

        // Check for SVG/XML
        if (trimmedContent.startsWith('<svg') || trimmedContent.includes('xmlns')) {
            return 'xml';
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
     * Count unique artifacts in a conversation (by artifact ID, not versions)
     */
    static countArtifacts(chat: ClaudeConversation): number {
        const uniqueArtifacts = new Set<string>();

        for (const message of chat.chat_messages) {
            if (message.content) {
                for (const block of message.content) {
                    if (block.type === 'tool_use' && block.name === 'artifacts' && block.input?.id) {
                        uniqueArtifacts.add(block.input.id);
                    }
                }
            }
        }

        return uniqueArtifacts.size;
    }
}
