// src/providers/chatgpt/chatgpt-converter.ts
import { Chat, ChatMessage } from "./chatgpt-types";
import { StandardConversation, StandardMessage } from "../../types/standard";
import { isValidMessage } from "../../utils";

export class ChatGPTConverter {
    /**
     * Convert ChatGPT Chat to StandardConversation
     */
    static convertChat(chat: Chat): StandardConversation {
        const messages = this.extractMessagesFromMapping(chat);
        
        return {
            id: chat.id || "",
            title: chat.title || "Untitled",
            provider: "chatgpt",
            createTime: chat.create_time || 0,
            updateTime: chat.update_time || 0,
            messages: messages,
            metadata: {
                conversation_template_id: chat.conversation_template_id,
                gizmo_id: chat.gizmo_id,
                gizmo_type: chat.gizmo_type,
                default_model_slug: chat.default_model_slug,
                is_archived: chat.is_archived,
                is_starred: chat.is_starred,
                current_node: chat.current_node,
                memory_scope: chat.memory_scope
            }
        };
    }

    /**
     * Convert array of ChatGPT ChatMessages to StandardMessages
     */
    static convertMessages(chatMessages: ChatMessage[], conversationId?: string): StandardMessage[] {
        return chatMessages
            .filter(msg => isValidMessage(msg))
            .map(msg => this.convertMessage(msg, conversationId));
    }

    /**
     * Convert single ChatGPT ChatMessage to StandardMessage
     */
    private static convertMessage(chatMessage: ChatMessage, conversationId?: string): StandardMessage {
        return {
            id: chatMessage.id || "",
            role: chatMessage.author?.role === "user" ? "user" : "assistant",
            content: this.extractContent(chatMessage, conversationId),
            timestamp: chatMessage.create_time || 0,
            attachments: []
        };
    }

    /**
     * Extract messages from ChatGPT mapping structure with DALL-E prompt association
     */
    private static extractMessagesFromMapping(chat: Chat): StandardMessage[] {
        const messages: StandardMessage[] = [];
        const dallePrompts = new Map<string, string>(); // Map tool message ID to prompt
        const conversationId = chat.id; // Pass conversation ID for smart linking
        
        // SINGLE PASS: Extract prompts and process messages in one go
        const mappingValues = Object.values(chat.mapping); // Cache the values array

        // First pass: Extract DALL-E prompts (quick scan)
        for (const messageObj of mappingValues) {
            const message = messageObj?.message;
            if (!message || message.author?.role !== "assistant") continue;

            // Check if this is a DALL-E JSON prompt message
            if (this.isDallePromptMessage(message)) {
                const prompt = this.extractPromptFromJson(message);
                if (prompt) {
                    // Find the corresponding tool message (usually the next child)
                    const children = messageObj.children || [];
                    for (const childId of children) {
                        const childObj = chat.mapping[childId];
                        if (childObj?.message?.author?.role === "tool" &&
                            this.hasRealDalleImage(childObj.message)) {
                            dallePrompts.set(childId, prompt);
                            break;
                        }
                    }
                }
            }
        }

        // Second pass: Process all messages (reuse cached array)
        for (const messageObj of mappingValues) {
            const message = messageObj?.message;
            if (!message) continue;

            // Handle DALL-E tool messages with associated prompts
            if (message.author?.role === "tool" && this.hasRealDalleImage(message)) {
                const prompt = dallePrompts.get(messageObj.id || "");
                const dalleMessage = this.createDalleAssistantMessage(message, prompt);
                if (dalleMessage) {
                    messages.push(dalleMessage);
                }
            }
            // Handle regular messages (but skip DALL-E JSON prompts)
            else if (this.shouldIncludeMessage(message)) {
                messages.push(this.convertMessage(message, conversationId));
            }
        }
        
        // Sort by timestamp to maintain order (optimized for mostly-sorted data)
        if (messages.length <= 1) return messages;

        // Use insertion sort for small arrays or mostly sorted data (common case)
        if (messages.length < 50) {
            for (let i = 1; i < messages.length; i++) {
                const current = messages[i];
                let j = i - 1;
                while (j >= 0 && messages[j].timestamp > current.timestamp) {
                    messages[j + 1] = messages[j];
                    j--;
                }
                messages[j + 1] = current;
            }
            return messages;
        }

        // Use native sort for larger arrays
        return messages.sort((a, b) => a.timestamp - b.timestamp);
    }

    /**
     * Check if message is a DALL-E JSON prompt message
     */
    private static isDallePromptMessage(message: ChatMessage): boolean {
        if (message.author?.role !== "assistant") return false;
        
        if (message.content?.parts && 
            Array.isArray(message.content.parts) &&
            message.content.parts.length === 1 &&
            typeof message.content.parts[0] === "string") {
            
            const content = message.content.parts[0].trim();
            return content.startsWith('{') && content.includes('"prompt"');
        }
        
        return false;
    }

