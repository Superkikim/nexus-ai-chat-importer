import { NexusAiChatImporterError } from "../models/errors";
import { logger } from "../logger";
import { StreamingJsonArrayParser } from "./streaming-json-array-parser";
import { ZipArchiveReader } from "./zip-loader";

const DEFAULT_LARGE_JSON_THRESHOLD_BYTES = 32 * 1024 * 1024; // 32 MB
const DEFAULT_STREAM_YIELD_EVERY = 25;

export type SupportedArchiveProvider = "chatgpt" | "claude" | "lechat" | "gemini";

export type ArchiveClassification =
    | {
        supported: true;
        provider: SupportedArchiveProvider;
        reason: "supported";
        message?: string;
    }
    | {
        supported: false;
        provider?: undefined;
        reason: "empty" | "unsupported-format" | "provider-mismatch";
        message?: string;
    };

export function findGeminiActivityJsonFiles(fileNames: string[]): string[] {
    const geminiJsonFiles: string[] = [];

    for (const name of fileNames) {
        if (!name.toLowerCase().endsWith(".json")) continue;

        const segments = name.split("/");
        if (segments.length >= 3 && segments[0] === "Takeout") {
            const thirdLevel = segments[2];
            if (thirdLevel.toLowerCase().includes("gemini")) {
                geminiJsonFiles.push(name);
            }
        }
    }

    return geminiJsonFiles;
}

export function classifyArchiveEntries(
    fileNames: string[],
    forcedProvider?: string
): ArchiveClassification {
    if (fileNames.length === 0) {
        return {
            supported: false,
            reason: "empty",
            message: "The ZIP file contains no files.",
        };
    }

    const hasConversationsJson = fileNames.includes("conversations.json")
        || fileNames.some(name => /^conversations-\d+\.json$/.test(name));
    const hasUsersJson = fileNames.includes("users.json");
    const hasLeChatFiles = fileNames.some(name => /^chat-[a-f0-9-]+\.json$/.test(name));
    const hasGeminiActivityJson = findGeminiActivityJsonFiles(fileNames).length > 0;

    const detectedProvider: SupportedArchiveProvider | undefined =
        hasLeChatFiles && !hasConversationsJson
            ? "lechat"
            : hasGeminiActivityJson && !hasConversationsJson && !hasLeChatFiles
            ? "gemini"
            : hasConversationsJson && hasUsersJson
            ? "claude"
            : hasConversationsJson
            ? "chatgpt"
            : undefined;

    if (forcedProvider) {
        const expectedProvider = forcedProvider as SupportedArchiveProvider;

        if (expectedProvider === "chatgpt") {
            if (detectedProvider === "chatgpt") {
                return { supported: true, provider: "chatgpt", reason: "supported" };
            }

            return {
                supported: false,
                reason: detectedProvider ? "provider-mismatch" : "unsupported-format",
                message: "This ZIP file does not look like a ChatGPT export.",
            };
        }

        if (expectedProvider === "claude") {
            if (detectedProvider === "claude") {
                return { supported: true, provider: "claude", reason: "supported" };
            }

            return {
                supported: false,
                reason: detectedProvider ? "provider-mismatch" : "unsupported-format",
                message: "This ZIP file does not look like a Claude export.",
            };
        }

        if (expectedProvider === "lechat") {
            if (detectedProvider === "lechat") {
                return { supported: true, provider: "lechat", reason: "supported" };
            }

            return {
                supported: false,
                reason: detectedProvider ? "provider-mismatch" : "unsupported-format",
                message: "This ZIP file does not look like a Le Chat export.",
            };
        }

        if (expectedProvider === "gemini") {
            if (detectedProvider === "gemini") {
                return { supported: true, provider: "gemini", reason: "supported" };
            }

            return {
                supported: false,
                reason: detectedProvider ? "provider-mismatch" : "unsupported-format",
                message: "This ZIP file does not look like a Gemini Takeout export.",
            };
        }
    }

    if (!detectedProvider) {
        return {
            supported: false,
            reason: "unsupported-format",
            message: "This ZIP file does not match any supported export format.",
        };
    }

    return {
        supported: true,
        provider: detectedProvider,
        reason: "supported",
    };
}

export interface RawConversationExtractionResult {
    conversations: any[];
    uncompressedBytes: number;
}

export interface ConversationStreamOptions {
    mobileRuntime?: boolean;
    enforceChunkedForLargeJsonOnMobile?: boolean;
    largeJsonThresholdBytes?: number;
    streamYieldEvery?: number;
}

async function listFileNames(zip: ZipArchiveReader): Promise<string[]> {
    const entries = await zip.listEntries();
    return entries.map(entry => entry.path);
}

