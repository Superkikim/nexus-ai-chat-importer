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

/**
 * File utility functions
 * Centralized file-related utilities to avoid duplication
 */

import { StandardAttachment } from '../types/standard';

/**
 * Format file size in human-readable format
 * @param bytes - File size in bytes
 * @returns Formatted string (e.g., "1.5 MB")
 */
export function formatFileSize(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Check if attachment is an image file
 * @param attachment - StandardAttachment or filename string
 * @returns true if file is an image
 */
export function isImageFile(attachment: StandardAttachment | string): boolean {
    let fileName: string;
    let fileType: string | undefined;

    if (typeof attachment === 'string') {
        fileName = attachment;
        fileType = undefined;
    } else {
        fileName = attachment.fileName;
        fileType = attachment.fileType;
    }

    // Check MIME type first (most reliable)
    if (fileType?.startsWith('image/')) {
        return true;
    }
    
    // Fall back to file extension
    const lowerFileName = fileName.toLowerCase();
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.tiff'];
    return imageExtensions.some(ext => lowerFileName.endsWith(ext));
}

/**
 * Check if file is a text file
 * @param fileName - Name of the file
 * @returns true if file is a text file
 */
export function isTextFile(fileName: string): boolean {
    const textExtensions = ['.txt', '.md', '.json', '.csv', '.xml', '.html', '.css', '.js', '.ts', '.py', '.java', '.cpp', '.c', '.h'];
    return textExtensions.some(ext => fileName.toLowerCase().endsWith(ext));
}

/**
 * Get file extension from filename
 * @param fileName - Name of the file
 * @returns File extension without dot (e.g., "png")
 */
export function getFileExtension(fileName: string): string {
    const lastDot = fileName.lastIndexOf('.');
    if (lastDot === -1) return '';
    return fileName.substring(lastDot + 1).toLowerCase();
}

/**
 * Detect file format from magic bytes (file signature)
 * Useful for files with incorrect extensions (e.g., .dat files)
 * @param fileContent - File content as Uint8Array
 * @returns Object with detected extension and MIME type
 */
export function detectFileFormat(fileContent: Uint8Array): {extension: string | null, mimeType: string | null} {
    if (fileContent.length < 4) {
        return {extension: null, mimeType: null};
    }

    // Check magic bytes
    const header = Array.from(fileContent.slice(0, 12)).map(b => b.toString(16).padStart(2, '0')).join('');
    
    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (header.startsWith('89504e47')) {
        return {extension: 'png', mimeType: 'image/png'};
    }
    
    // JPEG: FF D8 FF
    if (header.startsWith('ffd8ff')) {
        return {extension: 'jpg', mimeType: 'image/jpeg'};
    }
    
    // GIF: 47 49 46 38
    if (header.startsWith('47494638')) {
        return {extension: 'gif', mimeType: 'image/gif'};
    }
    
    // WebP: 52 49 46 46 [4 bytes] 57 45 42 50
    if (header.startsWith('52494646') && header.substring(16, 24) === '57454250') {
        return {extension: 'webp', mimeType: 'image/webp'};
    }
    
    // RIFF (could be WebP or other formats)
    if (header.startsWith('52494646')) {
        return {extension: 'webp', mimeType: 'image/webp'}; // Assume WebP for RIFF in AI chat context
    }

    return {extension: null, mimeType: null};
}

/**
 * Sanitize filename for safe filesystem usage
 * @param fileName - Original filename
 * @returns Sanitized filename
 */
export function sanitizeFileName(fileName: string): string {
    return fileName
        .trim()
        .replace(/[<>:"\/\\|?*]/g, '_')
        .replace(/\s+/g, '_');
}

/**
 * Determine file category based on extension or MIME type
 * @param fileName - Name of the file
 * @param fileType - Optional MIME type
 * @returns Category folder name (e.g., 'images', 'documents', 'audio')
 */
export function getFileCategory(fileName: string, fileType?: string): string {
    // Check MIME type first
    if (fileType) {
        if (fileType.startsWith('image/')) return 'images';
        if (fileType.startsWith('audio/')) return 'audio';
        if (fileType.startsWith('video/')) return 'video';
        if (fileType.startsWith('text/') || fileType.includes('document')) return 'documents';
    }

    // Fall back to file extension
    const ext = getFileExtension(fileName);
    
    const audioExts = ['wav', 'mp3', 'ogg', 'm4a', 'flac'];
    const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'];
    const docExts = ['pdf', 'doc', 'docx', 'txt', 'md', 'rtf'];
    const videoExts = ['mp4', 'avi', 'mov', 'mkv'];

    if (audioExts.includes(ext)) return 'audio';
    if (imageExts.includes(ext)) return 'images';
    if (docExts.includes(ext)) return 'documents';
    if (videoExts.includes(ext)) return 'video';
    
    return 'files';
}

