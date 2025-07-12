// src/providers/chatgpt/chatgpt-types.ts

export interface ChatMessage {
    id: string;
    author: {
        role: 'user' | 'assistant';
    };
    content: {
        parts: string[];
        content_type?: string;
    };
    create_time: number;
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