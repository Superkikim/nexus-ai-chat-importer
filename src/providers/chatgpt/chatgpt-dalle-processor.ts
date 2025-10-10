// src/providers/chatgpt/chatgpt-dalle-processor.ts
import { Chat, ChatMessage } from "./chatgpt-types";
import { StandardMessage, StandardAttachment } from "../../types/standard";

/**
 * Centralized processor for ChatGPT DALL-E image generation handling
 * Manages prompt association, image detection, and attachment creation
 */
export class ChatGPTDalleProcessor {
    /**
     * Extract DALL-E prompts from chat mapping using recursive descendant search
     * Returns both matched prompts (image found) and orphaned prompts (no image found)
     */
    static extractDallePromptsFromMapping(chat: Chat): {
        imagePrompts: Map<string, string>;
        orphanedPrompts: Map<string, string>;
    } {
        const imagePrompts = new Map<string, string>();
        const orphanedPrompts = new Map<string, string>();

        for (const messageObj of Object.values(chat.mapping)) {
            const message = messageObj?.message;
            if (!message || message.author?.role !== "assistant") continue;

            if (this.isDallePromptMessage(message)) {
                const prompt = this.extractPromptFromJson(message);
                if (prompt) {
                    // Recursive search in descendants until we find image or hit user message
                    const imageMessageId = this.findDalleImageInDescendants(
                        chat.mapping,
                        messageObj.id || ""
                    );

                    if (imageMessageId) {
                        imagePrompts.set(imageMessageId, prompt);
                    } else {
                        // No image found - store as orphaned prompt
                        orphanedPrompts.set(messageObj.id || "", prompt);
                    }
                }
            }
        }

        return { imagePrompts, orphanedPrompts };
    }

    /**
     * Recursively search for DALL-E image in descendants
     * Stops at first user message encountered (limit to prevent going too far)
     */
    private static findDalleImageInDescendants(
        mapping: Record<string, any>,
        startId: string
    ): string | null {
        const queue = [startId];
        const visited = new Set<string>();

        while (queue.length > 0) {
            const currentId = queue.shift()!;

            if (visited.has(currentId)) continue;
            visited.add(currentId);

            const currentObj = mapping[currentId];
            if (!currentObj) continue;

            const message = currentObj.message;

            // LIMIT: Stop if we encounter a user message
            if (message?.author?.role === "user") {
                return null;
            }

            // Check if this is a DALL-E image
            if (message?.author?.role === "tool" && this.hasRealDalleImage(message)) {
                return currentId;
            }

            // Continue with children
            const children = currentObj.children || [];
            queue.push(...children);
        }

        return null;
    }

    /**
     * Check if message is a DALL-E JSON prompt message
     */
    static isDallePromptMessage(message: ChatMessage): boolean {
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
    static extractPromptFromJson(message: ChatMessage): string | null {
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
     * Check if message contains REAL DALL-E image (not user upload)
     */
    static hasRealDalleImage(message: ChatMessage): boolean {
        if (!message.content?.parts || !Array.isArray(message.content.parts)) {
            return false;
        }
        
        return message.content.parts.some(part => {
            if (typeof part !== "object" || part === null) return false;
            
            const contentPart = part as any;
            return contentPart.content_type === "image_asset_pointer" && 
                   contentPart.asset_pointer &&
                   contentPart.metadata?.dalle && 
                   contentPart.metadata.dalle !== null;
        });
    }

    /**
     * Create StandardAttachment for DALL-E image with provider-agnostic metadata
     */
    static createDalleAttachment(contentPart: any, associatedPrompt?: string): StandardAttachment {
        const fileId = contentPart.asset_pointer.includes('://') 
            ? contentPart.asset_pointer.split('://')[1] 
            : contentPart.asset_pointer;
            
        const genId = contentPart.metadata.dalle.gen_id || 'unknown';
        const width = contentPart.width || 1024;
        const height = contentPart.height || 1024;
        const fileName = `dalle_${genId}_${width}x${height}.png`;
        
        return {
            fileName,
            fileSize: contentPart.size_bytes,
            fileType: "image/png", // Will be corrected dynamically by extractor
            fileId,
            
            // Provider-agnostic metadata
            attachmentType: 'generated_image',
            generationPrompt: associatedPrompt || contentPart.metadata.dalle.prompt,
            
            // Provider-specific metadata
            providerMetadata: {
                dalle: {
                    gen_id: contentPart.metadata.dalle.gen_id,
                    seed: contentPart.metadata.dalle.seed,
                    parent_gen_id: contentPart.metadata.dalle.parent_gen_id,
                    edit_op: contentPart.metadata.dalle.edit_op
                }
            }
        };
    }

    /**
     * Create Assistant (DALL-E) message from tool message with associated prompt
     */
    static createDalleAssistantMessage(toolMessage: ChatMessage, associatedPrompt?: string): StandardMessage | null {
        if (!toolMessage.content?.parts || !Array.isArray(toolMessage.content.parts)) {
            return null;
        }

        const attachments: StandardAttachment[] = [];
        
        for (const part of toolMessage.content.parts) {
            if (typeof part === "object" && part !== null) {
                const contentPart = part as any;
                if (contentPart.content_type === "image_asset_pointer" && 
                    contentPart.asset_pointer &&
                    contentPart.metadata?.dalle &&
                    contentPart.metadata.dalle !== null) {
                    
                    const dalleAttachment = this.createDalleAttachment(contentPart, associatedPrompt);
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
     * Create informational message for orphaned DALL-E prompt (no image found)
     */
    static createOrphanedPromptMessage(promptMessage: ChatMessage, prompt: string): StandardMessage {
        return {
            id: promptMessage.id || "",
            role: "assistant",
            content: `⚠️ DALL-E generation requested but image not found in archive\n\n**Prompt:**\n${prompt}`,
            timestamp: promptMessage.create_time || 0,
            attachments: []
        };
    }
}
