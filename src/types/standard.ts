// src/types/standard.ts

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
    
    // New: Attachment processing status
    status?: AttachmentStatus;
}

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