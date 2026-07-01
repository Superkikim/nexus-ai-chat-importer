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

// src/providers/chatgpt/chatgpt-converter.ts
import { Chat, ChatMessage, ContentPart } from "./chatgpt-types";
import {
    StandardConversation,
    StandardMessage,
    StandardAttachment,
} from "../../types/standard";
import { ChatGPTDalleProcessor } from "./chatgpt-dalle-processor";
import { ChatGPTMessageFilter } from "./chatgpt-message-filter";
import { transformCanvasDirectives } from "./chatgpt-canvas-directives";
import { annotateMissingGeneratedImages } from "./chatgpt-generated-image";
import { sortMessagesByTimestamp } from "../../utils/message-utils";

export class ChatGPTConverter {
    /**
     * Convert ChatGPT Chat to StandardConversation
     */
    static convertChat(chat: Chat): StandardConversation {
        const messages = this.extractMessagesFromMapping(chat);
        const models = this.extractConversationModels(chat, messages);

        return {
            id: chat.id || "",
            title: chat.title || "Untitled",
            provider: "chatgpt",
            createTime: chat.create_time || 0,
            updateTime: chat.update_time || 0,
            messages: messages,
            metadata: {
                models,
                conversation_template_id: chat.conversation_template_id,
                gizmo_id: chat.gizmo_id,
                gizmo_type: chat.gizmo_type,
                default_model_slug: chat.default_model_slug,
                is_archived: chat.is_archived,
                is_starred: chat.is_starred,
                current_node: chat.current_node,
                memory_scope: chat.memory_scope,
            },
        };
    }

    /**
     * Convert single ChatGPT ChatMessage to StandardMessage
     */
    private static convertMessage(
        chatMessage: ChatMessage,
        conversationId?: string
    ): StandardMessage {
        const contentResult = this.extractContent(chatMessage, conversationId);
        const model =
            typeof chatMessage.metadata?.model_slug === "string"
                ? chatMessage.metadata.model_slug
                : undefined;

        return {
            id: chatMessage.id || "",
            role: chatMessage.author?.role === "user" ? "user" : "assistant",
            content: contentResult.content,
            timestamp: chatMessage.create_time || 0,
            model,
            attachments: contentResult.attachments || [],
        };
    }

    private static extractConversationModels(
        chat: Chat,
        messages: StandardMessage[]
    ): string[] {
        const candidates = [
            chat.default_model_slug,
            ...messages.map((message) => message.model),
        ];

        const seen = new Set<string>();
        const models: string[] = [];
        for (const candidate of candidates) {
            const normalized = (candidate || "").trim();
            if (!normalized || seen.has(normalized)) continue;
            seen.add(normalized);
            models.push(normalized);
        }

        return models;
    }

    /**
     * Extract messages from ChatGPT mapping structure with DALL-E prompt association
     */
    private static extractMessagesFromMapping(chat: Chat): StandardMessage[] {
        const messages: StandardMessage[] = [];
        const conversationId = chat.id; // Pass conversation ID for smart linking

        // Extract DALL-E prompts using centralized processor (with orphaned prompts support)
        const { imagePrompts, orphanedPrompts } =
            ChatGPTDalleProcessor.extractDallePromptsFromMapping(chat);

        // Process all messages
        for (const messageObj of Object.values(chat.mapping)) {
            const message = messageObj?.message;
            if (!message) continue;

            // Handle DALL-E tool messages with images using processor
            if (
                message.author?.role === "tool" &&
                ChatGPTDalleProcessor.hasRealDalleImage(message)
            ) {
                const promptData = imagePrompts.get(messageObj.id || "");
                const dalleMessage =
                    ChatGPTDalleProcessor.createDalleAssistantMessage(
                        message,
                        promptData?.prompt,
                        promptData?.timestamp
                    );
                if (dalleMessage) {
                    messages.push(dalleMessage);
                }
            }
            // Handle orphaned DALL-E prompts (no image found)
            else if (orphanedPrompts.has(messageObj.id || "")) {
                const prompt = orphanedPrompts.get(messageObj.id || "");
                if (prompt) {
                    const orphanedMessage =
                        ChatGPTDalleProcessor.createOrphanedPromptMessage(
                            message,
                            prompt
                        );
                    messages.push(orphanedMessage);
                }
            }
            // Handle regular messages (but skip DALL-E JSON prompts)
            else if (ChatGPTMessageFilter.shouldIncludeMessage(message)) {
                messages.push(this.convertMessage(message, conversationId));
            }
        }

        // Sort by timestamp with ID as secondary sort for chronological order
        const ordered =
            messages.length <= 1 ? messages : sortMessagesByTimestamp(messages);

        // Surface generated images that recent exports omit entirely (no-op for
        // conversations that still carry their generated images).
        return annotateMissingGeneratedImages(ordered, chat);
    }

