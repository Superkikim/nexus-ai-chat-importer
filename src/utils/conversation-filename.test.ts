import { describe, expect, it } from "vitest";
import {
    CONVERSATION_NOTE_FILENAME_MAX_BYTES,
    generateConversationFileName,
    generateUniqueFileName,
    getUtf8ByteLength,
} from "../utils";

describe("conversation filename length policy", () => {
    it("keeps normal short titles unchanged", () => {
        const name = generateConversationFileName(
            "Short title",
            1_700_000_000,
            false,
            "YYYY-MM-DD",
            { maxBytes: CONVERSATION_NOTE_FILENAME_MAX_BYTES - 3 }
        );

        expect(name).toBe("Short title");
    });

    it("truncates long ASCII titles to the configured byte budget", () => {
        const longTitle = "A".repeat(300);
        const maxBaseBytes = CONVERSATION_NOTE_FILENAME_MAX_BYTES - 3;
        const name = generateConversationFileName(
            longTitle,
            1_700_000_000,
            false,
            "YYYY-MM-DD",
            { maxBytes: maxBaseBytes }
        );

        expect(getUtf8ByteLength(name)).toBeLessThanOrEqual(maxBaseBytes);
        expect(name.length).toBe(maxBaseBytes);
    });

    it("truncates unicode titles safely by UTF-8 bytes", () => {
        const longUnicodeTitle = "你好世界".repeat(80);
        const maxBaseBytes = CONVERSATION_NOTE_FILENAME_MAX_BYTES - 3;
        const name = generateConversationFileName(
            longUnicodeTitle,
            1_700_000_000,
            false,
            "YYYY-MM-DD",
            { maxBytes: maxBaseBytes }
        );

        expect(getUtf8ByteLength(name)).toBeLessThanOrEqual(maxBaseBytes);
        expect(name.length).toBeGreaterThan(0);
    });

    it("preserves date prefix while enforcing length budget", () => {
        const longTitle = "Z".repeat(400);
        const maxBaseBytes = CONVERSATION_NOTE_FILENAME_MAX_BYTES - 3;
        const name = generateConversationFileName(
            longTitle,
            1_704_067_200, // 2024-01-31T00:00:00.000Z
            true,
            "YYYY-MM-DD",
            { maxBytes: maxBaseBytes }
        );

        expect(/^\d{4}-\d{2}-\d{2} - /.test(name)).toBe(true);
        expect(getUtf8ByteLength(name)).toBeLessThanOrEqual(maxBaseBytes);
    });

    it("keeps collision suffixes within the max byte budget", async () => {
        const folderPath = "Nexus/Conversations/perplexity/2026/05";
        const maxBaseBytes = CONVERSATION_NOTE_FILENAME_MAX_BYTES - 3;
        const longTitle = "B".repeat(500);
        const baseName = generateConversationFileName(
            longTitle,
            1_704_067_200,
            false,
            "YYYY-MM-DD",
            { maxBytes: maxBaseBytes }
        );

        const initialPath = `${folderPath}/${baseName}.md`;
        const occupied = new Set<string>([initialPath]);

        const fakeAdapter = {
            exists: async (candidate: string) => occupied.has(candidate),
        };

        const uniquePath = await generateUniqueFileName(
            initialPath,
            fakeAdapter,
            CONVERSATION_NOTE_FILENAME_MAX_BYTES
        );
        const fileName = uniquePath.split("/").pop() || "";

        expect(fileName.endsWith(" (1).md")).toBe(true);
        expect(getUtf8ByteLength(fileName)).toBeLessThanOrEqual(CONVERSATION_NOTE_FILENAME_MAX_BYTES);
    });
});