    /**
     * Extract prompt from DALL-E JSON message
     */
    private static extractPromptFromJson(message: ChatMessage): string | null {
        try {
            if (message.content?.parts && message.content.parts[0]) {
                const jsonStr = message.content.parts[0] as string;
                const parsed = JSON.parse(jsonStr);
                return parsed.prompt || null;
            }
        } catch (error) {
            // Invalid JSON, ignore
        }
        return null;
    }

    /**
     * Determine if a message should be included in the conversation - ENHANCED VERSION
     */
    private static shouldIncludeMessage(message: ChatMessage): boolean {
        // Safety check
        if (!message || !message.author) {
            return false;
        }
        
        // ===== STRICT EXCLUSIONS =====
        
        // 1. Skip ALL system messages (always internal ChatGPT stuff)
        if (message.author.role === "system") {
            return false;
        }
        
        // 2. Skip ALL tool messages (browsing, code execution, etc.)
        if (message.author.role === "tool") {
            return false;
        }
        
        // 3. Skip hidden messages (user profile, system instructions)
        if (message.metadata?.is_visually_hidden_from_conversation === true) {
            return false;
        }
        
        // 4. Skip user system messages (user_editable_context)
        if (message.metadata?.is_user_system_message === true) {
            return false;
        }
        
        // 5. Skip user_editable_context content type
        if (message.content?.content_type === "user_editable_context") {
            return false;
        }
        
        // ===== ASSISTANT MESSAGE FILTERING =====
        
        if (message.author.role === "assistant") {
            // Skip empty assistant messages
            if (message.content?.parts && 
                Array.isArray(message.content.parts) &&
                message.content.parts.every(part => 
                    typeof part === "string" && part.trim() === ""
                )) {
                return false;
            }
            
            // Skip DALL-E JSON prompt messages (handled separately)
            if (this.isDallePromptMessage(message)) {
                return false;
            }
            
            // Skip code execution assistant messages (these are intermediate outputs)
            if (message.content?.content_type === "code") {
                return false;
            }
            
            // Skip system error messages
            if (message.content?.content_type === "system_error") {
                return false;
            }
            
            // Skip execution output messages  
            if (message.content?.content_type === "execution_output") {
                return false;
            }
            
            // Keep multimodal_text messages ONLY if they have actual text content
            if (message.content?.content_type === "multimodal_text") {
                // Check if parts contain actual text (not just objects)
                if (message.content?.parts && Array.isArray(message.content.parts)) {
                    const hasTextContent = message.content.parts.some(part => {
                        if (typeof part === "string" && part.trim() !== "") {
                            return true;
                        }
                        if (typeof part === "object" && part !== null && 'text' in part) {
                            return typeof part.text === "string" && part.text.trim() !== "";
                        }
                        return false;
                    });
                    
                    if (!hasTextContent) {
                        return false; // Skip multimodal messages without text
                    }
                }
            }
        }
        
        // ===== USER MESSAGE FILTERING =====
        
        if (message.author.role === "user") {
            // User messages should generally be kept, but exclude special content types
            const excludedContentTypes = [
                "user_editable_context" // Already covered above but double-check
            ];
            
            if (message.content?.content_type && excludedContentTypes.includes(message.content.content_type)) {
                return false;
            }
        }
        
        // ===== FINAL VALIDATION =====
        
        // Use existing validation for basic message structure
        return isValidMessage(message);
    }

    /**
     * Check if message contains REAL DALL-E image (not user upload)
     */
    private static hasRealDalleImage(message: ChatMessage): boolean {
        if (!message.content?.parts || !Array.isArray(message.content.parts)) {
            return false;
        }
        
        return message.content.parts.some(part => {
            if (typeof part !== "object" || part === null) return false;
            
            const contentPart = part as any;
            return contentPart.content_type === "image_asset_pointer" && 
                   contentPart.asset_pointer &&
                   contentPart.metadata?.dalle && 
                   contentPart.metadata.dalle !== null; // REAL DALL-E check
        });
    }

    /**
     * Create Assistant (DALL-E) message from tool message with associated prompt
     */
    private static createDalleAssistantMessage(toolMessage: ChatMessage, associatedPrompt?: string): StandardMessage | null {
        if (!toolMessage.content?.parts || !Array.isArray(toolMessage.content.parts)) {
            return null;
        }

        const attachments: any[] = [];
        
        for (const part of toolMessage.content.parts) {
            if (typeof part === "object" && part !== null) {
                const contentPart = part as any;
                if (contentPart.content_type === "image_asset_pointer" && 
                    contentPart.asset_pointer &&
                    contentPart.metadata?.dalle &&
                    contentPart.metadata.dalle !== null) {
                    
                    // Extract file ID from asset pointer
                    let fileId = contentPart.asset_pointer;
                    if (fileId.includes('://')) {
                        fileId = fileId.split('://')[1];
                    }

                    // Generate descriptive filename
                    const genId = contentPart.metadata.dalle.gen_id || 'unknown';
                    const width = contentPart.width || 1024;
                    const height = contentPart.height || 1024;
                    const fileName = `dalle_${genId}_${width}x${height}.png`;

                    const dalleAttachment = {
                        fileName: fileName,
                        fileSize: contentPart.size_bytes,
                        fileType: "image/png",
                        fileId: fileId,
                        // Use associated prompt from JSON message, fallback to metadata
                        extractedContent: associatedPrompt || contentPart.metadata.dalle.prompt
                    };
                    
                    attachments.push(dalleAttachment);
                }
            }
        }

        if (attachments.length === 0) {
            return null;
        }

        return {
            id: toolMessage.id || "",
            role: "assistant",
            content: "Image générée par DALL-E",
            timestamp: toolMessage.create_time || 0,
            attachments: attachments
        };
    }

