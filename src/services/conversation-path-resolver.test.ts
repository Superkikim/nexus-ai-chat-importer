import { describe, expect, it } from "vitest";
import {
    buildConversationFolderPath,
    buildConversationRelativeFolder,
    getConversationPathParts,
} from "./conversation-path-resolver";

describe("conversation-path-resolver", () => {
    it("should build provider/year/month relative folder", () => {
        const parts = {
            provider: "chatgpt",
            year: "2025",
            month: "03",
        };

        const relative = buildConversationRelativeFolder(parts, "provider-year-month");
        expect(relative).toBe("chatgpt/2025/03");
    });

    it("should build year/month/provider relative folder", () => {
        const parts = {
            provider: "chatgpt",
            year: "2025",
            month: "03",
        };

        const relative = buildConversationRelativeFolder(parts, "year-month-provider");
        expect(relative).toBe("2025/03/chatgpt");
    });

    it("should build absolute conversation folder path", () => {
        const folderPath = buildConversationFolderPath(
            "Nexus/Conversations",
            1741982400, // 2025-03-15T12:00:00Z
            "perplexity",
            "provider-year-month"
        );

        expect(folderPath).toBe("Nexus/Conversations/perplexity/2025/03");
    });

    it("should parse year/month from unix time", () => {
        const parts = getConversationPathParts(1705312800, "claude"); // 2024-01-15T12:00:00Z
        expect(parts).toEqual({
            provider: "claude",
            year: "2024",
            month: "01",
        });
    });
});
