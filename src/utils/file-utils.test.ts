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

import { describe, it, expect } from 'vitest';
import {
    formatFileSize,
    isImageFile,
    isTextFile,
    getFileExtension,
    detectFileFormat,
    sanitizeFileName,
    getFileCategory
} from './file-utils';
import { StandardAttachment } from '../types/standard';

describe('formatFileSize', () => {
    it('should format 0 bytes', () => {
        expect(formatFileSize(0)).toBe('0 Bytes');
    });

    it('should format bytes', () => {
        expect(formatFileSize(500)).toBe('500 Bytes');
    });

    it('should format kilobytes', () => {
        expect(formatFileSize(1024)).toBe('1 KB');
        expect(formatFileSize(1536)).toBe('1.5 KB');
    });

    it('should format megabytes', () => {
        expect(formatFileSize(1048576)).toBe('1 MB');
        expect(formatFileSize(1572864)).toBe('1.5 MB');
    });

    it('should format gigabytes', () => {
        expect(formatFileSize(1073741824)).toBe('1 GB');
        expect(formatFileSize(1610612736)).toBe('1.5 GB');
    });
});

describe('isImageFile', () => {
    it('should detect image by MIME type', () => {
        const attachment: StandardAttachment = {
            fileName: 'test.dat',
            fileType: 'image/png',
            fileSize: 1000
        };
        expect(isImageFile(attachment)).toBe(true);
    });

    it('should detect image by extension', () => {
        const attachment: StandardAttachment = {
            fileName: 'test.png',
            fileSize: 1000
        };
        expect(isImageFile(attachment)).toBe(true);
    });

    it('should detect various image extensions', () => {
        const extensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.tiff'];
        extensions.forEach(ext => {
            expect(isImageFile(`test${ext}`)).toBe(true);
            expect(isImageFile(`test${ext.toUpperCase()}`)).toBe(true);
        });
    });

    it('should not detect non-image files', () => {
        expect(isImageFile('test.pdf')).toBe(false);
        expect(isImageFile('test.txt')).toBe(false);
    });
});

describe('isTextFile', () => {
    it('should detect text files', () => {
        const textExtensions = ['.txt', '.md', '.json', '.csv', '.xml', '.html', '.css', '.js', '.ts'];
        textExtensions.forEach(ext => {
            expect(isTextFile(`test${ext}`)).toBe(true);
            expect(isTextFile(`test${ext.toUpperCase()}`)).toBe(true);
        });
    });

    it('should not detect non-text files', () => {
        expect(isTextFile('test.png')).toBe(false);
        expect(isTextFile('test.pdf')).toBe(false);
    });
});

describe('getFileExtension', () => {
    it('should extract extension', () => {
        expect(getFileExtension('test.png')).toBe('png');
        expect(getFileExtension('test.tar.gz')).toBe('gz');
        expect(getFileExtension('TEST.PNG')).toBe('png');
    });

    it('should return empty string for no extension', () => {
        expect(getFileExtension('test')).toBe('');
        expect(getFileExtension('.gitignore')).toBe('gitignore');
    });
});

describe('detectFileFormat', () => {
    it('should detect PNG format', () => {
        const pngHeader = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x00]);
        const result = detectFileFormat(pngHeader);
        expect(result.extension).toBe('png');
        expect(result.mimeType).toBe('image/png');
    });

    it('should detect JPEG format', () => {
        const jpegHeader = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
        const result = detectFileFormat(jpegHeader);
        expect(result.extension).toBe('jpg');
        expect(result.mimeType).toBe('image/jpeg');
    });

    it('should detect GIF format', () => {
        const gifHeader = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
        const result = detectFileFormat(gifHeader);
        expect(result.extension).toBe('gif');
        expect(result.mimeType).toBe('image/gif');
    });

    it('should detect WebP format', () => {
        const webpHeader = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
        const result = detectFileFormat(webpHeader);
        expect(result.extension).toBe('webp');
        expect(result.mimeType).toBe('image/webp');
    });

    it('should return null for unknown format', () => {
        const unknownHeader = new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
        const result = detectFileFormat(unknownHeader);
        expect(result.extension).toBe(null);
        expect(result.mimeType).toBe(null);
    });

    it('should return null for too small file', () => {
        const tooSmall = new Uint8Array([0x00, 0x00]);
        const result = detectFileFormat(tooSmall);
        expect(result.extension).toBe(null);
        expect(result.mimeType).toBe(null);
    });
});

describe('sanitizeFileName', () => {
    it('should remove invalid characters', () => {
        expect(sanitizeFileName('test<>:"/\\|?*.txt')).toBe('test_________.txt');
    });

    it('should replace spaces with underscores', () => {
        expect(sanitizeFileName('my test file.txt')).toBe('my_test_file.txt');
    });

    it('should trim whitespace', () => {
        expect(sanitizeFileName('  test.txt  ')).toBe('test.txt');
    });

    it('should handle already clean filenames', () => {
        expect(sanitizeFileName('test_file_123.txt')).toBe('test_file_123.txt');
    });
});

describe('getFileCategory', () => {
    it('should categorize by MIME type', () => {
        expect(getFileCategory('test.dat', 'image/png')).toBe('images');
        expect(getFileCategory('test.dat', 'audio/mp3')).toBe('audio');
        expect(getFileCategory('test.dat', 'video/mp4')).toBe('video');
        expect(getFileCategory('test.dat', 'text/plain')).toBe('documents');
    });

    it('should categorize by extension when no MIME type', () => {
        expect(getFileCategory('test.png')).toBe('images');
        expect(getFileCategory('test.mp3')).toBe('audio');
        expect(getFileCategory('test.mp4')).toBe('video');
        expect(getFileCategory('test.pdf')).toBe('documents');
    });

    it('should return "files" for unknown types', () => {
        expect(getFileCategory('test.xyz')).toBe('files');
        expect(getFileCategory('test.dat')).toBe('files');
    });

    it('should handle case-insensitive extensions', () => {
        expect(getFileCategory('test.PNG')).toBe('images');
        expect(getFileCategory('test.MP3')).toBe('audio');
    });
});