    /**
     * Extract content and attachments from ChatGPT message parts
     */
    private static extractContent(
        chatMessage: ChatMessage,
        conversationId?: string
    ): { content: string; attachments?: StandardAttachment[] } {
        if (
            !chatMessage.content?.parts ||
            !Array.isArray(chatMessage.content.parts)
        ) {
            return { content: "" };
        }

        const contentParts: string[] = [];
        const attachments: StandardAttachment[] = [];

        for (const part of chatMessage.content.parts) {
            let textContent = "";

            if (typeof part === "string" && part.trim() !== "") {
                // FIXED: Check if string contains JSON with type/content structure
                if (part.trim().startsWith("{") && part.trim().endsWith("}")) {
                    try {
                        const parsed = JSON.parse(part);
                        if (
                            parsed.type &&
                            parsed.content &&
                            typeof parsed.content === "string"
                        ) {
                            const codeType = parsed.type;
                            const codeContent = parsed.content;

                            if (codeContent.trim() !== "") {
                                // Extract language from type (e.g., "code/markdown" -> "markdown")
                                const language = codeType.includes("/")
                                    ? codeType.split("/")[1]
                                    : codeType;
                                textContent = `\`\`\`${language}\n${codeContent}\n\`\`\``;
                            }
                        } else {
                            // JSON without type/content, treat as normal text
                            textContent = part;
                        }
                    } catch {
                        // Not valid JSON, treat as normal text
                        textContent = part;
                    }
                } else {
                    // Normal string
                    textContent = part;
                }
            } else if (typeof part === "object" && part !== null) {
                // Handle code blocks with type and content structure (ChatGPT artifacts)
                if (
                    "type" in part &&
                    "content" in part &&
                    typeof part.content === "string"
                ) {
                    const codeType = part.type as string;
                    const codeContent = part.content;

                    if (codeContent.trim() !== "") {
                        // Extract language from type (e.g., "code/markdown" -> "markdown")
                        const language = codeType.includes("/")
                            ? codeType.split("/")[1]
                            : codeType;
                        textContent = `\`\`\`${language}\n${codeContent}\n\`\`\``;
                    }
                }
                // Handle different content types with proper type checking
                else if (
                    "content_type" in part &&
                    "text" in part &&
                    typeof part.text === "string"
                ) {
                    if (
                        part.content_type === "audio_transcription" &&
                        part.text.trim() !== ""
                    ) {
                        textContent = part.text;
                    } else if (
                        part.content_type === "text" &&
                        part.text.trim() !== ""
                    ) {
                        textContent = part.text;
                    } else if (
                        part.content_type === "multimodal_text" &&
                        part.text.trim() !== ""
                    ) {
                        textContent = part.text;
                    }
                }
                // Handle image_asset_pointer content types as attachments
                else if (
                    "content_type" in part &&
                    part.content_type === "image_asset_pointer" &&
                    "asset_pointer" in part
                ) {
                    const attachment = this.extractImageAttachment(
                        part,
                        conversationId
                    );
                    if (attachment) {
                        attachments.push(attachment);
                    }
                }
            }

            // Clean up ChatGPT control characters and formatting artifacts
            if (textContent) {
                // Strip ChatGPT private-use markers (e.g. U+E202 between
                // "products" and "{") before searching for the token.
                const strippedForSearch = textContent.replace(/[-]/g, "");
                if (strippedForSearch.includes("products{")) {
                    textContent = this.replaceProductTokens(
                        strippedForSearch,
                        chatMessage.metadata?.content_references,
                        conversationId
                    );
                }
                textContent = this.cleanChatGPTArtifacts(
                    textContent,
                    conversationId
                );
                if (textContent.trim() !== "") {
                    contentParts.push(textContent);
                }
            }
        }

        const finalContent = contentParts.join("\n");

        // User uploads live in metadata.attachments ({id, name, size, mime_type}).
        // Images also appear as image_asset_pointer parts (handled above) with a
        // synthetic filename — merge by fileId to restore the original name, and
        // add non-image uploads (PDF, docs) that have no content part at all.
        if (Array.isArray(chatMessage.metadata?.attachments)) {
            for (const metaAtt of chatMessage.metadata.attachments) {
                if (!metaAtt?.id || !metaAtt?.name) continue;

                const existing = attachments.find(
                    (att) => att.fileId === metaAtt.id
                );
                if (existing) {
                    existing.fileName = metaAtt.name;
                    if (metaAtt.mime_type) {
                        existing.fileType = metaAtt.mime_type;
                    }
                    if (metaAtt.size && !existing.fileSize) {
                        existing.fileSize = metaAtt.size;
                    }
                } else {
                    attachments.push({
                        fileName: metaAtt.name,
                        fileType:
                            metaAtt.mime_type || "application/octet-stream",
                        fileSize: metaAtt.size,
                        fileId: metaAtt.id,
                    });
                }
            }
        }

        // Legacy top-level attachments (used by the DALL-E round-trip in
        // getNewMessages); keep with an anti-duplicate guard
        if (chatMessage.attachments) {
            for (const att of chatMessage.attachments) {
                if (!att.file_name) continue;
                const alreadyAdded = attachments.some(
                    (existing) => existing.fileName === att.file_name
                );
                if (alreadyAdded) continue;
                attachments.push({
                    fileName: att.file_name,
                    fileType: att.file_type || "application/octet-stream",
                    fileSize: att.file_size,
                    extractedContent: att.extracted_content,
                });
            }
        }

        return {
            content: finalContent,
            attachments: attachments.length > 0 ? attachments : undefined,
        };
    }