async function collectJsonArrayFromEntry(entry: {
    readText(): Promise<string>;
    readTextChunks?: () => AsyncGenerator<string>;
}): Promise<{ items: any[]; uncompressedBytes: number }> {
    const items: any[] = [];
    let uncompressedBytes = 0;
    const chunkReader = entry.readTextChunks?.bind(entry);

    if (chunkReader) {
        const reader = chunkReader;
        async function* countingChunks(): AsyncGenerator<string> {
            for await (const chunk of reader()) {
                uncompressedBytes += chunk.length;
                yield chunk;
            }
        }

        for await (const value of StreamingJsonArrayParser.streamConversationsFromChunks(countingChunks())) {
            items.push(value);
        }

        return { items, uncompressedBytes };
    }

    throw new NexusAiChatImporterError(
        "ZIP_TEXT_STREAM_REQUIRED",
        "ZIP entry text streaming is unavailable for this archive reader."
    );
}

async function collectLeChatConversationFromEntry(entry: {
    readText(): Promise<string>;
    readTextChunks?: () => AsyncGenerator<string>;
}): Promise<{ messages: any[]; uncompressedBytes: number }> {
    const messages: any[] = [];
    let uncompressedBytes = 0;
    const chunkReader = entry.readTextChunks?.bind(entry);

    if (chunkReader) {
        const reader = chunkReader;
        async function* countingChunks(): AsyncGenerator<string> {
            for await (const chunk of reader()) {
                uncompressedBytes += chunk.length;
                yield chunk;
            }
        }

        for await (const message of StreamingJsonArrayParser.streamConversationsFromChunks(countingChunks())) {
            messages.push(message);
        }
        return { messages, uncompressedBytes };
    }

    throw new NexusAiChatImporterError(
        "ZIP_TEXT_STREAM_REQUIRED",
        "ZIP entry text streaming is unavailable for this archive reader."
    );
}

function formatRuntimeMemorySnapshot(): string {
    const perf = globalThis.performance as Performance & {
        memory?: {
            usedJSHeapSize: number;
            totalJSHeapSize: number;
            jsHeapSizeLimit: number;
        };
    };

    const memory = perf?.memory;
    if (!memory || typeof memory.usedJSHeapSize !== "number") {
        return "heap=n/a";
    }

    const usedMb = Math.round((memory.usedJSHeapSize / (1024 * 1024)) * 10) / 10;
    const totalMb = Math.round((memory.totalJSHeapSize / (1024 * 1024)) * 10) / 10;
    const limitMb = Math.round((memory.jsHeapSizeLimit / (1024 * 1024)) * 10) / 10;
    return `heapUsedMB=${usedMb},heapTotalMB=${totalMb},heapLimitMB=${limitMb}`;
}

export async function extractRawConversations(
    zip: ZipArchiveReader
): Promise<RawConversationExtractionResult> {
    const fileNames = await listFileNames(zip);

    const leChatFiles = fileNames.filter(name => /^chat-[a-f0-9-]+\.json$/.test(name));
    if (leChatFiles.length > 0) {
        const conversations: any[] = [];
        let uncompressedBytes = 0;

        for (const fileName of leChatFiles) {
            const entry = zip.get(fileName);
            if (!entry) continue;
            const { messages, uncompressedBytes: fileBytes } = await collectLeChatConversationFromEntry(entry);
            uncompressedBytes += fileBytes;
            conversations.push(messages);
        }

        return { conversations, uncompressedBytes };
    }

    const geminiJsonFiles = findGeminiActivityJsonFiles(fileNames);
    if (geminiJsonFiles.length > 0) {
        const activityFile = zip.get(geminiJsonFiles[0]);
        if (!activityFile) {
            throw new NexusAiChatImporterError(
                "Missing Gemini activity JSON",
                "The ZIP file appears to contain a Gemini folder but the activity JSON file is missing."
            );
        }

        const { items: conversations, uncompressedBytes } = await collectJsonArrayFromEntry(activityFile);

        if (conversations.length === 0) {
            throw new NexusAiChatImporterError(
                "Empty Gemini export",
                "No entries found in the Gemini activity JSON file."
            );
        }

        return { conversations, uncompressedBytes };
    }

    const numberedConvFiles = fileNames.filter(name => /^conversations-\d+\.json$/.test(name)).sort();
    if (numberedConvFiles.length > 0) {
        const conversations: any[] = [];
        let uncompressedBytes = 0;

        for (const fileName of numberedConvFiles) {
            const entry = zip.get(fileName);
            if (!entry) continue;
            const parsed = await collectJsonArrayFromEntry(entry);
            uncompressedBytes += parsed.uncompressedBytes;

            for (const conv of parsed.items) {
                conversations.push(conv);
            }
        }

        if (conversations.length === 0) {
            throw new NexusAiChatImporterError(
                "No conversations found",
                "The numbered conversation files are all empty."
            );
        }

        return { conversations, uncompressedBytes };
    }

    const conversationsFile = zip.get("conversations.json");
    if (!conversationsFile) {
        throw new NexusAiChatImporterError(
            "Missing conversations.json",
            "The ZIP file does not contain a conversations.json file, chat-{uuid}.json files, or a Gemini activity JSON file."
        );
    }

    const { items: conversations, uncompressedBytes } = await collectJsonArrayFromEntry(conversationsFile);

    if (conversations.length === 0) {
        throw new NexusAiChatImporterError(
            "No conversations found",
            "The conversations.json file exists but contains no conversations."
        );
    }

    return { conversations, uncompressedBytes };
}

