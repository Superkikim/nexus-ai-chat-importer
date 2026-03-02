import { NexusAiChatImporterError } from "../models/errors";
import { logger } from "../logger";
import { StreamingJsonArrayParser } from "./streaming-json-array-parser";
import { ZipArchiveReader } from "./zip-loader";

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

async function listFileNames(zip: ZipArchiveReader): Promise<string[]> {
    const entries = await zip.listEntries();
    return entries.map(entry => entry.path);
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
            const content = await entry.readText();
            uncompressedBytes += content.length;
            conversations.push(JSON.parse(content));
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

        const activityJson = await activityFile.readText();
        const conversations: any[] = [];
        for (const entry of StreamingJsonArrayParser.streamConversations(activityJson)) {
            conversations.push(entry);
        }

        if (conversations.length === 0) {
            throw new NexusAiChatImporterError(
                "Empty Gemini export",
                "No entries found in the Gemini activity JSON file."
            );
        }

        return { conversations, uncompressedBytes: activityJson.length };
    }

    const numberedConvFiles = fileNames.filter(name => /^conversations-\d+\.json$/.test(name)).sort();
    if (numberedConvFiles.length > 0) {
        const conversations: any[] = [];
        let uncompressedBytes = 0;

        for (const fileName of numberedConvFiles) {
            const entry = zip.get(fileName);
            if (!entry) continue;
            const json = await entry.readText();
            uncompressedBytes += json.length;

            for (const conv of StreamingJsonArrayParser.streamConversations(json)) {
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

    const conversationsJson = await conversationsFile.readText();
    const conversations: any[] = [];
    for (const conv of StreamingJsonArrayParser.streamConversations(conversationsJson)) {
        conversations.push(conv);
    }

    if (conversations.length === 0) {
        throw new NexusAiChatImporterError(
            "No conversations found",
            "The conversations.json file exists but contains no conversations."
        );
    }

    return { conversations, uncompressedBytes: conversationsJson.length };
}

export async function* extractConversationsStream(
    zip: ZipArchiveReader
): AsyncGenerator<any> {
    const streamLogger = logger.child("Stream");
    const startedAt = Date.now();
    streamLogger.info("Begin conversation stream extraction");
    const fileNames = await listFileNames(zip);
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
            const text = await entry.readText();
            streamLogger.info("Le Chat conversation file read complete", {
                fileName,
                textLength: text.length,
            });
            yieldedCount++;
            yield JSON.parse(text);
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
            streamLogger.info("Reading numbered conversation file", { fileName });
            const json = await entry.readText();
            streamLogger.info("Numbered conversation file read complete", {
                fileName,
                textLength: json.length,
            });
            for (const conv of StreamingJsonArrayParser.streamConversations(json)) {
                yieldedCount++;
                if (yieldedCount <= 3 || yieldedCount % 100 === 0) {
                    streamLogger.info("Yielding streamed conversation", {
                        source: fileName,
                        yieldedCount,
                    });
                }
                yield conv;
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

    streamLogger.info("Reading conversations.json for stream extraction");
    const conversationsJson = await conversationsFile.readText();
    streamLogger.info("conversations.json read complete", {
        textLength: conversationsJson.length,
        durationMs: Date.now() - startedAt,
    });
    let yieldedCount = 0;
    for (const conv of StreamingJsonArrayParser.streamConversations(conversationsJson)) {
        yieldedCount++;
        if (yieldedCount <= 3 || yieldedCount % 100 === 0) {
            streamLogger.info("Yielding streamed conversation", {
                source: "conversations.json",
                yieldedCount,
            });
        }
        yield conv;
    }
    streamLogger.info("Conversation stream extraction complete", {
        yieldedCount,
        durationMs: Date.now() - startedAt,
    });
}
