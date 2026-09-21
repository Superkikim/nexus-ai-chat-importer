import { MistralVibeConversation } from "./vibe-types";
import { truncateTitlePreview } from "../../utils/title-preview";

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
    return truncateTitlePreview(content);
}
