// src/services/conversation-processor.ts
import { TFile } from "obsidian";
import { ConversationCatalogEntry } from "../types/plugin";
import { StandardConversation, StandardMessage } from "../types/standard";
import { ImportReport } from "../models/import-report";
import { MessageFormatter } from "../formatters/message-formatter";
import { NoteFormatter } from "../formatters/note-formatter";
import { FileService } from "./file-service";
import { ChatGPTConverter } from "../providers/chatgpt/chatgpt-converter";
import { ChatGPTAttachmentExtractor } from "../providers/chatgpt/chatgpt-attachment-extractor";
import { Chat } from "../providers/chatgpt/chatgpt-types";
import JSZip from "jszip";
import { 
    formatTimestamp, 
    formatTitle, 
    isValidMessage,
    generateFileName,
    ensureFolderExists,
    doesFilePathExist,
    generateUniqueFileName
} from "../utils";
import type NexusAiChatImporterPlugin from "../main";

export class ConversationProcessor {
    private messageFormatter: MessageFormatter;
    private fileService: FileService;
    private noteFormatter: NoteFormatter;
    private chatgptAttachmentExtractor: ChatGPTAttachmentExtractor;
    private counters = {
        totalExistingConversations: 0,
        totalNewConversationsToImport: 0,
        totalExistingConversationsToUpdate: 0,
        totalNewConversationsSuccessfullyImported: 0,
        totalConversationsActuallyUpdated: 0,
        totalConversationsProcessed: 0,
        totalNonEmptyMessagesToImport: 0,
        totalNonEmptyMessagesToAdd: 0,
        totalNonEmptyMessagesAdded: 0,
    };

    constructor(private plugin: NexusAiChatImporterPlugin) {
            this.messageFormatter = new MessageFormatter(plugin.logger);
            this.fileService = new FileService(plugin);
            this.noteFormatter = new NoteFormatter(plugin.logger, plugin.manifest.id, plugin.manifest.version);
            this.chatgptAttachmentExtractor = new ChatGPTAttachmentExtractor(plugin, plugin.logger);
    }

    /**
     * Process raw conversations (provider agnostic entry point)
     */
    async processRawConversations(rawConversations: any[], importReport: ImportReport, zip?: JSZip, isReprocess: boolean = false): Promise<ImportReport> {
        // Detect provider from raw data structure
        const provider = this.detectProvider(rawConversations);
        
        switch (provider) {
            case 'chatgpt':
                return this.processChatGPTConversations(rawConversations as Chat[], importReport, zip, isReprocess);
            default:
                importReport.addError("Unknown provider", `Could not detect conversation provider from data structure`);
                return importReport;
        }
    }

    /**
     * Get provider name for current processing session
     */
    getCurrentProvider(): string {
        return this.currentProvider || 'unknown';
    }

    private currentProvider: string = 'unknown';

    /**
     * Detect provider from conversation data structure
     */
    private detectProvider(rawConversations: any[]): string {
        if (rawConversations.length === 0) return 'unknown';
        
        const sample = rawConversations[0];
        
        // ChatGPT detection: has mapping property and typical structure
        if (sample.mapping && sample.create_time && sample.update_time && sample.title) {
            return 'chatgpt';
        }
        
        // Future: Add Claude detection, etc.
        // if (sample.messages && sample.account && sample.uuid) {
        //     return 'claude';
        // }
        
        return 'unknown';
    }

    /**
     * Process ChatGPT conversations specifically
     */
    private async processChatGPTConversations(chats: Chat[], importReport: ImportReport, zip?: JSZip, isReprocess: boolean = false): Promise<ImportReport> {
        this.currentProvider = 'chatgpt';
        const storage = this.plugin.getStorageService();
        
        // Scan existing conversations from vault instead of loading catalog
        const existingConversationsMap = await storage.scanExistingConversations();
        this.counters.totalExistingConversations = existingConversationsMap.size;

        for (const chat of chats) {
            await this.processSingleChatGPTChat(chat, existingConversationsMap, importReport, zip, isReprocess);
        }

        return importReport;
    }

