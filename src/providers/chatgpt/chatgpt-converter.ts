// src/providers/chatgpt/chatgpt-converter.ts
import { Chat, ChatMessage, ChatGPTAttachment } from "./chatgpt-types";
import { StandardConversation, StandardMessage, StandardAttachment } from "../../types/standard";
import { isValidMessage } from "../../utils";

export class ChatGPTConverter {
    /**
     * Convert ChatGPT Chat to StandardConversation
     */
    static convertChat(chat: Chat): StandardConversation {
        const messages = this.extractMessagesFromMapping(chat);
        
        return {
            id: chat.id,
            title: chat.title,
            provider: "chatgpt",
            createTime: chat.create_time,
            updateTime: chat.update_time,
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
    static convertMessages(chatMessages: ChatMessage[]): StandardMessage[] {
        return chatMessages
            .filter(msg => isValidMessage(msg))
            .map(msg => this.convertMessage(msg));
    }

    /**
     * Convert single ChatGPT ChatMessage to StandardMessage
     */
    private static convertMessage(chatMessage: ChatMessage): StandardMessage {
        return {
            id: chatMessage.id,
            role: chatMessage.author.role === "user" ? "user" : "assistant",
            content: this.extractContent(chatMessage),
            timestamp: chatMessage.create_time,
            attachments: this.convertAttachments(chatMessage)
        };
    }

    /**
     * Convert ChatGPT attachments to StandardAttachments
     */
    private static convertAttachments(chatMessage: ChatMessage): StandardAttachment[] {
        const attachments: StandardAttachment[] = [];

        // Debug logging
        console.log('ChatGPT Converter - Processing message attachments:', {
            hasMetadataAttachments: chatMessage.metadata?.attachments ? true : false,
            metadataAttachmentsCount: chatMessage.metadata?.attachments?.length || 0,
            hasLegacyAttachments: chatMessage.attachments ? true : false,
            legacyAttachmentsCount: chatMessage.attachments?.length || 0,
            hasFiles: chatMessage.files ? true : false,
            filesCount: chatMessage.files?.length || 0
        });

        // Process attachments from metadata (new format)
        if (chatMessage.metadata?.attachments && Array.isArray(chatMessage.metadata.attachments)) {
            console.log('ChatGPT Converter - Processing metadata attachments:', chatMessage.metadata.attachments);
            for (const attachment of chatMessage.metadata.attachments) {
                const standardAttachment = {
                    fileName: attachment.name,
                    fileSize: attachment.size,
                    fileType: attachment.mime_type,
                    fileId: attachment.id // ChatGPT file ID for ZIP lookup
                };
                console.log('ChatGPT Converter - Added attachment:', {
                    fileName: standardAttachment.fileName,
                    fileSize: standardAttachment.fileSize,
                    fileType: standardAttachment.fileType,
                    fileId: standardAttachment.fileId
                });
                attachments.push(standardAttachment);
            }
        }

        // Process legacy attachments array if present
        if (chatMessage.attachments && Array.isArray(chatMessage.attachments)) {
            console.log('ChatGPT Converter - Processing legacy attachments:', chatMessage.attachments);
            for (const attachment of chatMessage.attachments) {
                // Only add if not already processed from metadata
                const alreadyExists = attachments.some(att => att.fileName === attachment.file_name);
                if (!alreadyExists) {
                    const standardAttachment = {
                        fileName: attachment.file_name,
                        fileSize: attachment.file_size,
                        fileType: attachment.file_type,
                        extractedContent: attachment.extracted_content
                    };
                    console.log('ChatGPT Converter - Added legacy attachment:', standardAttachment);
                    attachments.push(standardAttachment);
                }
            }
        }

        // Process files array if present (simpler structure)
        if (chatMessage.files && Array.isArray(chatMessage.files)) {
            console.log('ChatGPT Converter - Processing files array:', chatMessage.files);
            for (const file of chatMessage.files) {
                // Only add if not already processed from attachments array
                const alreadyExists = attachments.some(att => att.fileName === file.file_name);
                if (!alreadyExists) {
                    const standardAttachment = {
                        fileName: file.file_name
                    };
                    console.log('ChatGPT Converter - Added file:', standardAttachment);
                    attachments.push(standardAttachment);
                }
            }
        }

        console.log('ChatGPT Converter - Final attachments array:', attachments);
        return attachments;
    }

    /**
     * Convert single ChatGPT attachment to StandardAttachment
     */
    private static convertSingleAttachment(attachment: ChatGPTAttachment): StandardAttachment {
        return {
            fileName: attachment.file_name,
            fileSize: attachment.file_size,
            fileType: attachment.file_type,
            extractedContent: attachment.extracted_content
        };
    }

    /**
     * Extract messages from ChatGPT mapping structure
     */
    private static extractMessagesFromMapping(chat: Chat): StandardMessage[] {
        const messages: StandardMessage[] = [];
        
        for (const messageObj of Object.values(chat.mapping)) {
            if (messageObj?.message && isValidMessage(messageObj.message)) {
                messages.push(this.convertMessage(messageObj.message));
            }
        }
        
        // Sort by timestamp to maintain order
        return messages.sort((a, b) => a.timestamp - b.timestamp);
    }

    /**
     * Extract content from ChatGPT message parts - FIXED FOR CONVERSATION MODE
     */
    private static extractContent(chatMessage: ChatMessage): string {
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
                // Handle different content types
                if (part.content_type === "audio_transcription" && part.text && part.text.trim() !== "") {
                    textContent = part.text;
                } else if (part.content_type === "text" && part.text && part.text.trim() !== "") {
                    textContent = part.text;
                } else if (part.content_type === "multimodal_text" && part.text && part.text.trim() !== "") {
                    textContent = part.text;
                }
                // Note: audio_asset_pointer and other non-text content types are ignored for now
                // These could be handled as attachments in the future
            }
            
            // Clean up ChatGPT control characters and formatting artifacts
            if (textContent) {
                textContent = this.cleanChatGPTArtifacts(textContent);
                if (textContent.trim() !== "") {
                    contentParts.push(textContent);
                }
            }
        }
        
        return contentParts.join("\n");
    }

    /**
     * Clean ChatGPT artifacts, citations, and control characters
     * Phase 1: Remove all artifacts without trying to preserve links
     * TODO: Later add proper citation/link extraction
     */
    private static cleanChatGPTArtifacts(text: string): string {
        return text
            // Remove citation patterns: cite + identifier
            .replace(/cite[a-zA-Z0-9_\-]+/g, "")
            // Remove link patterns: link + identifier  
            .replace(/link[a-zA-Z0-9_\-]+/g, "")
            // Remove turn patterns: turn + number + search + number
            .replace(/turn\d+search\d+/g, "")
            // Remove any remaining Unicode control characters (Private Use Area E000-F8FF)
            .replace(/[\uE000-\uF8FF]/g, "")
            // Clean up multiple consecutive spaces
            .replace(/ {2,}/g, " ")
            // Clean up multiple consecutive newlines
            .replace(/\n{3,}/g, "\n\n")
            // Trim whitespace
            .trim();
    }
}