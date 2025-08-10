// src/providers/chatgpt/chatgpt-code-extractor.ts
import { StandardAttachment } from "../../types/standard";
import { Logger } from "../../logger";
import type NexusAiChatImporterPlugin from "../../main";

export interface CodeFile {
    fileName: string;
    filePath: string;
    language: string;
    startIndex: number;
    endIndex: number;
    content: string;
}

export interface CodeExtractionResult {
    cleanContent: string;
    virtualAttachments: StandardAttachment[];
}

export class ChatGPTCodeExtractor {
    // File patterns to detect in markdown content
    private static readonly FILE_PATTERNS = [
        // ## src/file.ext or ## path/file.ext
        /^##\s+([^\n]+\.(ts|js|jsx|tsx|py|java|cpp|c|h|hpp|css|html|json|yaml|yml|xml|sql|sh|bat|md|txt))$/gm,
        // ### file.ext
        /^###\s+([^\n]+\.(ts|js|jsx|tsx|py|java|cpp|c|h|hpp|css|html|json|yaml|yml|xml|sql|sh|bat|md|txt))$/gm,
        // # file.ext (less common but possible)
        /^#\s+([^\n]+\.(ts|js|jsx|tsx|py|java|cpp|c|h|hpp|css|html|json|yaml|yml|xml|sql|sh|bat|md|txt))$/gm,
        // `file.ext` (inline file references)
        /^`([^`\n]+\.(ts|js|jsx|tsx|py|java|cpp|c|h|hpp|css|html|json|yaml|yml|xml|sql|sh|bat|md|txt))`$/gm
    ];

    // Language mapping from file extensions
    private static readonly LANGUAGE_MAP: Record<string, string> = {
        'ts': 'typescript',
        'tsx': 'typescript',
        'js': 'javascript', 
        'jsx': 'javascript',
        'py': 'python',
        'java': 'java',
        'cpp': 'cpp',
        'c': 'c',
        'h': 'c',
        'hpp': 'cpp',
        'css': 'css',
        'html': 'html',
        'json': 'json',
        'yaml': 'yaml',
        'yml': 'yaml',
        'xml': 'xml',
        'sql': 'sql',
        'sh': 'bash',
        'bat': 'batch',
        'md': 'markdown',
        'txt': 'text'
    };

    constructor(
        private plugin: NexusAiChatImporterPlugin,
        private logger: Logger
    ) {}

    /**
     * Main extraction method - detects if content has extractable code files
     */
    extractCodeFiles(content: string, conversationId: string): CodeExtractionResult {
        // Quick check: does this look like a code architecture document?
        if (!this.looksLikeCodeDocument(content)) {
            return { cleanContent: content, virtualAttachments: [] };
        }

        this.logger.info('ChatGPT Code Extractor: Analyzing content for code files');

        // Detect file headers
        const detectedFiles = this.detectFileHeaders(content);
        
        if (detectedFiles.length === 0) {
            this.logger.info('ChatGPT Code Extractor: No code files detected');
            return { cleanContent: content, virtualAttachments: [] };
        }

        this.logger.info(`ChatGPT Code Extractor: Found ${detectedFiles.length} potential code files`);

        // Extract code blocks for each file
        const codeFiles = this.extractCodeBlocks(content, detectedFiles);
        
        if (codeFiles.length === 0) {
            this.logger.info('ChatGPT Code Extractor: No valid code blocks extracted');
            return { cleanContent: content, virtualAttachments: [] };
        }

        // Create virtual attachments
        const virtualAttachments = this.createVirtualAttachments(codeFiles, conversationId);

        // Generate clean content with file links
        const cleanContent = this.generateCleanContent(content, codeFiles);

        this.logger.info(`ChatGPT Code Extractor: Successfully extracted ${virtualAttachments.length} code files`);

        return { cleanContent, virtualAttachments };
    }

    /**
     * Quick heuristic to check if content might contain code files
     */
    private looksLikeCodeDocument(content: string): boolean {
        // Look for common patterns that suggest this is a code architecture document
        const codeIndicators = [
            /##\s+src\//i,                    // ## src/
            /##\s+[^/\n]*\.(ts|js|py|java)/i, // ## file.ext
            /```(ts|js|py|java|cpp)/i,        // ```language
            /import\s+.*from/i,               // import statements
            /export\s+(class|function|interface)/i, // export statements
            /class\s+\w+/i,                   // class definitions
            /function\s+\w+/i,                // function definitions
        ];

        return codeIndicators.some(pattern => pattern.test(content));
    }

    /**
     * Detect file headers in the content
     */
    private detectFileHeaders(content: string): Array<{fileName: string, filePath: string, position: number}> {
        const files: Array<{fileName: string, filePath: string, position: number}> = [];
        
        for (const pattern of ChatGPTCodeExtractor.FILE_PATTERNS) {
            let match;
            const regex = new RegExp(pattern.source, pattern.flags);
            
            while ((match = regex.exec(content)) !== null) {
                const fullPath = match[1].trim();
                const fileName = fullPath.split('/').pop() || fullPath;
                
                files.push({
                    fileName,
                    filePath: fullPath,
                    position: match.index
                });
            }
        }

        // Sort by position in document
        return files.sort((a, b) => a.position - b.position);
    }

    /**
     * Extract code blocks following each file header
     */
    private extractCodeBlocks(content: string, fileHeaders: Array<{fileName: string, filePath: string, position: number}>): CodeFile[] {
        const codeFiles: CodeFile[] = [];

        for (let i = 0; i < fileHeaders.length; i++) {
            const file = fileHeaders[i];
            const nextFile = fileHeaders[i + 1];
            
            // Find the next code block after this file header
            const searchStart = file.position;
            const searchEnd = nextFile ? nextFile.position : content.length;
            const section = content.slice(searchStart, searchEnd);
            
            // Look for code block pattern: ```language\n...code...\n```
            const codeBlockMatch = section.match(/```(\w+)?\n([\s\S]*?)\n```/);
            
            if (codeBlockMatch) {
                const language = codeBlockMatch[1] || this.getLanguageFromExtension(file.fileName);
                const codeContent = codeBlockMatch[2].trim();
                
                if (codeContent.length > 0) {
                    codeFiles.push({
                        fileName: file.fileName,
                        filePath: file.filePath,
                        language,
                        startIndex: searchStart,
                        endIndex: searchStart + section.indexOf(codeBlockMatch[0]) + codeBlockMatch[0].length,
                        content: codeContent
                    });
                }
            }
        }

        return codeFiles;
    }

    /**
     * Get programming language from file extension
     */
    private getLanguageFromExtension(fileName: string): string {
        const extension = fileName.split('.').pop()?.toLowerCase();
        return extension ? (ChatGPTCodeExtractor.LANGUAGE_MAP[extension] || 'text') : 'text';
    }

    /**
     * Create virtual attachments for code files
     */
    private createVirtualAttachments(codeFiles: CodeFile[], conversationId: string): StandardAttachment[] {
        return codeFiles.map(file => {
            // Sanitize filename for filesystem
            const sanitizedName = file.filePath.replace(/[/\\]/g, '_').replace(/[<>:"?*|]/g, '_');
            
            return {
                fileName: sanitizedName,
                fileType: `text/${file.language}`,
                fileId: `virtual_${conversationId}_${sanitizedName}`,
                url: `virtual://code/${conversationId}/${sanitizedName}`,
                status: {
                    processed: true,
                    found: true,
                    virtual: true,
                    virtualContent: file.content
                }
            };
        });
    }

    /**
     * Generate clean content with file links instead of embedded code
     */
    private generateCleanContent(content: string, codeFiles: CodeFile[]): string {
        let cleanContent = content;
        
        // Remove extracted code blocks (in reverse order to maintain indices)
        const sortedFiles = [...codeFiles].sort((a, b) => b.startIndex - a.startIndex);
        
        for (const file of sortedFiles) {
            const before = cleanContent.slice(0, file.startIndex);
            const after = cleanContent.slice(file.endIndex);
            
            // Replace with a clean file reference
            const fileReference = `\n\n📄 **${file.filePath}** - [[Attachments/chatgpt/code/${file.fileName}|View Code]]\n`;
            
            cleanContent = before + fileReference + after;
        }
        
        return cleanContent;
    }
}
