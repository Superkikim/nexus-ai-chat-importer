import { Plugin, PluginSettingTab, Setting, TFile } from 'obsidian';
import JSZip from 'jszip';



export default class ChatGPTImportPlugin extends Plugin {
    settings: PluginSettings;

    /**
     * Source Counters
     */
    totalExistingConversations: number = 0; // Count of all existing conversations in Obsidian
    totalNewConversationsToImport: number = 0; // Count of new conversations to import
    totalNonEmptyMessagesToImport: number = 0; // Count of non-empty messages in new conversations to import
    totalNonEmptyMessagesToAdd: number = 0; // Count of non-empty messages to be added to existing conversations
    totalExistingConversationsToUpdate: number = 0; // Count of existing conversations identified to be updated

    /**
     * Processed Counters
     */
    totalSanitizedFilenames: number = 0; // Count of sanitized filenames for new conversation notes
    totalNewConversationsSuccessfullyImported: number = 0; // Count of new conversations successfully imported
    totalConversationsActuallyUpdated: number = 0; // Count of conversations actually updated after processing
    totalNonEmptyMessagesAdded: number = 0; // Count of non-empty messages actually added to conversations
    

    async onload() {
        await this.loadSettings();

        this.addSettingTab(new ChatGPTImportPluginSettingTab(this.app, this));

        this.addCommand({
            id: 'import-chatgpt-zip',
            name: 'Import ChatGPT ZIP',
            callback: () => {
                this.selectZipFile();
            }
        });
    }

