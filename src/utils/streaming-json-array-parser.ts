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


// src/utils/streaming-json-array-parser.ts

/**
 * Lightweight, allocation-friendly parser for huge JSON arrays of objects.
 *
 * Designed specifically for provider exports where conversations are stored as
 * a top-level array (ChatGPT) or in a `conversations` array on the root
 * object (Claude).
 *
 * It avoids JSON.parse on the whole payload by scanning the string and
 * extracting each element substring, which is then parsed individually.
 */
export class StreamingJsonArrayParser {
    /**
     * Stream objects from a JSON payload that contains a conversations array.
     *
     * Supports two shapes:
     * - ChatGPT:        [ { ... }, { ... }, ... ]
     * - Claude:  { ..., "conversations": [ { ... }, ... ], ... }
     */
    static *streamConversations(json: string): Generator<any> {
        const arraySlice = this.extractConversationsArray(json);
        for (const element of this.streamArrayElements(arraySlice)) {
            try {
                yield JSON.parse(element);
            } catch (error) {
                // If a single element fails to parse, skip it but continue
                // with the rest so one bad conversation does not kill import.
                // Detailed logging is handled by callers.
                continue;
            }
        }
    }

    /**
     * Stream objects from chunked JSON text without building one giant string.
     *
     * This is primarily used on mobile when a large `conversations.json`
     * could otherwise trigger memory pressure.
     */
    static async *streamConversationsFromChunks(chunks: AsyncIterable<string>): AsyncGenerator<any> {
        const arrayState = await this.findConversationsArrayStart(chunks);
        if (!arrayState) {
            throw new Error("Could not find conversations array in chunked JSON payload");
        }

        let {
            buffer,
            done,
            pullNextChunk,
            scanIndex,
        } = arrayState;

        let inString = false;
        let escape = false;
        let elementDepth = 0;
        let elementStart = -1;
        let elementEnd = -1;

        while (true) {
            while (scanIndex < buffer.length) {
                const ch = buffer[scanIndex];

                if (elementStart === -1) {
                    if (ch === "]") {
                        return;
                    }
                    if (ch === "," || /\s/.test(ch)) {
                        scanIndex++;
                        continue;
                    }

                    elementStart = scanIndex;
                    elementEnd = -1;
                    inString = false;
                    escape = false;
                    elementDepth = 0;
                }

                if (inString) {
                    if (escape) {
                        escape = false;
                    } else if (ch === "\\") {
                        escape = true;
                    } else if (ch === "\"") {
                        inString = false;
                    }
                } else {
                    if (ch === "\"") {
                        inString = true;
                    } else if (ch === "{" || ch === "[") {
                        elementDepth++;
                    } else if (ch === "}" || ch === "]") {
                        elementDepth--;
                        if (elementDepth < 0) {
                            throw new Error("Invalid chunked JSON array: unbalanced brackets");
                        }
                        if (elementDepth === 0) {
                            elementEnd = scanIndex + 1;
                        }
                    }

                    if (elementEnd !== -1) {
                        if (ch === "," || ch === "]") {
                            const element = buffer.slice(elementStart, elementEnd).trim();
                            if (element.length > 0) {
                                try {
                                    yield JSON.parse(element);
                                } catch {
                                    // Keep parity with string parser: skip malformed elements.
                                }
                            }

                            buffer = buffer.slice(scanIndex + 1);
                            scanIndex = 0;
                            elementStart = -1;
                            elementEnd = -1;
                            elementDepth = 0;
                            inString = false;
                            escape = false;

                            if (ch === "]") {
                                return;
                            }
                            continue;
                        }

                        if (!/\s/.test(ch)) {
                            const element = buffer.slice(elementStart, elementEnd).trim();
                            if (element.length > 0) {
                                try {
                                    yield JSON.parse(element);
                                } catch {
                                    // Keep parity with string parser: skip malformed elements.
                                }
                            }

                            buffer = buffer.slice(elementEnd);
                            scanIndex = 0;
                            elementStart = -1;
                            elementEnd = -1;
                            elementDepth = 0;
                            inString = false;
                            escape = false;
                            continue;
                        }
                    }
                }

                scanIndex++;
            }

            if (done) {
                if (elementStart !== -1 && elementEnd !== -1) {
                    const element = buffer.slice(elementStart, elementEnd).trim();
                    if (element.length > 0) {
                        try {
                            yield JSON.parse(element);
                        } catch {
                            // Keep parity with string parser: skip malformed elements.
                        }
                    }
                }
                return;
            }

            const nextChunk = await pullNextChunk();
            if (nextChunk === null) {
                done = true;
                continue;
            }
            buffer += nextChunk;
        }
    }

