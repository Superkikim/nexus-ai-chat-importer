/**
 * Helpers for parsing very large conversations.json files without hitting
 * the browser/Node string length limit (~512 MB).
 */

import JSZip from "jszip";

export interface ConversationStreamOptions {
    shape?: "auto" | "chatgpt" | "claude";
}

type JsonArrayItemHandler = (item: any, index: number) => void | Promise<void>;

const STRING_LIMIT = 0x1fffffe8; // ~512 MB - Chrome/Node string length ceiling
const DEFAULT_CHUNK_SIZE = 1024 * 1024 * 4; // 4MB
const DEFAULT_YIELD_BYTES = 1024 * 1024 * 32; // Yield every 32MB
const STREAM_BUFFER_SAFETY_MARGIN = 1024 * 1024 * 8; // Keep headroom under string limit
const DEFAULT_MAX_BUFFER_CHARS = 1024 * 1024 * 256; // Allow very large single conversations

/**
 * Safely parse conversations.json from a ZIP file.
 * Falls back to streaming consumption for very large archives.
 */
export async function parseConversationsJson(conversationsFile: JSZip.JSZipObject): Promise<any> {
    const size = (conversationsFile as any)._data?.uncompressedSize as number | undefined;

    // If we already know the file is too large for a single string, stream-parse immediately
    if (size && size > STRING_LIMIT) {
        const data = await conversationsFile.async("uint8array");
        return await parseWithStreamingFallback(data);
    }

    try {
        const content = await conversationsFile.async("string");
        return JSON.parse(content);
    } catch (error: any) {
        if (isStringTooLongError(error)) {
            const data = await conversationsFile.async("uint8array");
            return await parseWithStreamingFallback(data);
        }

        throw error;
    }
}

/**
 * Async generator that yields each array item without materializing the full array.
 */
export async function* iterJsonArray(data: Uint8Array): AsyncGenerator<any, void, unknown> {
    const queue: any[] = [];
    let done = false;
    let thrown: any = null;

    const parsePromise = streamJsonArray(data, async (item) => {
        queue.push(item);
    })
        .catch((err) => {
            thrown = err;
        })
        .finally(() => {
            done = true;
        });

    while (!done || queue.length > 0) {
        if (thrown) {
            throw thrown;
        }

        if (queue.length > 0) {
            yield queue.shift();
            continue;
        }

        await yieldToEventLoop();
    }

    // Ensure parsing errors propagate
    await parsePromise;
    if (thrown) {
        throw thrown;
    }
}

/**
 * Stream parser for a JSON array (e.g., ChatGPT conversations.json).
 * Decodes incrementally to avoid allocating a single huge string.
 */
export async function streamParseJsonArray(data: Uint8Array): Promise<any[]> {
    return streamParseJsonArrayAsync(data);
}

async function parseWithStreamingFallback(data: Uint8Array): Promise<any> {
    const firstChar = getFirstNonWhitespaceChar(data);

    if (firstChar === "[") {
        return streamParseJsonArrayAsync(data);
    }

    // Try Claude-style nested conversations array
    const generator = streamConversationsFromData(data, { shape: "claude" });
    const collected: any[] = [];
    for await (const item of generator) {
        collected.push(item);
    }
    return { conversations: collected };
}

/**
 * Streaming parser for a top-level JSON array, optimized for very large files.
 */
export async function streamParseJsonArrayAsync(data: Uint8Array): Promise<any[]> {
    const results: any[] = [];
    await streamJsonArray(data, (item) => {
        results.push(item);
    });
    return results;
}

/**
 * Core streaming parser that invokes a handler per array item.
 */