    private async processSingleChatGPTChat(
        chat: Chat,
        existingConversations: Map<string, ConversationCatalogEntry>,
        importReport: ImportReport,
        zip?: JSZip,
        isReprocess: boolean = false
    ): Promise<void> {
        try {
            const existingEntry = existingConversations.get(chat.id);
            
            if (existingEntry) {
                await this.handleExistingChatGPTChat(chat, existingEntry, importReport, zip, isReprocess);
            } else {
                const filePath = await this.generateFilePath(chat);
                await this.handleNewChatGPTChat(chat, filePath, importReport, zip);
            }
            this.counters.totalConversationsProcessed++;
        } catch (error: any) {
            const errorMessage = error.message || "Unknown error occurred";
            importReport.addError(`Error processing chat: ${chat.title || "Untitled"}`, errorMessage);
        }
    }

    private async handleExistingChatGPTChat(
        chat: Chat,
        existingRecord: ConversationCatalogEntry,
        importReport: ImportReport,
        zip?: JSZip,
        isReprocess: boolean = false
    ): Promise<void> {
        const totalMessageCount = Object.values(chat.mapping)
            .filter(msg => isValidMessage(msg.message)).length;

        // Check if the file actually exists
        const fileExists = await this.plugin.app.vault.adapter.exists(existingRecord.path);
        
        if (!fileExists) {
            // File was deleted, recreate it
            await this.handleNewChatGPTChat(chat, existingRecord.path, importReport, zip);
            return;
        }

        // REPROCESS LOGIC: Force update if this is a reprocess operation
        if (isReprocess) {
            this.plugin.logger.info(`Reprocessing conversation: ${chat.title || "Untitled"}`);
            this.counters.totalExistingConversationsToUpdate++;
            await this.updateExistingChatGPTNote(chat, existingRecord.path, totalMessageCount, importReport, zip, true); // Force update
            return;
        }

        // Normal logic: Check timestamps
        if (existingRecord.updateTime >= chat.update_time) {
            importReport.addSkipped(
                chat.title || "Untitled",
                existingRecord.path,
                formatTimestamp(chat.create_time, "date"),
                formatTimestamp(chat.update_time, "date"),
                totalMessageCount,
                "No Updates"
            );
        } else {
            this.counters.totalExistingConversationsToUpdate++;
            await this.updateExistingChatGPTNote(chat, existingRecord.path, totalMessageCount, importReport, zip);
        }
    }

    private async handleNewChatGPTChat(
        chat: Chat,
        filePath: string,
        importReport: ImportReport,
        zip?: JSZip
    ): Promise<void> {
        this.counters.totalNewConversationsToImport++;
        await this.createNewChatGPTNote(chat, filePath, importReport, zip);
    }

