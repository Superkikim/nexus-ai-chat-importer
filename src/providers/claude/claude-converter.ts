// src/providers/claude/claude-converter.ts
import { StandardConversation, StandardMessage, StandardAttachment } from "../../types/standard";
import { ClaudeConversation, ClaudeMessage, ClaudeContentBlock } from "./claude-types";

export class ClaudeConverter {
    static convertChat(chat: ClaudeConversation): StandardConversation {
        const messages = this.convertMessages(chat.chat_messages, chat.uuid);
        
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

    static convertMessages(messages: ClaudeMessage[], conversationId?: string): StandardMessage[] {
        const standardMessages: StandardMessage[] = [];
        
        if (!messages || messages.length === 0) {
            return standardMessages;
        }
        
        for (const message of messages) {
            if (!this.shouldIncludeMessage(message)) {
                continue;
            }

            // Process content blocks to create message text and attachments
            const { text, attachments } = this.processContentBlocks(message.content);
            
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

    private static processContentBlocks(contentBlocks: ClaudeContentBlock[]): { text: string; attachments: StandardAttachment[] } {
        const textParts: string[] = [];
        const attachments: StandardAttachment[] = [];
        
        // Handle empty or null content blocks
        if (!contentBlocks || contentBlocks.length === 0) {
            return { text: "", attachments: [] };
        }
        
        for (const block of contentBlocks) {
            switch (block.type) {
                case 'text':
                    if (block.text) {
                        textParts.push(block.text);
                    }
                    break;
                    
                case 'thinking':
                    // Include thinking blocks as they contain Claude's reasoning
                    if (block.thinking) {
                        textParts.push(`**[Thinking]**\n${block.thinking}`);
                    }
                    break;
                    
                case 'tool_use':
                    // Special handling for artifacts
                    if (block.name === 'artifacts' && block.input) {
                        const artifact = this.formatArtifact(block.input);
                        textParts.push(artifact);
                    } else if (block.name && block.input) {
                        // Other tools
                        const code = block.input.code || JSON.stringify(block.input, null, 2);
                        textParts.push(`**[Tool: ${block.name}]**\n\`\`\`\n${code}\n\`\`\``);
                    }
                    break;
                    
                case 'tool_result':
                    // Format tool results
                    if (block.content && Array.isArray(block.content)) {
                        const results = block.content.map(c => c.text).join('\n');
                        textParts.push(`**[Tool Result]**\n\`\`\`\n${results}\n\`\`\``);
                    }
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
     * Format Claude artifacts with proper syntax highlighting and metadata
     */
    private static formatArtifact(artifactInput: any): string {
        const title = artifactInput.title || 'Untitled Artifact';
        const language = artifactInput.language || 'text';
        const content = artifactInput.content || '';
        const command = artifactInput.command || 'create';

        let formattedContent = `**🎨 Artifact: ${title}**\n\n`;

        if (command === 'edit') {
            formattedContent += `*[Artifact edited]*\n\n`;
        }

        // Add metadata
        formattedContent += `> **Language:** ${language}\n`;
        formattedContent += `> **Type:** ${artifactInput.type || 'code'}\n\n`;

        // Add content with proper syntax highlighting
        if (content) {
            formattedContent += `\`\`\`${language}\n${content}\n\`\`\`\n\n`;
        }

        return formattedContent;
    }
}