    /**
     * Extract image attachment from content part
     */
    private static extractImageAttachment(
        part: ContentPart,
        _conversationId?: string
    ): StandardAttachment | null {
        if (!part.asset_pointer) return null;

        // Extract file ID from asset pointer
        let fileId = part.asset_pointer;
        if (fileId.includes("://")) {
            fileId = fileId.split("://")[1];
        }

        // Generate filename based on metadata
        let fileName = `image_${fileId}`;
        if (part.width && part.height) {
            fileName = `image_${fileId}_${part.width}x${part.height}`;
        }

        // Determine file extension from metadata or default to png
        const fileType = part.metadata?.mime_type || "image/png";
        const extension = fileType.split("/")[1] || "png";
        fileName += `.${extension}`;

        return {
            fileName,
            fileType,
            fileSize: part.size_bytes,
            fileId,
        };
    }

    // Pre-compiled regex patterns for performance
    private static readonly CLEANUP_PATTERNS = [
        // SMART: Replace sandbox links with actual links to original conversation
        {
            pattern: /📄 \[([^\]]+)\]\(sandbox:\/[^)]+\)/g,
            replacement: (chatUrl: string) =>
                `📄 [$1](${chatUrl}) *(visit original conversation to download)*`,
        },
        {
            pattern: /📄 ([^-\n]+) - File not available in archive/g,
            replacement: (chatUrl: string) =>
                `📄 [$1](${chatUrl}) *(visit original conversation to download)*`,
        },
        {
            pattern: /\[([^\]]+)\]\(sandbox:\/[^)]+\)/g,
            replacement: (chatUrl: string) =>
                `[$1](${chatUrl}) *(visit original conversation to download)*`,
        },
        {
            pattern:
                /([^-\n]+) - File not available in archive\. Visit the original conversation to access it/g,
            replacement: (chatUrl: string) =>
                `[$1](${chatUrl}) *(visit original conversation to download)*`,
        },
        // Remove patterns (static replacements)
        { pattern: /cite[a-zA-Z0-9_-]+/g, replacement: () => "" },
        { pattern: /link[a-zA-Z0-9_-]+/g, replacement: () => "" },
        { pattern: /turn\d+search\d+/g, replacement: () => "" },
        { pattern: /[\uE000-\uF8FF]/g, replacement: () => "" }, // Unicode control characters
        { pattern: / {2,}/g, replacement: () => " " }, // Multiple spaces
        { pattern: /\n{3,}/g, replacement: () => "\n\n" }, // Multiple newlines
    ];

    /**
     * Replace products{...} UI tokens with a readable nexus_attachment callout.
     *
     * ChatGPT embeds a product-carousel token in the text to mark where its web
     * app injects an Amazon/shopping widget. Product images and purchase links
     * are never included in the export. We render name, category and price from
     * metadata.content_references so the information is not lost, then point to
     * the original conversation for the full visual experience.
     */
    private static replaceProductTokens(
        text: string,
        contentReferences: unknown[] | undefined,
        conversationId?: string
    ): string {
        // ChatGPT wraps the token with Unicode private-use markers (e.g. U+E202)
        // between "products" and "{". Strip them so the plain form is matched.
        const decoded = text.replace(/[-]/g, "");
        if (!decoded.includes("products{")) return text;

        // The cite ID in the token ("turn461031productN") and in content_references
        // ("turn1productN") share only the "productN" suffix — normalize on that.
        const normCite = (cite: string) =>
            cite.match(/product\d+$/)?.[0] ?? cite;

        const byNorm = new Map<
            string,
            { title: string; price?: string; tag?: string; merchant?: string }
        >();
        type ProductRef = {
            cite?: string;
            title?: string;
            price?: string;
            featured_tag?: string;
            merchants?: string;
        };
        for (const cr of contentReferences ?? []) {
            const products =
                (cr as { products?: ProductRef[] })?.products ?? [];
            for (const p of products) {
                if (p?.cite) {
                    byNorm.set(normCite(p.cite), {
                        title: p.title || "",
                        price: p.price || undefined,
                        tag: p.featured_tag || undefined,
                        // "Amazon.de - Amazon.de-Seller" -> "Amazon.de"
                        merchant: p.merchants
                            ? p.merchants.split(" - ")[0]
                            : undefined,
                    });
                }
            }
        }

        const chatUrl = conversationId
            ? `https://chatgpt.com/c/${conversationId}`
            : "https://chatgpt.com";

        // Match products{...} -- the JSON has no nested objects, only arrays
        return decoded.replace(/products\{([^]*?)\}(?=\n|$)/gm, (match) => {
            let selections: [string, string][] = [];
            try {
                const inner = match.slice("products".length);
                const parsed = JSON.parse(inner);
                selections = parsed.selections ?? [];
            } catch {
                return "";
            }

            if (selections.length === 0) return "";

            const rows = selections.map(([cite, fallbackName]) => {
                const prod = byNorm.get(normCite(cite));
                return {
                    title: prod?.title || fallbackName || cite,
                    tag: prod?.tag,
                    price: prod?.price,
                    merchant: prod?.merchant,
                };
            });

            const hasTag = rows.some((r) => r.tag);
            const hasPrice = rows.some((r) => r.price);
            const hasMerchant = rows.some((r) => r.merchant);

            const cols = ["Product"];
            if (hasTag) cols.push("Category");
            if (hasPrice) cols.push("Price");
            if (hasMerchant) cols.push("Merchant");

            const header = `> | ${cols.join(" | ")} |`;
            const divider = `> | ${cols.map(() => "---").join(" | ")} |`;
            const tableRows = rows.map((r) => {
                const cells = [r.title];
                if (hasTag) cells.push(r.tag ?? "");
                if (hasPrice) cells.push(r.price ?? "");
                if (hasMerchant) cells.push(r.merchant ?? "");
                return `> | ${cells.join(" | ")} |`;
            });

            return [
                `>[!nexus_attachment]- **Product recommendations**`,
                `>`,
                header,
                divider,
                ...tableRows,
                `>`,
                `> *(images not in export · [view in ChatGPT](${chatUrl}))*`,
            ].join("\n");
        });
    }

    /**
     * Clean ChatGPT artifacts, citations, and control characters - SMART LINKING
     */
    private static cleanChatGPTArtifacts(
        text: string,
        conversationId?: string
    ): string {
        if (!text || typeof text !== "string") return "";

        const chatUrl = conversationId
            ? `https://chatgpt.com/c/${conversationId}`
            : "https://chatgpt.com";

        let cleanText = text;

        // Apply all cleanup patterns efficiently
        for (const { pattern, replacement } of this.CLEANUP_PATTERNS) {
            cleanText = cleanText.replace(pattern, replacement(chatUrl));
        }

        // Convert Canvas ":::writing{...}" directives into nested callouts so
        // the raw directive syntax never leaks into the note (no-op otherwise).
        cleanText = transformCanvasDirectives(cleanText);

        return cleanText.trim();
    }
}