    private async updateExistingChatGPTNote(
        chat: Chat,
        filePath: string,
        totalMessageCount: number,
        importReport: ImportReport,
        zip?: JSZip,
        forceUpdate: boolean = false
    ): Promise<void> {
        try {
            const file = this.plugin.app.vault.getAbstractFileByPath(filePath);
            if (file instanceof TFile) {
                let content = await this.plugin.app.vault.read(file);
                const originalContent = content;

                content = this.updateMetadata(content, chat.update_time);
                const existingMessageIds = this.extractMessageUIDsFromNote(content);
                const newMessages = this.getNewChatGPTMessages(chat, existingMessageIds);

                let attachmentStats: { total: number; found: number; missing: number; failed: number } | undefined = undefined;

                // REPROCESS LOGIC: If forced update, recreate the entire note with attachment support
                if (forceUpdate) {
                    // Convert entire chat to standard format with attachments
                    let standardConversation = ChatGPTConverter.convertChat(chat);
                    
                    // Process attachments if ZIP provided and settings enabled
                    if (zip && this.plugin.settings.importAttachments) {
                        standardConversation.messages = await this.processMessageAttachments(
                            standardConversation.messages,
                            chat.id,
                            "chatgpt",
                            zip
                        );
                        
                        // Calculate attachment stats
                        attachmentStats = this.calculateAttachmentStats(standardConversation.messages);
                    }
                    
                    // Regenerate entire content
                    const newContent = this.noteFormatter.generateMarkdownContent(standardConversation);
                    await this.fileService.writeToFile(filePath, newContent);
                    
                    importReport.addUpdated(
                        chat.title || "Untitled",
                        filePath,
                        `${formatTimestamp(chat.create_time, "date")} ${formatTimestamp(chat.create_time, "time")}`,
                        `${formatTimestamp(chat.update_time, "date")} ${formatTimestamp(chat.update_time, "time")}`,
                        totalMessageCount,
                        attachmentStats
                    );
                    
                    this.counters.totalConversationsActuallyUpdated++;
                    return;
                }

                // Normal update logic (existing messages)
                if (newMessages.length > 0) {
                    // Convert ChatGPT messages to standard format
                    let standardMessages = ChatGPTConverter.convertMessages(newMessages);
                    
                    // Process attachments if ZIP provided and settings enabled
                    if (zip && this.plugin.settings.importAttachments) {
                        standardMessages = await this.processMessageAttachments(
                            standardMessages, 
                            chat.id, 
                            "chatgpt", 
                            zip
                        );
                    }
                    
                    // Always calculate attachment stats (even if not processed)
                    attachmentStats = this.calculateAttachmentStats(standardMessages);
                    
                    content += "\n\n" + this.messageFormatter.formatMessages(standardMessages);
                    this.counters.totalConversationsActuallyUpdated++;
                    this.counters.totalNonEmptyMessagesAdded += newMessages.length;
                }

                if (content !== originalContent) {
                    await this.fileService.writeToFile(filePath, content);
                    
                    importReport.addUpdated(
                        chat.title || "Untitled",
                        filePath,
                        `${formatTimestamp(chat.create_time, "date")} ${formatTimestamp(chat.create_time, "time")}`,
                        `${formatTimestamp(chat.update_time, "date")} ${formatTimestamp(chat.update_time, "time")}`,
                        newMessages.length,
                        attachmentStats
                    );
                } else {
                    importReport.addSkipped(
                        chat.title || "Untitled",
                        filePath,
                        `${formatTimestamp(chat.create_time, "date")} ${formatTimestamp(chat.create_time, "time")}`,
                        `${formatTimestamp(chat.update_time, "date")} ${formatTimestamp(chat.update_time, "time")}`,
                        totalMessageCount,
                        "No changes needed"
                    );
                }
            }
        } catch (error: any) {
            this.plugin.logger.error("Error updating note", error.message);
        }
    }

    private async createNewChatGPTNote(
        chat: Chat,
        filePath: string,
        importReport: ImportReport,
        zip?: JSZip
    ): Promise<void> {
        try {
            // Ensure the folder exists (in case it was deleted)
            const folderPath = filePath.substring(0, filePath.lastIndexOf('/'));
            const folderResult = await ensureFolderExists(folderPath, this.plugin.app.vault);
            if (!folderResult.success) {
                throw new Error(folderResult.error || "Failed to ensure folder exists.");
            }

            // Convert ChatGPT format to standard format
            let standardConversation = ChatGPTConverter.convertChat(chat);
                        
            // Process attachments if ZIP provided and settings enabled
            let attachmentStats = { total: 0, found: 0, missing: 0, failed: 0 };
            if (zip && this.plugin.settings.importAttachments) {
                standardConversation.messages = await this.processMessageAttachments(
                    standardConversation.messages,
                    chat.id,
                    "chatgpt",
                    zip
                );
                
                // Calculate attachment stats
                attachmentStats = this.calculateAttachmentStats(standardConversation.messages);
            }
            
            const content = this.noteFormatter.generateMarkdownContent(standardConversation);
            
            await this.fileService.writeToFile(filePath, content);

            const messageCount = Object.values(chat.mapping)
                .filter(msg => isValidMessage(msg.message)).length;

            importReport.addCreated(
                chat.title || "Untitled",
                filePath,
                `${formatTimestamp(chat.create_time, "date")} ${formatTimestamp(chat.create_time, "time")}`,
                `${formatTimestamp(chat.update_time, "date")} ${formatTimestamp(chat.update_time, "time")}`,
                messageCount,
                attachmentStats
            );
            
            this.counters.totalNewConversationsSuccessfullyImported++;
            this.counters.totalNonEmptyMessagesToImport += messageCount;

        } catch (error: any) {
            this.plugin.logger.error("Error creating new note", error.message);
            importReport.addFailed(
                chat.title || "Untitled",
                filePath,
                formatTimestamp(chat.create_time, "date") + " " + formatTimestamp(chat.create_time, "time"),
                formatTimestamp(chat.update_time, "date") + " " + formatTimestamp(chat.update_time, "time"),
                error.message
            );
            throw error;
        }
    }

