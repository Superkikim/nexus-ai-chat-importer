import { ClaudeContentBlock, ClaudeMessage } from "./claude-types";

function hasNonEmptyString(value: unknown): boolean {
    return typeof value === "string" && value.trim().length > 0;
}

function hasExportableContentBlock(block: ClaudeContentBlock): boolean {
    if (!block) {
        return false;
    }

    if (block.type === "text") {
        return hasNonEmptyString(block.text);
    }

    if (block.type !== "tool_use") {
        return false;
    }

    if (block.name === "artifacts") {
        const command = block.input?.command || "create";
        return (
            command !== "view" &&
            hasNonEmptyString(block.input?.version_uuid) &&
            (hasNonEmptyString(block.input?.content) ||
                hasNonEmptyString(block.input?.file_text) ||
                hasNonEmptyString(block.input?.code))
        );
    }

    if (block.name === "create_file") {
        const fileText = block.input?.file_text;
        return (
            hasNonEmptyString(block.input?.path) &&
            typeof fileText === "string" &&
            fileText.trim().length > 0 &&
            fileText.length >= 200
        );
    }

    if (block.name === "str_replace") {
        return (
            hasNonEmptyString(block.input?.path) &&
            (hasNonEmptyString(block.input?.new_str) ||
                hasNonEmptyString(block.input?.content))
        );
    }

    return false;
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

    if (
        Array.isArray(message.content) &&
        message.content.some((block) => hasExportableContentBlock(block))
    ) {
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
