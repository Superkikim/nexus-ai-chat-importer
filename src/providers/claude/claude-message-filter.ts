import { ClaudeMessage } from "./claude-types";

function hasNonEmptyString(value: unknown): boolean {
    return typeof value === "string" && value.trim().length > 0;
}

export function isExportableClaudeMessage(message: ClaudeMessage): boolean {
    if (!message || !hasNonEmptyString(message.uuid)) {
        return false;
    }

    if (message.sender !== "human" && message.sender !== "assistant") {
        return false;
    }

    if (hasNonEmptyString(message.text)) {
        return true;
    }

    if (Array.isArray(message.content) && message.content.length > 0) {
        return true;
    }

    if (
        Array.isArray(message.attachments) &&
        message.attachments.some((attachment) =>
            hasNonEmptyString(attachment?.extracted_content)
        )
    ) {
        return true;
    }

    return (
        Array.isArray(message.files) &&
        message.files.some((file) => hasNonEmptyString(file?.file_name))
    );
}