    /**
     * Process attachments for messages using provider-specific extractor
     */
    private async processMessageAttachments(
        messages: StandardMessage[],
        conversationId: string,
        provider: string,
        zip: JSZip
    ): Promise<StandardMessage[]> {
        const processedMessages: StandardMessage[] = [];
        
        for (const message of messages) {
            if (message.attachments && message.attachments.length > 0) {
                if (provider === "chatgpt") {
                    const processedAttachments = await this.chatgptAttachmentExtractor.extractAttachments(
                        zip,
                        conversationId,
                        message.attachments
                    );
                    
                    processedMessages.push({
                        ...message,
                        attachments: processedAttachments
                    });
                } else {
                    processedMessages.push(message);
                }
            } else {
                processedMessages.push(message);
            }
        }
        
        return processedMessages;
    }

    private updateMetadata(content: string, updateTime: number): string {
        const updateTimeStr = `${formatTimestamp(updateTime, "date")} at ${formatTimestamp(updateTime, "time")}`;
        content = content.replace(/^update_time: .*$/m, `update_time: ${updateTimeStr}`);
        content = content.replace(/^Last Updated: .*$/m, `Last Updated: ${updateTimeStr}`);
        return content;
    }

    private getNewChatGPTMessages(chat: Chat, existingMessageIds: string[]): any[] {
        const newMessages: any[] = [];
        
        for (const messageObj of Object.values(chat.mapping)) {
            if (messageObj?.id && !existingMessageIds.includes(messageObj.id)) {
                const message = messageObj.message;
                if (!message) continue;

                // Apply same filtering logic as in ChatGPTConverter.extractMessagesFromMapping
                if (message.author?.role === "tool" && this.hasRealDalleImage(message)) {
                    // Create Assistant (DALL-E) message for real DALL-E generations
                    const dalleMessage = this.createDalleAssistantMessage(message);
                    if (dalleMessage) {
                        newMessages.push(dalleMessage);
                    }
                } else if (this.shouldIncludeMessage(message)) {
                    // Regular user/assistant messages with enhanced filtering
                    newMessages.push(message);
                }
            }
        }
        
        return newMessages;
    }

    /**
     * Check if message contains REAL DALL-E image (not user upload)
     */
    private hasRealDalleImage(message: any): boolean {
        if (!message.content?.parts || !Array.isArray(message.content.parts)) {
            return false;
        }
        
        return message.content.parts.some((part: any) => {
            if (typeof part !== "object" || part === null) return false;
            
            return part.content_type === "image_asset_pointer" && 
                   part.asset_pointer &&
                   part.metadata?.dalle && 
                   part.metadata.dalle !== null;
        });
    }