    /**
     * Extract the raw JSON for the conversations array.
     * Returns a substring representing `[ {...}, {...}, ... ]`.
     */
    private static extractConversationsArray(json: string): string {
        const trimmed = json.trimStart();
        if (trimmed.startsWith("[")) {
            // ChatGPT: entire file is the conversations array
            const offset = json.length - trimmed.length;
            const start = offset;
            const end = this.findMatchingBracket(json, start, "[");
            return json.slice(start, end + 1);
        }

        // Claude: look for a top-level "conversations" property
        const keyIndex = json.indexOf('"conversations"');
        if (keyIndex === -1) {
            throw new Error("Could not find conversations array in JSON payload");
        }

        // Find the colon after the key and then the opening [
        let i = keyIndex + '"conversations"'.length;
        const len = json.length;
        while (i < len && json[i] !== ":") i++;
        if (i >= len) {
            throw new Error("Invalid JSON: missing ':' after conversations key");
        }
        i++; // skip ':'
        while (i < len && /\s/.test(json[i])) i++;
        if (i >= len || json[i] !== "[") {
            throw new Error("Invalid JSON: conversations value is not an array");
        }

        const start = i;
        const end = this.findMatchingBracket(json, start, "[");
        return json.slice(start, end + 1);
    }

    /**
     * Stream element substrings from a JSON array like `[ {...}, {...} ]`.
     * Handles nested objects/arrays and quoted strings with escapes.
     */
    private static *streamArrayElements(arrayJson: string): Generator<string> {
        const len = arrayJson.length;
        let i = 0;

        // Expect opening [
        while (i < len && /\s/.test(arrayJson[i])) i++;
        if (i >= len || arrayJson[i] !== "[") {
            throw new Error("Expected '[' at start of JSON array");
        }
        i++; // skip '['

        while (i < len) {
            // Skip whitespace between elements
            while (i < len && /\s/.test(arrayJson[i])) i++;
            if (i >= len) break;
            if (arrayJson[i] === "]") break; // end of array

            const start = i;
            let depth = 0;
            let inString = false;
            let escape = false;

            while (i < len) {
                const ch = arrayJson[i];

                if (inString) {
                    if (escape) {
                        escape = false;
                    } else if (ch === "\\") {
                        escape = true;
                    } else if (ch === '"') {
                        inString = false;
                    }
                } else {
                    if (ch === '"') {
                        inString = true;
                    } else if (ch === "{" || ch === "[") {
                        depth++;
                    } else if (ch === "}" || ch === "]") {
                        depth--;
                        if (depth < 0) {
                            throw new Error("Invalid JSON array: unbalanced brackets");
                        }
                        // When depth reaches 0, we've closed the top-level element
                        if (depth === 0) {
                            i++;
                            break;
                        }
                    }
                }

                i++;
            }

            const element = arrayJson.slice(start, i).trim();
            if (element.length > 0) {
                yield element;
            }

            // Skip trailing whitespace and optional comma
            while (i < len && /\s/.test(arrayJson[i])) i++;
            if (i < len && arrayJson[i] === ",") {
                i++;
            }
        }
    }

