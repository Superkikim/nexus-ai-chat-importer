import { describe, expect, it } from "vitest";
import {
    deriveMistralVibeConversationTitle,
    LECHAT_VISIBLE_TITLE_MAX_CHARS,
} from "./vibe-title";
import { MistralVibeConversation } from "./vibe-types";

describe("Le Chat title helper", () => {
    it("truncates title to 50 chars with ellipsis", () => {
        const chat: MistralVibeConversation = [
            {
                id: "m1",
                version: 0,
                chatId: "chat-1",
                role: "user",
                content:
                    "This is a very long message that should be truncated to fifty characters maximum",
                contentChunks: null,
                createdAt: "2025-09-19T16:18:19.236Z",
                reaction: "neutral",
                reactionDetail: null,
                reactionComment: null,
                preference: null,
                preferenceOver: null,
                context: null,
                canvas: [],
                quotes: [],
                files: [],
            },
        ];

        const title = deriveMistralVibeConversationTitle(chat);
        expect(title).toBe(
            "This is a very long message that should be truncat..."
        );
        expect(title.length).toBeLessThanOrEqual(
            LECHAT_VISIBLE_TITLE_MAX_CHARS + 3
        );
    });

    it("derives title from first chronological user message", () => {
        const chat: MistralVibeConversation = [
            {
                id: "m2",
                version: 0,
                chatId: "chat-1",
                role: "user",
                content: "Second question",
                contentChunks: null,
                createdAt: "2025-09-19T16:18:20.236Z",
                reaction: "neutral",
                reactionDetail: null,
                reactionComment: null,
                preference: null,
                preferenceOver: null,
                context: null,
                canvas: [],
                quotes: [],
                files: [],
            },
            {
                id: "m1",
                version: 0,
                chatId: "chat-1",
                role: "user",
                content: "First question",
                contentChunks: null,
                createdAt: "2025-09-19T16:18:19.236Z",
                reaction: "neutral",
                reactionDetail: null,
                reactionComment: null,
                preference: null,
                preferenceOver: null,
                context: null,
                canvas: [],
                quotes: [],
                files: [],
            },
        ];

        expect(deriveMistralVibeConversationTitle(chat)).toBe("First question");
    });
});
