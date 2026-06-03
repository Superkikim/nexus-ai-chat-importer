import { MistralVibeConversation } from "./vibe-types";

export const VIBE_VISIBLE_TITLE_MAX_CHARS = 50;

export function truncateMistralVibeTitle(content: string): string {
    const trimmed = (content || "").trim();
    if (!trimmed) return "Untitled";
    if (trimmed.length <= VIBE_VISIBLE_TITLE_MAX_CHARS) return trimmed;
    return `${trimmed.substring(0, VIBE_VISIBLE_TITLE_MAX_CHARS).trim()}...`;
}

export function deriveMistralVibeConversationTitle(
    messages: MistralVibeConversation,
    options?: { assumeSorted?: boolean }
): string {
    if (!Array.isArray(messages) || messages.length === 0) {
        return "Untitled";
    }

    const source = options?.assumeSorted
        ? messages
        : [...messages].sort(
              (a, b) =>
                  new Date(a.createdAt).getTime() -
                  new Date(b.createdAt).getTime()
          );

    const firstUserMessage = source.find((msg) => msg.role === "user");
    const content = firstUserMessage?.content || "";
    return truncateMistralVibeTitle(content);
}