async function streamJsonArray(data: Uint8Array, handler: JsonArrayItemHandler): Promise<number> {
    const decoder = new TextDecoder("utf-8");
    const chunkSize = DEFAULT_CHUNK_SIZE;
    const yieldEveryBytes = DEFAULT_YIELD_BYTES;

    const maxBufferChars = Math.min(
        STRING_LIMIT - STREAM_BUFFER_SAFETY_MARGIN,
        Math.max(DEFAULT_MAX_BUFFER_CHARS, data.length + STREAM_BUFFER_SAFETY_MARGIN)
    );

    let buffer = "";
    let depth = 0;
    let inString = false;
    let escaping = false;
    let objectStart = -1;
    let sawArrayStart = false;
    let index = 0;
    let cursor = 0; // track how much of the buffer we've already scanned

    const trimBufferStart = () => {
        let idx = 0;
        while (idx < buffer.length) {
            const ch = buffer.charCodeAt(idx);
            // whitespace, comma, [, ]
            if (ch === 0x20 || ch === 0x0a || ch === 0x0d || ch === 0x09 || ch === 0x2c || ch === 0x5b || ch === 0x5d) {
                idx++;
                continue;
            }
            break;
        }
        if (idx > 0) {
            buffer = buffer.slice(idx);
        }
    };

    const processBuffer = async () => {
        for (let i = cursor; i < buffer.length; i++) {
            const char = buffer[i];

            if (inString) {
                if (escaping) {
                    escaping = false;
                    continue;
                }
                if (char === "\\") {
                    escaping = true;
                    continue;
                }
                if (char === '"') {
                    inString = false;
                }
                continue;
            }

            if (char === '"') {
                inString = true;
                continue;
            }

            if (!sawArrayStart) {
                if (char === "[") {
                    sawArrayStart = true;
                    continue;
                } else if (/\s/.test(char)) {
                    continue;
                } else {
                    throw new Error("Expected '[' at start of conversations.json");
                }
            }

            if (char === "{") {
                if (depth === 0) {
                    objectStart = i;
                }
                depth++;
            } else if (char === "}") {
                depth--;
                if (depth === 0 && objectStart !== -1) {
                    const objStr = buffer.slice(objectStart, i + 1);
                    await handler(JSON.parse(objStr), index++);
                    buffer = buffer.slice(i + 1);
                    objectStart = -1;
                    cursor = 0; // buffer changed, restart scan from beginning
                    i = -1; // reset index after slice
                    trimBufferStart();
                }
            }
        }

        // Next pass should start from where we stopped
        cursor = buffer.length;
    };

    let bytesSinceYield = 0;

    const decodeAndProcess = async (chunk: Uint8Array, stream: boolean) => {
        try {
            buffer += decoder.decode(chunk, { stream });
        } catch (err: any) {
            if (isStringTooLongError(err)) {
                throw new Error("Streaming parser hit string size limit while decoding. Try splitting the export into smaller files.");
            }
            throw err;
        }

        // Guard against runaway buffer growth (unexpected structure)
        if (buffer.length > maxBufferChars) {
            const limitMb = Math.floor(maxBufferChars / (1024 * 1024));
            throw new Error(
                `Streaming parser buffer exceeded safe size (~${limitMb} MB). The export may contain an extremely large single conversation. Split the export and retry.`
            );
        }

        await processBuffer();
    };

    for (let offset = 0; offset < data.length; offset += chunkSize) {
        const chunk = data.subarray(offset, offset + chunkSize);
        await decodeAndProcess(chunk, true);

        bytesSinceYield += chunk.length;
        if (bytesSinceYield >= yieldEveryBytes) {
            bytesSinceYield = 0;
            await yieldToEventLoop();
        }
    }

    await decodeAndProcess(new Uint8Array(), false); // flush decoder

    if (!sawArrayStart) {
        throw new Error("conversations.json did not start with an array");
    }
    if (depth !== 0 || inString) {
        throw new Error("Invalid JSON array structure in conversations.json");
    }

    return index;
}

/**
 * Stream conversations.json directly from a JSZip file without materializing.
 */
export async function* streamConversationsFromZip(
    conversationsFile: JSZip.JSZipObject,
    options?: ConversationStreamOptions
): AsyncGenerator<any, void, unknown> {
    const data = await conversationsFile.async("uint8array");
    yield* streamConversationsFromData(data, options);
}

/**
 * Streaming helper that works on already-loaded Uint8Array data.
 */