export async function* extractConversationsStream(
    zip: ZipArchiveReader,
    options: ConversationStreamOptions = {}
): AsyncGenerator<any> {
    const streamLogger = logger.child("Stream");
    const startedAt = Date.now();
    const largeJsonThresholdBytes = options.largeJsonThresholdBytes ?? DEFAULT_LARGE_JSON_THRESHOLD_BYTES;
    const streamYieldEvery = Math.max(1, options.streamYieldEvery ?? DEFAULT_STREAM_YIELD_EVERY);
    const isMobileRuntime = !!options.mobileRuntime;
    const enforceChunkedForLargeJsonOnMobile = options.enforceChunkedForLargeJsonOnMobile ?? isMobileRuntime;
    const yieldToEventLoopIfNeeded = async (count: number): Promise<void> => {
        if (!isMobileRuntime) {
            return;
        }
        if (count % streamYieldEvery !== 0) {
            return;
        }
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
    };

    streamLogger.info("Begin conversation stream extraction");
    const entries = await zip.listEntries();
    const fileNames = entries.map((entry) => entry.path);
    const entrySizeMap = new Map(entries.map((entry) => [entry.path, entry.size]));
    streamLogger.info("ZIP entry listing complete for stream extraction", {
        entryCount: fileNames.length,
        durationMs: Date.now() - startedAt,
    });

    const leChatFiles = fileNames.filter(name => /^chat-[a-f0-9-]+\.json$/.test(name));
    if (leChatFiles.length > 0) {
        streamLogger.info("Using Le Chat conversation stream", {
            fileCount: leChatFiles.length,
        });
        let yieldedCount = 0;
        for (const fileName of leChatFiles) {
            const entry = zip.get(fileName);
            if (!entry) continue;
            streamLogger.info("Reading Le Chat conversation file", { fileName });
            const { messages, uncompressedBytes } = await collectLeChatConversationFromEntry(entry);
            streamLogger.info("Le Chat conversation file read complete", {
                fileName,
                textLength: uncompressedBytes,
            });
            yieldedCount++;
            yield messages;
        }
        streamLogger.info("Le Chat conversation stream complete", {
            yieldedCount,
            durationMs: Date.now() - startedAt,
        });
        return;
    }

    const geminiJsonFiles = findGeminiActivityJsonFiles(fileNames);
    if (geminiJsonFiles.length > 0) {
        throw new NexusAiChatImporterError(
            "Gemini streaming not supported",
            "Gemini imports still require all-at-once processing."
        );
    }

    const numberedConvFiles = fileNames.filter(name => /^conversations-\d+\.json$/.test(name)).sort();
    if (numberedConvFiles.length > 0) {
        streamLogger.info("Using numbered conversation stream", {
            fileCount: numberedConvFiles.length,
        });
        let yieldedCount = 0;
        for (const fileName of numberedConvFiles) {
            const entry = zip.get(fileName);
            if (!entry) continue;
            const entrySize = entrySizeMap.get(fileName);
            const fileReadStartedAt = Date.now();
            const isLargeJsonFile = typeof entrySize === "number" && entrySize >= largeJsonThresholdBytes;
            const chunkReader = entry.readTextChunks?.bind(entry);
            const canUseChunkedReader = !!chunkReader;
            streamLogger.info(
                `Reading numbered conversation file (${fileName}) [entrySize=${entrySize ?? "n/a"} bytes, ${formatRuntimeMemorySnapshot()}]`
            );
            if (isLargeJsonFile) {
                streamLogger.info("Large JSON mode activated for numbered conversation file", {
                    fileName,
                    entrySize,
                    thresholdBytes: largeJsonThresholdBytes,
                    mobileRuntime: isMobileRuntime,
                    chunkedAvailable: canUseChunkedReader,
                });
            }
            if (chunkReader) {
                streamLogger.info("Using chunked numbered conversation reader", {
                    fileName,
                    entrySize: entrySize ?? null,
                });
                for await (const conv of StreamingJsonArrayParser.streamConversationsFromChunks(chunkReader())) {
                    yieldedCount++;
                    if (yieldedCount <= 3 || yieldedCount % 100 === 0) {
                        streamLogger.info("Yielding streamed conversation", {
                            source: fileName,
                            yieldedCount,
                        });
                    }
                    yield conv;
                    await yieldToEventLoopIfNeeded(yieldedCount);
                }
                streamLogger.info("Chunked numbered conversation file parse complete", {
                    fileName,
                    readDurationMs: Date.now() - fileReadStartedAt,
                    memorySnapshot: formatRuntimeMemorySnapshot(),
                });
            } else if (isMobileRuntime && isLargeJsonFile && enforceChunkedForLargeJsonOnMobile) {
                throw new NexusAiChatImporterError(
                    "MOBILE_LARGE_JSON_STREAM_REQUIRED",
                    {
                        fileName,
                        entrySizeBytes: entrySize ?? null,
                        thresholdBytes: largeJsonThresholdBytes,
                    }
                );
            } else {
                throw new NexusAiChatImporterError(
                    "ZIP_TEXT_STREAM_REQUIRED",
                    {
                        fileName,
                        entrySizeBytes: entrySize ?? null,
                    }
                );
            }
        }
        streamLogger.info("Numbered conversation stream complete", {
            yieldedCount,
            durationMs: Date.now() - startedAt,
        });
        return;
    }

    const conversationsFile = zip.get("conversations.json");
    if (!conversationsFile) {
        throw new NexusAiChatImporterError(
            "Missing conversations.json",
            "The ZIP file does not contain a conversations.json file, chat-{uuid}.json files, or a Gemini activity JSON file."
        );
    }

    const conversationEntrySize = entrySizeMap.get("conversations.json");
    const readStartedAt = Date.now();
    const isLargeConversationsJson = typeof conversationEntrySize === "number" && conversationEntrySize >= largeJsonThresholdBytes;
    const chunkReader = conversationsFile.readTextChunks?.bind(conversationsFile);
    const canUseChunkedReader = !!chunkReader;
    streamLogger.info(
        `Reading conversations.json for stream extraction [entrySize=${conversationEntrySize ?? "n/a"} bytes, ${formatRuntimeMemorySnapshot()}]`
    );
    if (isLargeConversationsJson) {
        streamLogger.info("Large JSON mode activated for conversations.json", {
            entrySize: conversationEntrySize ?? null,
            thresholdBytes: largeJsonThresholdBytes,
            mobileRuntime: isMobileRuntime,
            chunkedAvailable: canUseChunkedReader,
        });
    }
    let yieldedCount = 0;
    if (chunkReader) {
        streamLogger.info("Using chunked conversations.json reader", {
            entrySize: conversationEntrySize ?? null,
        });
        try {
            for await (const conv of StreamingJsonArrayParser.streamConversationsFromChunks(chunkReader())) {
                yieldedCount++;
                if (yieldedCount <= 3 || yieldedCount % 100 === 0) {
                    streamLogger.info("Yielding streamed conversation", {
                        source: "conversations.json",
                        yieldedCount,
                    });
                }
                yield conv;
                await yieldToEventLoopIfNeeded(yieldedCount);
            }
        } catch (error) {
            streamLogger.error("Failed while chunk-reading conversations.json for stream extraction", {
                durationMs: Date.now() - readStartedAt,
                memorySnapshot: formatRuntimeMemorySnapshot(),
                yieldedCount,
                message: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
        streamLogger.info("Conversation stream extraction complete", {
            yieldedCount,
            parseDurationMs: Date.now() - readStartedAt,
            durationMs: Date.now() - startedAt,
            memorySnapshot: formatRuntimeMemorySnapshot(),
            mode: "chunked",
        });
    } else if (isMobileRuntime && isLargeConversationsJson && enforceChunkedForLargeJsonOnMobile) {
        throw new NexusAiChatImporterError(
            "MOBILE_LARGE_JSON_STREAM_REQUIRED",
            {
                fileName: "conversations.json",
                entrySizeBytes: conversationEntrySize ?? null,
                thresholdBytes: largeJsonThresholdBytes,
            }
        );
    } else {
        throw new NexusAiChatImporterError(
            "ZIP_TEXT_STREAM_REQUIRED",
            {
                fileName: "conversations.json",
                entrySizeBytes: conversationEntrySize ?? null,
            }
        );
    }
}
