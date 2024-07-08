// utils.ts
import { moment } from 'obsidian';

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
