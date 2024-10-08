// utils/validation-utils.ts

import { ChatMessage, CustomError } from "../types";
import { Logger } from "./logger";
import { requestUrl } from "obsidian";

const logger = new Logger();

export function isValidMessage(message: ChatMessage): boolean {
    return (
        message &&
        typeof message === "object" &&
        typeof message.id === "string" && // Check for id
        message.author && // Check for author
        typeof message.author === "object" &&
        typeof message.author.role === "string" && // Check role
        message.content && // Check for content
        typeof message.content === "object" &&
        typeof message.content.content_type === "string" && // Check content type
        Array.isArray(message.content.parts) &&
        message.content.parts.length > 0 &&
        message.content.parts.some(
            (part) => typeof part === "string" && part.trim() !== ""
        )
    );
}

export function isCustomError(error: any): error is CustomError {
    return error && typeof error.message === "string"; // Check if error has a 'message' property
}

export async function checkConversationLink(
    conversationId: string
): Promise<boolean> {
    const url = `https://chatgpt.com/c/${conversationId}`;
    try {
        const response = await requestUrl({
            url: url,
            method: "HEAD",
        });

        return response.status >= 200 && response.status < 300; // Returns true for status codes 200-299
    } catch (error) {
        logger.error(`Error fetching ${url}:`, error);
        return false; // Return false in case of error (e.g., network issues)
    }
}