    private static async findConversationsArrayStart(chunks: AsyncIterable<string>): Promise<{
        buffer: string;
        scanIndex: number;
        done: boolean;
        pullNextChunk: () => Promise<string | null>;
    } | null> {
        const iterator = chunks[Symbol.asyncIterator]();
        let done = false;
        let buffer = "";
        const maxStartScanBufferChars = 8 * 1024 * 1024;

        const pullNextChunk = async (): Promise<string | null> => {
            const next = await iterator.next();
            if (next.done) {
                done = true;
                return null;
            }
            return next.value || "";
        };

        while (true) {
            const arrayStartIndex = this.findArrayStartIndexInChunkedPayload(buffer);
            if (arrayStartIndex !== null) {
                return {
                    buffer: buffer.slice(arrayStartIndex),
                    scanIndex: 0,
                    done,
                    pullNextChunk,
                };
            }

            if (done) {
                return null;
            }

            const nextChunk = await pullNextChunk();
            if (nextChunk === null) {
                continue;
            }
            buffer += nextChunk;
            if (buffer.length > maxStartScanBufferChars) {
                throw new Error("Could not find conversations array in chunked JSON payload");
            }
        }
    }

    private static findArrayStartIndexInChunkedPayload(buffer: string): number | null {
        const firstTokenIndex = this.findFirstNonWhitespaceOrBomIndex(buffer);
        if (firstTokenIndex === -1) {
            return null;
        }

        const firstToken = buffer[firstTokenIndex];
        if (firstToken === "[") {
            return firstTokenIndex + 1;
        }

        if (firstToken !== "{") {
            return null;
        }

        return this.findTopLevelConversationsArrayStartIndex(buffer, firstTokenIndex + 1);
    }

    private static findFirstNonWhitespaceOrBomIndex(source: string): number {
        for (let i = 0; i < source.length; i++) {
            const ch = source[i];
            if (ch === "\uFEFF" || /\s/.test(ch)) {
                continue;
            }
            return i;
        }
        return -1;
    }

    private static findTopLevelConversationsArrayStartIndex(source: string, start: number): number | null {
        let i = start;
        let depth = 1;
        let inString = false;
        let escape = false;
        let stringStart = -1;

        while (i < source.length) {
            const ch = source[i];

            if (inString) {
                if (escape) {
                    escape = false;
                } else if (ch === "\\") {
                    escape = true;
                } else if (ch === "\"") {
                    const isTopLevelKey = depth === 1 && this.isLikelyObjectKeyPosition(source, stringStart);
                    if (isTopLevelKey) {
                        const key = source.slice(stringStart, i);
                        if (key === "conversations") {
                            let j = i + 1;
                            while (j < source.length && /\s/.test(source[j])) j++;
                            if (j >= source.length) return null;
                            if (source[j] !== ":") {
                                inString = false;
                                stringStart = -1;
                                i++;
                                continue;
                            }

                            j++;
                            while (j < source.length && /\s/.test(source[j])) j++;
                            if (j >= source.length) return null;
                            if (source[j] === "[") {
                                return j + 1;
                            }
                        }
                    }
                    inString = false;
                    stringStart = -1;
                }
                i++;
                continue;
            }

            if (ch === "\"") {
                inString = true;
                stringStart = i + 1;
            } else if (ch === "{" || ch === "[") {
                depth++;
            } else if (ch === "}" || ch === "]") {
                depth--;
                if (depth <= 0) {
                    return null;
                }
            }

            i++;
        }

        return null;
    }

    private static isLikelyObjectKeyPosition(source: string, quoteStart: number): boolean {
        let i = quoteStart - 2;
        while (i >= 0 && /\s/.test(source[i])) i--;
        if (i < 0) {
            return false;
        }
        return source[i] === "{" || source[i] === ",";
    }

    /**
     * Find the matching closing bracket for `[` starting at startIndex.
     */
    private static findMatchingBracket(source: string, startIndex: number, open: "[" | "{"): number {
        const close = open === "[" ? "]" : "}";
        const len = source.length;
        let depth = 0;
        let inString = false;
        let escape = false;

        for (let i = startIndex; i < len; i++) {
            const ch = source[i];

            if (inString) {
                if (escape) {
                    escape = false;
                } else if (ch === "\\") {
                    escape = true;
                } else if (ch === '"') {
                    inString = false;
                }
            } else {
                if (ch === '"') {
                    inString = true;
                } else if (ch === open) {
                    depth++;
                } else if (ch === close) {
                    depth--;
                    if (depth === 0) {
                        return i;
                    }
                }
            }
        }

        throw new Error("No matching closing bracket found in JSON source");
    }
}
