import { NexusAiChatImporterError } from "../models/errors";
import { StreamingJsonArrayParser } from "./streaming-json-array-parser";
import { ZipArchiveReader } from "./zip-loader";

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
    const fileNames = await listFileNames(zip);

    const leChatFiles = fileNames.filter(name => /^chat-[a-f0-9-]+\.json$/.test(name));
    if (leChatFiles.length > 0) {
        for (const fileName of leChatFiles) {
            const entry = zip.get(fileName);
            if (!entry) continue;
            yield JSON.parse(await entry.readText());
        }
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
        for (const fileName of numberedConvFiles) {
            const entry = zip.get(fileName);
            if (!entry) continue;
            const json = await entry.readText();
            for (const conv of StreamingJsonArrayParser.streamConversations(json)) {
                yield conv;
            }
        }
        return;
    }

    const conversationsFile = zip.get("conversations.json");
    if (!conversationsFile) {
        throw new NexusAiChatImporterError(
            "Missing conversations.json",
            "The ZIP file does not contain a conversations.json file, chat-{uuid}.json files, or a Gemini activity JSON file."
        );
    }

    const conversationsJson = await conversationsFile.readText();
    for (const conv of StreamingJsonArrayParser.streamConversations(conversationsJson)) {
        yield conv;
    }
}