export async function* streamConversationsFromData(
    data: Uint8Array,
    options?: ConversationStreamOptions
): AsyncGenerator<any, void, unknown> {
    const shape = options?.shape ?? "auto";

    if (shape === "chatgpt") {
        yield* iterJsonArray(data);
        return;
    }

    if (shape === "claude") {
        const startIndex = findConversationsArrayStart(data);
        if (startIndex === null) {
            throw new Error("Could not locate conversations array in Claude export");
        }
        const endIndex = findMatchingArrayEnd(data, startIndex);
        const slice = data.subarray(startIndex, endIndex + 1);
        yield* iterJsonArray(slice);
        return;
    }

    // Auto-detect based on first non-whitespace character
    const firstChar = getFirstNonWhitespaceChar(data);
    if (firstChar === "[") {
        yield* iterJsonArray(data);
        return;
    }

    // Try Claude nested structure as fallback
    const startIndex = findConversationsArrayStart(data);
    if (startIndex !== null) {
        const endIndex = findMatchingArrayEnd(data, startIndex);
        const slice = data.subarray(startIndex, endIndex + 1);
        yield* iterJsonArray(slice);
        return;
    }

    throw new Error("Unsupported conversations.json structure for streaming");
}

async function yieldToEventLoop(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

function isStringTooLongError(error: any): boolean {
    if (!error) return false;

    const message = typeof error.message === "string" ? error.message : "";
    return (
        error instanceof RangeError ||
        error.code === "ERR_STRING_TOO_LONG" ||
        message.includes("Invalid string length") ||
        message.includes("Cannot create a string longer")
    );
}

function getFirstNonWhitespaceChar(data: Uint8Array): string | null {
    for (let i = 0; i < data.length; i++) {
        const code = data[i];
        if (code === 0x20 || code === 0x0a || code === 0x0d || code === 0x09) {
            continue;
        }
        return String.fromCharCode(code);
    }
    return null;
}

function findConversationsArrayStart(data: Uint8Array): number | null {
    const decoder = new TextDecoder("utf-8");
    const pattern = /"conversations"\s*:/;
    const maxBuffer = 512 * 1024; // keep last 512KB while searching
    let buffer = "";
    let consumed = 0;

    for (let offset = 0; offset < data.length; offset += DEFAULT_CHUNK_SIZE) {
        const chunk = data.subarray(offset, offset + DEFAULT_CHUNK_SIZE);
        buffer += decoder.decode(chunk, { stream: true });

        const matchIndex = buffer.search(pattern);
        if (matchIndex !== -1) {
            const bracketIndex = buffer.indexOf("[", matchIndex);
            if (bracketIndex !== -1) {
                return consumed + bracketIndex;
            }
        }

        if (buffer.length > maxBuffer) {
            const drop = buffer.length - maxBuffer;
            buffer = buffer.slice(drop);
            consumed += drop;
        }
    }

    buffer += decoder.decode(new Uint8Array(), { stream: false });
    const matchIndex = buffer.search(pattern);
    if (matchIndex !== -1) {
        const bracketIndex = buffer.indexOf("[", matchIndex);
        if (bracketIndex !== -1) {
            return consumed + bracketIndex;
        }
    }

    return null;
}

function findMatchingArrayEnd(data: Uint8Array, startIndex: number): number {
    let inString = false;
    let escaping = false;
    let depth = 0;

    for (let i = startIndex; i < data.length; i++) {
        const ch = data[i];

        if (inString) {
            if (escaping) {
                escaping = false;
                continue;
            }
            if (ch === 0x5c) { // '\\'
                escaping = true;
                continue;
            }
            if (ch === 0x22) { // '"'
                inString = false;
            }
            continue;
        }

        if (ch === 0x22) { // '"'
            inString = true;
            continue;
        }

        if (ch === 0x5b) { // '['
            depth++;
        } else if (ch === 0x5d) { // ']'
            depth--;
            if (depth === 0) {
                return i;
            }
        }
    }

    throw new Error("Could not find end of conversations array");
}
