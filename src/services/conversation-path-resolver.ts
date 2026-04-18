import type { ConversationHierarchyOrder } from "../types/plugin";

export interface ConversationPathParts {
    provider: string;
    year: string;
    month: string;
}

export function getConversationPathParts(createTimeUnixSeconds: number, provider: string): ConversationPathParts {
    const date = new Date(createTimeUnixSeconds * 1000);
    const year = String(date.getFullYear());
    const month = String(date.getMonth() + 1).padStart(2, "0");

    return {
        provider,
        year,
        month,
    };
}

export function buildConversationRelativeFolder(
    parts: ConversationPathParts,
    hierarchyOrder: ConversationHierarchyOrder
): string {
    if (hierarchyOrder === "year-month-provider") {
        return `${parts.year}/${parts.month}/${parts.provider}`;
    }

    return `${parts.provider}/${parts.year}/${parts.month}`;
}

export function buildConversationFolderPath(
    baseConversationFolder: string,
    createTimeUnixSeconds: number,
    provider: string,
    hierarchyOrder: ConversationHierarchyOrder
): string {
    const parts = getConversationPathParts(createTimeUnixSeconds, provider);
    const relativeFolder = buildConversationRelativeFolder(parts, hierarchyOrder);
    return `${baseConversationFolder}/${relativeFolder}`;
}
