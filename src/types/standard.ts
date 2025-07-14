// src/types/standard.ts

/**
 * Attachment processing status
 */
export interface AttachmentStatus {
    processed: boolean;
    found: boolean;
    localPath?: string;
    reason?: 'missing_from_export' | 'corrupted' | 'unsupported_format' | 'extraction_failed';
    note?: string;
}

/**
 * Provider-agnostic attachment interface with status tracking
 */
export interface StandardAttachment {
    fileName: string;
    fileSize?: number;
    fileType?: string;
    content?: string; // For text files, code, etc.
    extractedContent?: string; // For processed content (OCR, transcriptions)
    url?: string; // For linked attachments
    fileId?: string; // Provider-specific file ID (for ZIP lookup)
    
    // Attachment processing status
    status?: AttachmentStatus;
}

/**
 * Provider-agnostic message interface
 */
export interface StandardMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: number; // Unix timestamp
    attachments?: StandardAttachment[];
}

/**
 * Provider-agnostic conversation interface
 */
export interface StandardConversation {
    id: string;
    title: string;
    provider: string; // 'chatgpt', 'claude', etc.
    createTime: number; // Unix timestamp
    updateTime: number; // Unix timestamp
    messages: StandardMessage[];
    chatUrl?: string; // Provider-specific URL
    metadata?: Record<string, any>; // Provider-specific extra data
    plugin_version?: string; // Version of plugin that created/last modified this conversation
}

/**
 * URL generator interface - providers implement this
 */
export interface UrlGenerator {
    generateChatUrl(conversationId: string): string;
}

/**
 * Built-in URL generators for common providers
 */
export const URL_GENERATORS: Record<string, UrlGenerator> = {
    chatgpt: {
        generateChatUrl: (id: string) => `https://chat.openai.com/c/${id}`
    },
    claude: {
        generateChatUrl: (id: string) => `https://claude.ai/chat/${id}`
    }
};

/**
 * Provider-specific report naming strategy
 */
export interface ReportNamingStrategy {
    /**
     * Extract report prefix from archive filename
     * @param zipFileName - Name of the imported ZIP file
     * @returns prefix for report naming (e.g., "2025.04.25")
     */
    extractReportPrefix(zipFileName: string): string;
    
    /**
     * Get provider name for folder organization
     * @returns provider name (e.g., "chatgpt", "claude")
     */
    getProviderName(): string;
}

/**
 * Report generation info returned by providers
 */
export interface ReportGenerationInfo {
    provider: string;
    prefix: string;
    folderPath: string;  // e.g., "Reports/chatgpt"
    baseFileName: string; // e.g., "2025.04.25 - import report.md"
}