    /**
     * Create Assistant (DALL-E) message from tool message
     */
    private createDalleAssistantMessage(toolMessage: any): any | null {
        if (!toolMessage.content?.parts || !Array.isArray(toolMessage.content.parts)) {
            return null;
        }

        const attachments: any[] = [];
        
        for (const part of toolMessage.content.parts) {
            if (typeof part === "object" && part !== null) {
                if (part.content_type === "image_asset_pointer" && 
                    part.asset_pointer &&
                    part.metadata?.dalle &&
                    part.metadata.dalle !== null) {
                    
                    // Extract file ID from asset pointer
                    let fileId = part.asset_pointer;
                    if (fileId.includes('://')) {
                        fileId = fileId.split('://')[1];
                    }

                    // Generate descriptive filename
                    const genId = part.metadata.dalle.gen_id || 'unknown';
                    const width = part.width || 1024;
                    const height = part.height || 1024;
                    const fileName = `dalle_${genId}_${width}x${height}.png`;

                    const dalleAttachment = {
                        fileName: fileName,
                        fileSize: part.size_bytes,
                        fileType: "image/png",
                        fileId: fileId,
                        extractedContent: part.metadata.dalle.prompt
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
            author: { role: "assistant" },
            content: {
                parts: ["Image générée par DALL-E"],
                content_type: "text"
            },
            create_time: toolMessage.create_time || 0,
            attachments: attachments
        };
    }

    /**
     * Determine if a message should be included - same logic as ChatGPTConverter
     */
    private shouldIncludeMessage(message: any): boolean {
        // Safety check
        if (!message || !message.author) {
            return false;
        }
        
        // Skip ALL system messages
        if (message.author.role === "system") {
            return false;
        }
        
        // Skip ALL tool messages
        if (message.author.role === "tool") {
            return false;
        }
        
        // Skip hidden messages
        if (message.metadata?.is_visually_hidden_from_conversation === true) {
            return false;
        }
        
        // Skip user system messages
        if (message.metadata?.is_user_system_message === true) {
            return false;
        }
        
        // Skip user_editable_context content type
        if (message.content?.content_type === "user_editable_context") {
            return false;
        }
        
        // Assistant message filtering
        if (message.author.role === "assistant") {
            // Skip empty assistant messages
            if (message.content?.parts && 
                Array.isArray(message.content.parts) &&
                message.content.parts.every((part: any) => 
                    typeof part === "string" && part.trim() === ""
                )) {
                return false;
            }
            
            // Skip assistant messages that are just DALL-E JSON prompts
            if (message.content?.parts && 
                Array.isArray(message.content.parts) &&
                message.content.parts.length === 1 &&
                typeof message.content.parts[0] === "string") {
                
                const content = message.content.parts[0].trim();
                if (content.startsWith('{') && content.includes('"prompt"')) {
                    return false;
                }
            }
            
            // Skip various technical content types
            const excludedContentTypes = ["code", "system_error", "execution_output"];
            if (message.content?.content_type && excludedContentTypes.includes(message.content.content_type)) {
                return false;
            }
            
            // For multimodal_text, check if it has actual text content
            if (message.content?.content_type === "multimodal_text") {
                if (message.content?.parts && Array.isArray(message.content.parts)) {
                    const hasTextContent = message.content.parts.some((part: any) => {
                        if (typeof part === "string" && part.trim() !== "") {
                            return true;
                        }
                        if (typeof part === "object" && part !== null && 'text' in part) {
                            return typeof part.text === "string" && part.text.trim() !== "";
                        }
                        return false;
                    });
                    
                    if (!hasTextContent) {
                        return false;
                    }
                }
            }
        }
        
        // User message filtering
        if (message.author.role === "user") {
            const excludedContentTypes = ["user_editable_context"];
            
            if (message.content?.content_type && excludedContentTypes.includes(message.content.content_type)) {
                return false;
            }
        }
        
        // Final validation using existing function
        return isValidMessage(message);
    }

    private extractMessageUIDsFromNote(content: string): string[] {
        const uidRegex = /<!-- UID: (.*?) -->/g;
        const uids = [];
        let match;
        while ((match = uidRegex.exec(content)) !== null) {
            uids.push(match[1]);
        }
        return uids;
    }

    private async generateFilePath(chat: Chat): Promise<string> {
        const date = new Date(chat.create_time * 1000);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const folderPath = `${this.plugin.settings.archiveFolder}/${year}/${month}`;
        
        const folderResult = await ensureFolderExists(folderPath, this.plugin.app.vault);
        if (!folderResult.success) {
            throw new Error(folderResult.error || "Failed to ensure folder exists.");
        }

        let fileName = generateFileName(chat.title) + ".md";

        if (this.plugin.settings.addDatePrefix) {
            const day = String(date.getDate()).padStart(2, "0");
            let prefix = "";
            if (this.plugin.settings.dateFormat === "YYYY-MM-DD") {
                prefix = `${year}-${month}-${day}`;
            } else if (this.plugin.settings.dateFormat === "YYYYMMDD") {
                prefix = `${year}${month}${day}`;
            }
            fileName = `${prefix} - ${fileName}`;
        }

        let filePath = `${folderPath}/${fileName}`;
        if (await doesFilePathExist(filePath, this.plugin.app.vault)) {
            filePath = await generateUniqueFileName(filePath, this.plugin.app.vault.adapter);
        }

        return filePath;
    }

    getCounters() {
        return this.counters;
    }

    /**
     * Calculate attachment statistics from processed messages
     */
    private calculateAttachmentStats(messages: StandardMessage[]): { total: number; found: number; missing: number; failed: number } {
        const stats = { total: 0, found: 0, missing: 0, failed: 0 };
        
        for (const message of messages) {
            if (message.attachments) {
                for (const attachment of message.attachments) {
                    stats.total++;
                    if (attachment.status?.found) {
                        stats.found++;
                    } else if (attachment.status?.reason === 'missing_from_export') {
                        stats.missing++;
                    } else if (attachment.status?.reason === 'extraction_failed') {
                        stats.failed++;
                    }
                }
            }
        }
        
        return stats;
    }
}