    selectZipFile() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.zip';
        input.onchange = (e) => {
            const file = e.target.files[0];
            this.handleZipFile(file);
        };
        input.click();
    }

    async handleZipFile(file) {
        const zip = new JSZip();
        const content = await zip.loadAsync(file);
        const fileNames = Object.keys(content.files);
        if (!fileNames.includes('conversations.json')) {
            alert(`obsidian-chatgpt-import\n\nFile 'conversations.json' not found in the zip:\n${file.name}\n\nEither you have selected the wrong file, or openai.com has changed the ChatGPT export zip format.`);
        }
        const conversationsJson = await content.file("conversations.json").async("string");
        const chats = JSON.parse(conversationsJson);
        const newConversationIDs = await this.getNewConversationIDs(chats);
        const existingConversations = await this.getAllExistingConversations();

        this.totalNewConversationsToImport = newConversationIDs.length;
        this.totalExistingConversations = existingConversations.length;

        for (const chat of chats) {

            const yearMonthFolder = this.getYearMonthFolder(chat.create_time);
            const path = require('path');
            const folderPath = path.join(this.settings.archiveFolder, yearMonthFolder);
            try {
                await this.ensureFolderExists(folderPath);
            } catch (e) {
                console.error("[chatgpt-import] Error ensuring folder exists:", e);
            }
    
            if (newConversationIDs.includes(chat.id)) {
                this.totalNewConversationsToImport++;
                let nonEmptyMessageCount = 0;
                for (const messageId in chat.mapping) {
                    const message = chat.mapping[messageId].message;
                    if (this.isValidMessage(message)) {
                        nonEmptyMessageCount++;
                    }
                }
                this.totalNonEmptyMessagesToImport += nonEmptyMessageCount;
                await this.createMarkdown(chat, folderPath, existingConversations);
            }
        }
    
        // Now handle appending messages to existing notes
        const conversationsWithNewMessages = await this.getConversationsWithNewMessages(chats, existingConversations);
        this.totalExistingConversationsToUpdate = conversationsWithNewMessages.length;

        for (const [conversationId, newMessages] of Object.entries(conversationsWithNewMessages)) {
            let nonEmptyMessageToAddCount = 0;
            for (const message of newMessages) {
                if (this.isValidMessage(message)) {
                    nonEmptyMessageToAddCount++;
                }
            }
            this.totalNonEmptyMessagesToAdd += nonEmptyMessageToAddCount;
        }
    
        await this.appendMessagesToNotes(conversationsWithNewMessages, chats, existingConversations);
    
    }
    

    async ensureFolderExists(folderPath) {
        console.log(`[chatgpt-import] Checking for folder: ${folderPath}`);
        try {
            let folder = this.app.vault.getAbstractFileByPath(folderPath);
            if (!folder) {
                console.log(`[chatgpt-import] Creating folder: ${folderPath}`);
                await this.app.vault.createFolder(folderPath);
            } else {
                console.log(`[chatgpt-import] Folder already exists: ${folderPath}`);
            }
        } catch (e) {
            console.error(`[chatgpt-import] Error handling folder '${folderPath}':`, e);
        }
    }
    
    
    getYearMonthFolder(unixTime) {
        const date = new Date(unixTime * 1000);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0'); // JavaScript months are 0-indexed
        return `${year}/${month}`;
    }

    async getUniqueFileName(title, folderPath, existingConversations) {
        let counter = 1;
        let formattedTitle = this.formatTitle(title);
        let potentialFileName = `${formattedTitle}.md`;
    
        // Check if a file with this title already exists
        for (const existingFile of Object.values(existingConversations)) {
            if (existingFile.includes(folderPath) && existingFile.endsWith(potentialFileName)) {
                // If exists, append a counter to the title
                potentialFileName = `${formattedTitle}-${counter}.md`;
                counter++;
            }
        }
        return `${folderPath}/${potentialFileName}`;
    }

    async createMarkdown(chat, folderPath, existingConversations) {
        const title = this.formatTitle(chat.title);
        const create_time_str = this.formatTimestamp(chat.create_time, true);
        const update_time_str = this.formatTimestamp(chat.update_time, true);
        let content = this.generateHeader(title, chat.id, create_time_str, update_time_str);

        content += this.generateMessagesContent(chat);

        const fileName = await this.getUniqueFileName(chat.title, folderPath, existingConversations);
        console.log(`[chatgpt-import] Creating note with file name: ${fileName}`);
        await this.writeToFile(fileName, content);
    }

    formatTitle(title) {
        let formattedTitle = title
            .replace(/[<>:"\/\\|?*\n\r]+/g, '_') // Replace invalid characters and newlines
            .replace(/\.{2,}/g, '.') // Replace multiple consecutive dots with a single dot
            .replace(/^\.+/, '') // Remove leading dots
            .replace(/\.+$/, '') // Remove trailing dots
            .trim(); // Trim whitespace from both ends
    
        return formattedTitle || "Untitled";
    }
    

    generateHeader(title, conversationId, createTimeStr, updateTimeStr) {
        return `---
aliases: ${title}
conversation_id: ${conversationId}
create_time: ${createTimeStr}
update_time: ${updateTimeStr}
---

# Topic: ${title}
Created: ${createTimeStr}
Last Updated: ${updateTimeStr}\n\n
`;
    }

    generateMessagesContent(chat) {
        let messagesContent = '';
        for (const messageId in chat.mapping) {
            const message = chat.mapping[messageId].message;
            if (this.isValidMessage(message)) {
                messagesContent += this.formatMessage(message);
            }
        }
        return messagesContent;
    }

    isValidMessage(message) {
        if (
            message &&
            message.content &&
            message.content.parts &&
            message.content.parts.length > 0
        ) {
            let messageText = message.content.parts[0] + ""; // Convert to string explicitly
            if (!messageText.trim()) {
                return false; // Message is invalid (empty or whitespace-only)
            }
            return true; // Message is valid
        }
        return false; // Message is invalid
    }

    formatMessage(message) {
        const messageTime = this.formatTimestamp(message.create_time, true);
        const authorName = message.author.role === 'user' ? "User" : "ChatGPT";
        const headingLevel = authorName === "User" ? "###" : "####";
        const quoteChar = authorName === "User" ? ">" : ">>";

        let messageContent = `${headingLevel} ${authorName}, on ${messageTime}\n`;

        if (
            message.content &&
            message.content.parts &&
            message.content.parts.length > 0 &&
            typeof message.content.parts[0] === "string"
        ) {
            const messageText = message.content.parts[0];
            messageContent += messageText.split('\n').map(line => `${quoteChar} ${line}`).join('\n');
        }

        messageContent += `\n<!-- UID: ${message.id} -->\n`;

        if (authorName === "ChatGPT") {
            messageContent += "\n---\n";
        }
        return messageContent + '\n\n';
    }

    async writeToFile(fileName, content) {
        try {
            let file = this.app.vault.getAbstractFileByPath(fileName);
            if (!file) {
                // File doesn't exist, create it
                await this.app.vault.create(fileName, content);
            } else if (file instanceof TFile) {
                // File exists, read existing content
                const existingContent = await this.app.vault.read(file);

                // Append new content to the existing content
                const updatedContent = existingContent + content;

                // Write the updated content back to the file
                await this.app.vault.modify(file, updatedContent);

                console.log(`[chatgpt-import] Updated existing file: ${fileName}`);
            } else {
                console.error("[chatgpt-import] Invalid file object:", file);
            }
        } catch (e) {
            console.error("[chatgpt-import] Error creating or modifying file:", e);
        }
    }

    formatTimestamp(unixTime, includeDate = false) {
        const date = new Date(unixTime * 1000);
        const dateString = date.toLocaleDateString();
        const timeString = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: true });

        return includeDate ? `${dateString} at ${timeString}` : timeString;
    }

    async loadSettings() {
        this.settings = Object.assign({}, defaultSettings, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    async getNewConversationIDs(zipChats) {
        const existingConversations = await this.getAllExistingConversations();
        const newConversationIDs = [];
    
        for (const chat of zipChats) {
            if (!existingConversations.hasOwnProperty(chat.id)) {
                newConversationIDs.push(chat.id);
                this.totalNewConversationsToImport++; // Increment the counter for each new conversation
            }
        }
    
        return newConversationIDs;
    }
    

    async getAllExistingConversations() {
        const files = this.app.vault.getMarkdownFiles();
        const conversations = {};
    
        for (const file of files) {
            const fileContent = await this.app.vault.read(file);
            const match = fileContent.match(/^---\s*conversation_id:\s*(.*?)\s*---/ms);
            if (match) {
                const conversationId = match[1].trim();
                conversations[conversationId] = file.path;
            }
        }
        return conversations;
    }
    
    async getConversationsWithNewMessages(zipChats, existingConversations) {
        const conversationsWithNewMessages = [];
    
        for (const chat of zipChats) {
            const existingNotePath = existingConversations[chat.id];

            if (existingNotePath) {
                const existingNoteContent = await this.app.vault.read(existingNotePath);
                const existingMessageUIDs = this.extractMessageUIDsFromNote(existingNoteContent);
    
                const newMessageUIDs = chat.mapping.map(messageInfo => messageInfo.message.id);
                const hasNewMessages = newMessageUIDs.some(uid => !existingMessageUIDs.includes(uid));
    
                // Log the number of messages for debugging
                if (hasNewMessages) {
                    console.log(`[chatgpt-import] Conversation ID ${chat.id}: Existing messages count = ${existingMessageUIDs.length}, New messages count = ${newMessageUIDs.length}`);
                    conversationsWithNewMessages.push(chat.id);
                }
            }
        }
    
        return conversationsWithNewMessages;
    }

    extractMessageUIDsFromNote(noteContent) {
        const uidRegex = /<!-- UID: (.*?) -->/g;
        const uids = [];
        let match;
        while ((match = uidRegex.exec(noteContent)) !== null) {
            uids.push(match[1]);
        }
        return uids;
    }

    async appendMessagesToNotes(conversationsWithNewMessages, zipChats, existingConversations) {
        for (const conversationId of conversationsWithNewMessages) {
            const existingNotePath = existingConversations[conversationId];
            if (existingNotePath) {
                const existingNoteContent = await this.app.vault.read(existingNotePath);
                const chat = zipChats.find((chat) => chat.id === conversationId);
                if (chat) {
                    const newMessages = chat.mapping.filter((messageInfo) => {
                        const uid = messageInfo.message.id;
                        return !existingNoteContent.includes(`<!-- UID: ${uid} -->`);
                    });
                    if (newMessages.length > 0) {
                        const newMessagesContent = this.generateMessagesContent(chat, newMessages);
                        // Append new messages to the existing note content
                        const updatedNoteContent = existingNoteContent + newMessagesContent;
                        await this.writeToFile(existingNotePath, updatedNoteContent);
                    }
                }
            }
        }
    }
}

class ChatGPTImportPluginSettingTab extends PluginSettingTab {
    plugin: ChatGPTImportPlugin;

    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display() {
        const { containerEl } = this;
        containerEl.empty();

        new Setting(containerEl)
            .setName('ChatGPT Archive Folder')
            .setDesc('Choose a folder to store ChatGPT archives')
            .addText(text => text
                .setValue(this.plugin.settings.archiveFolder || '')
                .onChange(async (value) => {
                    this.plugin.settings.archiveFolder = value;
                    await this.plugin.saveSettings();
                }));
    }
}

interface PluginSettings {
    archiveFolder: string;
}

const defaultSettings: PluginSettings = {
    archiveFolder: ''
};