    /**
     * Extract content from ChatGPT message parts
     */
    private static extractContent(chatMessage: ChatMessage, conversationId?: string): string {
        if (!chatMessage.content?.parts || !Array.isArray(chatMessage.content.parts)) {
            return "";
        }
        
        const contentParts: string[] = [];
        
        for (const part of chatMessage.content.parts) {
            let textContent = "";
            
            if (typeof part === "string" && part.trim() !== "") {
                // Simple string part
                textContent = part;
            } else if (typeof part === "object" && part !== null) {
                // Handle code blocks with type and content structure (ChatGPT artifacts)
                if ('type' in part && 'content' in part && typeof part.content === 'string') {
                    const codeType = part.type as string;
                    const codeContent = part.content as string;

                    if (codeContent.trim() !== "") {
                        // Extract language from type (e.g., "code/markdown" -> "markdown")
                        const language = codeType.includes('/') ? codeType.split('/')[1] : codeType;
                        textContent = `\`\`\`${language}\n${codeContent}\n\`\`\``;
                    }
                }
                // Handle different content types with proper type checking
                else if ('content_type' in part && 'text' in part && typeof part.text === 'string') {
                    if (part.content_type === "audio_transcription" && part.text.trim() !== "") {
                        textContent = part.text;
                    } else if (part.content_type === "text" && part.text.trim() !== "") {
                        textContent = part.text;
                    } else if (part.content_type === "multimodal_text" && part.text.trim() !== "") {
                        textContent = part.text;
                    }
                }
                // Skip image_asset_pointer content types - they become attachments via metadata
            }
            
            // Clean up ChatGPT control characters and formatting artifacts
            if (textContent) {
                textContent = this.cleanChatGPTArtifacts(textContent, conversationId);
                if (textContent.trim() !== "") {
                    contentParts.push(textContent);
                }
            }
        }
        
        return contentParts.join("\n");
    }

    // Pre-compiled regex patterns for performance
    private static readonly CLEANUP_PATTERNS = [
        // SMART: Replace sandbox links with actual links to original conversation
        { pattern: /📄 \[([^\]]+)\]\(sandbox:\/[^)]+\)/g, replacement: (chatUrl: string) => `📄 [$1](${chatUrl}) *(visit original conversation to download)*` },
        { pattern: /📄 ([^-\n]+) - File not available in archive/g, replacement: (chatUrl: string) => `📄 [$1](${chatUrl}) *(visit original conversation to download)*` },
        { pattern: /\[([^\]]+)\]\(sandbox:\/[^)]+\)/g, replacement: (chatUrl: string) => `[$1](${chatUrl}) *(visit original conversation to download)*` },
        { pattern: /([^-\n]+) - File not available in archive\. Visit the original conversation to access it/g, replacement: (chatUrl: string) => `[$1](${chatUrl}) *(visit original conversation to download)*` },
        // Remove patterns (static replacements)
        { pattern: /cite[a-zA-Z0-9_\-]+/g, replacement: () => "" },
        { pattern: /link[a-zA-Z0-9_\-]+/g, replacement: () => "" },
        { pattern: /turn\d+search\d+/g, replacement: () => "" },
        { pattern: /[\uE000-\uF8FF]/g, replacement: () => "" }, // Unicode control characters
        { pattern: / {2,}/g, replacement: () => " " }, // Multiple spaces
        { pattern: /\n{3,}/g, replacement: () => "\n\n" } // Multiple newlines
    ];

    /**
     * Clean ChatGPT artifacts, citations, and control characters - SMART LINKING
     */
    private static cleanChatGPTArtifacts(text: string, conversationId?: string): string {
        if (!text || typeof text !== 'string') return '';

        const chatUrl = conversationId ? `https://chat.openai.com/c/${conversationId}` : "https://chat.openai.com";

        let cleanText = text;

        // Apply all cleanup patterns efficiently
        for (const { pattern, replacement } of this.CLEANUP_PATTERNS) {
            cleanText = cleanText.replace(pattern, replacement(chatUrl));
        }

        return cleanText.trim();
    }
}