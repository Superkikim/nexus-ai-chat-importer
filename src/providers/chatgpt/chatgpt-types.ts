// src/providers/chatgpt/chatgpt-types.ts

/**
 * ChatGPT attachment/file structure based on schema analysis
 */
export interface ChatGPTAttachment {
    file_name: string;
    file_size?: number;
    file_type?: string;
    extracted_content?: string; // For processed content (OCR, transcriptions, etc.)
}

export interface ChatGPTFile {
    file_name: string;
}

export interface ChatMessage {
    id: string;
    author: {
        role: 'user' | 'assistant' | 'system' | 'tool';    };
    content: {
        parts: (string | any)[];
        content_type?: string;
    };
    create_time: number;
    attachments?: ChatGPTAttachment[]; // Added attachment support
    files?: ChatGPTFile[]; // Added file reference support
    metadata?: {
        attachments?: Array<{
            id: string;
            name: string;
            size: number;
            mime_type?: string;
            width?: number;
            height?: number;
        }>;
        [key: string]: any;
    };
}

export interface ChatMapping {
    id: string;
    message?: ChatMessage;
    parent?: string;
    children?: string[];
}

/**
 * Complete ChatGPT conversation structure based on actual export format
 */
export interface Chat {
    id: string;
    title: string;
    create_time: number;
    update_time: number;
    mapping: Record<string, ChatMapping>;
    
    // Additional metadata from ChatGPT exports
    conversation_id?: string;
    conversation_template_id?: string | null;
    gizmo_id?: string | null;
    gizmo_type?: string | null;
    default_model_slug?: string;
    is_archived?: boolean;
    is_starred?: boolean | null;
    current_node?: string;
    plugin_ids?: string[] | null;
    moderation_results?: any[];
    safe_urls?: string[];
    blocked_urls?: string[];
    conversation_origin?: string | null;
    voice?: string | null;
    async_status?: string | null;
    disabled_tool_ids?: string[];
    is_do_not_remember?: boolean;
    memory_scope?: string;
    sugar_item_id?: string | null;
}

/**
 * ChatGPT content part (for messages with multiple parts/attachments)
 */
export interface ContentPart {
    content_type?: string;
    asset_pointer?: string;
    text?: string;
    size_bytes?: number;
    width?: number;
    height?: number;
    metadata?: {
        dalle?: {
            gen_id?: string;
            prompt?: string;
            seed?: number | null;
            parent_gen_id?: string | null;
            edit_op?: string | null;
        };
        [key: string]: any;
    };
    [key: string]: any;
}