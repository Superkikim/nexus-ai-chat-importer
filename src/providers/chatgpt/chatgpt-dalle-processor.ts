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
        imagePrompts: Map<string, { prompt: string; timestamp: number }>;
        orphanedPrompts: Map<string, string>;
    } {
        const imagePrompts = new Map<string, { prompt: string; timestamp: number }>();
        const orphanedPrompts = new Map<string, string>();

        console.log(`[DALLE-EXTRACT] Starting extraction for conversation ${chat.id}`);
        let promptMessagesFound = 0;
        let promptsWithImages = 0;
        let orphanedPromptsCount = 0;

        for (const messageObj of Object.values(chat.mapping)) {
            const message = messageObj?.message;
            if (!message || message.author?.role !== "assistant") continue;

            if (this.isDallePromptMessage(message)) {
                promptMessagesFound++;
                const prompt = this.extractPromptFromJson(message);

                console.log(`[DALLE-EXTRACT] Found prompt message ${messageObj.id}`);
                console.log(`[DALLE-EXTRACT] Prompt extracted: ${prompt ? `"${prompt.substring(0, 50)}..."` : 'NULL'}`);

                if (prompt) {
                    // Recursive search in descendants until we find image or hit user message
                    const imageMessageId = this.findDalleImageInDescendants(
                        chat.mapping,
                        messageObj.id || ""
                    );

                    console.log(`[DALLE-EXTRACT] Image search result: ${imageMessageId || 'NOT FOUND'}`);

                    if (imageMessageId) {
                        promptsWithImages++;
                        // Store prompt with timestamp from prompt message
                        imagePrompts.set(imageMessageId, {
                            prompt,
                            timestamp: message.create_time || 0
                        });
                        console.log(`[DALLE-EXTRACT] ✅ Associated prompt with image ${imageMessageId}`);
                    } else {
                        orphanedPromptsCount++;
                        // No image found - store as orphaned prompt
                        orphanedPrompts.set(messageObj.id || "", prompt);
                        console.log(`[DALLE-EXTRACT] ⚠️ Orphaned prompt (no image found)`);
                    }
                } else {
                    console.log(`[DALLE-EXTRACT] ❌ Failed to extract prompt from JSON`);
                }
            }
        }

        console.log(`[DALLE-EXTRACT] Summary: ${promptMessagesFound} prompt messages, ${promptsWithImages} with images, ${orphanedPromptsCount} orphaned`);
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
     * Handles both formats:
     * - content_type: "text" with parts[0] containing JSON
     * - content_type: "code" with text containing JSON
     */
    static isDallePromptMessage(message: ChatMessage): boolean {
        if (message.author?.role !== "assistant") return false;

        // Format 1: content_type "text" with parts array
        if (message.content?.parts &&
            Array.isArray(message.content.parts) &&
            message.content.parts.length === 1 &&
            typeof message.content.parts[0] === "string") {

            const content = message.content.parts[0].trim();
            if (content.startsWith('{') && content.includes('"prompt"')) {
                return true;
            }
        }

        // Format 2: content_type "code" with text field (OpenAI inconsistency)
        if (message.content?.content_type === "code" &&
            message.content?.text &&
            typeof message.content.text === "string") {

            const content = message.content.text.trim();
            if (content.startsWith('{') && content.includes('"prompt"')) {
                return true;
            }
        }

        return false;
    }

    /**
     * Extract prompt from DALL-E JSON message
     * Handles both formats:
     * - content_type: "text" with parts[0] containing JSON
     * - content_type: "code" with text containing JSON
     */
    static extractPromptFromJson(message: ChatMessage): string | null {
        try {
            let jsonStr: string | null = null;

            // Format 1: content_type "text" with parts array
            if (message.content?.parts && message.content.parts[0]) {
                jsonStr = message.content.parts[0] as string;
                console.log(`[DALLE-PROMPT] Format 1 (text/parts): ${jsonStr.substring(0, 100)}...`);
            }
            // Format 2: content_type "code" with text field
            else if (message.content?.content_type === "code" && message.content?.text) {
                jsonStr = message.content.text as string;
                console.log(`[DALLE-PROMPT] Format 2 (code/text): ${jsonStr.substring(0, 100)}...`);
            }

            if (jsonStr) {
                const parsed = JSON.parse(jsonStr);
                const extractedPrompt = parsed.prompt || null;
                console.log(`[DALLE-PROMPT] Parsed JSON, prompt: ${extractedPrompt ? `"${extractedPrompt.substring(0, 50)}..."` : 'NULL'}`);
                return extractedPrompt;
            }
        } catch (error) {
            console.log(`[DALLE-PROMPT] ❌ JSON parse error: ${error}`);
        }
        console.log(`[DALLE-PROMPT] ❌ No JSON string found`);
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
     * The prompt will be embedded in extractedContent for display
     */
    static createDalleAttachment(contentPart: any, associatedPrompt?: string, hasImage: boolean = true): StandardAttachment {
        const fileId = contentPart.asset_pointer.includes('://')
            ? contentPart.asset_pointer.split('://')[1]
            : contentPart.asset_pointer;

        const genId = contentPart.metadata.dalle.gen_id || 'unknown';
        const width = contentPart.width || 1024;
        const height = contentPart.height || 1024;
        const fileName = `dalle_${genId}_${width}x${height}.png`;

        const prompt = associatedPrompt || contentPart.metadata.dalle.prompt;

        console.log(`[DALLE-ATTACHMENT] Creating attachment for ${fileName}`);
        console.log(`[DALLE-ATTACHMENT] associatedPrompt: ${associatedPrompt ? `"${associatedPrompt.substring(0, 50)}..."` : 'NULL'}`);
        console.log(`[DALLE-ATTACHMENT] metadata.dalle.prompt: ${contentPart.metadata.dalle.prompt ? `"${contentPart.metadata.dalle.prompt.substring(0, 50)}..."` : 'EMPTY'}`);
        console.log(`[DALLE-ATTACHMENT] Final prompt: ${prompt ? `"${prompt.substring(0, 50)}..."` : 'NULL'}`);

        // Create extracted content with prompt in callout
        let extractedContent = '';
        if (prompt) {
            extractedContent = `>[!nexus_prompt] **Prompt**\n> ${prompt.split('\n').join('\n> ')}`;
            console.log(`[DALLE-ATTACHMENT] ✅ extractedContent created (${extractedContent.length} chars)`);
        } else {
            console.log(`[DALLE-ATTACHMENT] ⚠️ No prompt, extractedContent will be empty`);
        }

        // If no image found, add warning
        if (!hasImage) {
            if (extractedContent) extractedContent += '\n\n';
            extractedContent += `>[!nexus_attachment] **Image Not Found**\n> ⚠️ Image could not be found. Perhaps it was not generated or is missing from the archive.`;
        }

        return {
            fileName,
            fileSize: contentPart.size_bytes,
            fileType: "image/png", // Will be corrected dynamically by extractor
            fileId,
            extractedContent,

            // Provider-agnostic metadata
            attachmentType: 'generated_image',
            generationPrompt: prompt,

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
    static createDalleAssistantMessage(
        toolMessage: ChatMessage,
        associatedPrompt?: string,
        promptTimestamp?: number
    ): StandardMessage | null {
        console.log(`[DALLE-MESSAGE] Creating DALL-E assistant message for ${toolMessage.id}`);
        console.log(`[DALLE-MESSAGE] associatedPrompt: ${associatedPrompt ? `"${associatedPrompt.substring(0, 50)}..."` : 'NULL'}`);
        console.log(`[DALLE-MESSAGE] promptTimestamp: ${promptTimestamp || 'NULL'}`);

        if (!toolMessage.content?.parts || !Array.isArray(toolMessage.content.parts)) {
            console.log(`[DALLE-MESSAGE] ❌ No parts in tool message`);
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

                    const dalleAttachment = this.createDalleAttachment(contentPart, associatedPrompt, true);
                    attachments.push(dalleAttachment);
                    console.log(`[DALLE-MESSAGE] ✅ Added DALL-E attachment`);
                }
            }
        }

        if (attachments.length === 0) {
            console.log(`[DALLE-MESSAGE] ❌ No attachments created`);
            return null;
        }

        console.log(`[DALLE-MESSAGE] ✅ Created message with ${attachments.length} attachment(s)`);
        return {
            id: toolMessage.id || "",
            role: "assistant",
            content: "DALL-E Generated Image",
            // Use prompt timestamp if available, otherwise fall back to tool message timestamp
            timestamp: promptTimestamp || toolMessage.create_time || 0,
            attachments: attachments
        };
    }

    /**
     * Create informational message for orphaned DALL-E prompt (no image found)
     * Creates a "phantom" attachment with the prompt and warning
     */
    static createOrphanedPromptMessage(promptMessage: ChatMessage, prompt: string): StandardMessage {
        // Create a phantom attachment with prompt and warning
        const phantomAttachment: StandardAttachment = {
            fileName: 'dalle_image_not_found.png',
            fileType: 'image/png',
            attachmentType: 'generated_image',
            generationPrompt: prompt,
            extractedContent: `>[!nexus_prompt] **Prompt**\n> ${prompt.split('\n').join('\n> ')}\n\n>[!nexus_attachment] **Image Not Found**\n> ⚠️ Image could not be found. Perhaps it was not generated or is missing from the archive.`,
            status: {
                processed: true,
                found: false,
                reason: 'missing_from_export',
                note: 'DALL-E generation was requested but the image was not found in the archive'
            }
        };

        return {
            id: promptMessage.id || "",
            role: "assistant",
            content: "DALL-E Generated Image",
            timestamp: promptMessage.create_time || 0,
            attachments: [phantomAttachment]
        };
    }
}
