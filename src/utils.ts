// utils.ts
import {
    moment,
    TFile
} from 'obsidian';

export function formatTimestamp(unixTime: number, format: 'prefix' | 'date' | 'time'): string {
    const date = moment(unixTime * 1000);
    switch (format) {
        case 'prefix':
            return date.format('YYYYMMDD');
        case 'date':
            return date.format('L');
        case 'time':
            return date.format('LT');
    }
}

export function getYearMonthFolder(unixTime: number): string {
    const date = new Date(unixTime * 1000);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}/${month}`;
}

export function formatTitle(title: string): string {
    return title
        .replace(/[<>:"\/\\|?*\n\r]+/g, '_')
        .replace(/\.{2,}/g, '.')
        .replace(/^\.+/, '')
        .replace(/\.+$/, '')
        .trim() || "Untitled";
}

export function isValidMessage(message: ChatMessage): boolean {
    return (
        message &&
        typeof message === 'object' &&
        message.content &&
        typeof message.content === 'object' &&
        Array.isArray(message.content.parts) &&
        message.content.parts.length > 0 &&
        message.content.parts.some(part => typeof part === 'string' && part.trim() !== "")
    );
}

export async function extractChatsFromZip(zip: JSZip): Promise<Chat[]> {
    const conversationsJson = await zip.file('conversations.json').async('string');
    return JSON.parse(conversationsJson);
}

export function updateMetadata(content: string, updateTime: number): string {
    const updateTimeStr = `${formatTimestamp(updateTime, 'date')} at ${formatTimestamp(updateTime, 'time')}`;
    
    // Update parameters
    content = content.replace(
        /^update_time: .*$/m,
        `update_time: ${updateTimeStr}`
    );
    
    // Update header
    content = content.replace(
        /^Last Updated: .*$/m,
        `Last Updated: ${updateTimeStr}`
    );
    
    return content;
}

export function generateMarkdownContent(chat: any): string {
    const formattedTitle = formatTitle(chat.title);
    const create_time_str = `${formatTimestamp(chat.create_time, 'date')} at ${formatTimestamp(chat.create_time, 'time')}`;
    const update_time_str = `${formatTimestamp(chat.update_time, 'date')} at ${formatTimestamp(chat.update_time, 'time')}`;

    let content = generateHeader(formattedTitle, chat.id, create_time_str, update_time_str);
    content += generateMessagesContent(chat);

    return content;
}

export async function writeToFile(app: App, fileName: string, content: string): Promise<void> {
    try {
        const file = app.vault.getAbstractFileByPath(fileName);
        if (file instanceof TFile) {
            await app.vault.modify(file, content);
            console.log(`[Nexus AI Chat Importer] Updated existing file: ${fileName}`);
        } else {
            await app.vault.create(fileName, content);
            console.log(`[Nexus AI Chat Importer] Created new file: ${fileName}`);
        }
    } catch (error) {
        console.error(`Error creating or modifying file '${fileName}': ${error.message}`);
        throw error; // Propagate the error
    }
}
export function generateHeader(title, conversationId, createTimeStr, updateTimeStr) {
    return `---
aliases: "${title}"
conversation_id: ${conversationId}
create_time: ${createTimeStr}
update_time: ${updateTimeStr}
---

# Topic: ${title}
Created: ${createTimeStr}
Last Updated: ${updateTimeStr}\n\n
`;
}

export function generateMessagesContent(chat) {
    let messagesContent = '';
    for (const messageId in chat.mapping) {
        const messageObj = chat.mapping[messageId];
        if (messageObj && messageObj.message && isValidMessage(messageObj.message)) {
            messagesContent += formatMessage(messageObj.message);
        }
    }
    return messagesContent;
}

export function formatMessage(message: ChatMessage): string {
    if (!message || typeof message !== 'object') {
        console.error('Invalid message object:', message);
        return ''; // Return empty string for invalid messages
    }

    const messageTime = formatTimestamp(message.create_time || Date.now() / 1000, 'date') + ' at ' + formatTimestamp(message.create_time || Date.now() / 1000, 'time');
    
    let authorName = "Unknown";
    if (message.author && typeof message.author === 'object' && 'role' in message.author) {
        authorName = message.author.role === 'user' ? "User" : "ChatGPT";
    } else {
        console.warn('Author information missing or invalid:', message.author);
    }

    const headingLevel = authorName === "User" ? "###" : "####";
    const quoteChar = authorName === "User" ? ">" : ">>";

    let messageContent = `${headingLevel} ${authorName}, on ${messageTime};\n`;
    
    if (
        message.content &&
        typeof message.content === 'object' &&
        Array.isArray(message.content.parts) &&
        message.content.parts.length > 0
    ) {
        const messageText = message.content.parts
            .filter(part => typeof part === 'string')
            .join('\n');
        messageContent += messageText.split('\n').map(line => `${quoteChar} ${line}`).join('\n');
    } else {
        console.warn('Message content missing or invalid:', message.content);
        messageContent += `${quoteChar} [No content]`;
    }

    messageContent += `\n<!-- UID: ${message.id || 'unknown'} -->\n`;

    if (authorName === "ChatGPT") {
        messageContent += "\n---\n";
    }
    return messageContent + '\n\n';
}

export enum LogLevel {
    INFO,
    WARN,
    ERROR
}

export class Logger {
    private logToConsole(level: LogLevel, message: string, details?: any) {
        const timestamp = new Date().toISOString();
        const logMethod = level === LogLevel.ERROR ? console.error : 
                          level === LogLevel.WARN ? console.warn : 
                          console.log;
        
        logMethod(`[${timestamp}] [Nexus AI Chat Importer] [${LogLevel[level]}] ${message}`, details);
    }

    info(message: string, details?: any) {
        this.logToConsole(LogLevel.INFO, message, details);
    }

    warn(message: string, details?: any) {
        this.logToConsole(LogLevel.WARN, message, details);
    }

    error(message: string, details?: any) {
        this.logToConsole(LogLevel.ERROR, message, details);
    }
}