import { AttachmentLookupIndex, ZipEntryMeta } from "./types";

function push(map: Map<string, string[]>, key: string, value: string): void {
    if (!key) return;
    const current = map.get(key);
    if (current) {
        if (!current.includes(value)) current.push(value);
        return;
    }

    map.set(key, [value]);
}

function extractFileIds(path: string): string[] {
    const ids: string[] = [];
    const fileName = path.split("/").pop() || path;

    const legacyMatch = fileName.match(/file_([a-f0-9]+)/i);
    if (legacyMatch) {
        ids.push(`file_${legacyMatch[1]}`);
        ids.push(legacyMatch[1]);
    }

    const modernMatch = fileName.match(/^(file-[A-Za-z0-9]+)-/);
    if (modernMatch) {
        ids.push(modernMatch[1]);
        ids.push(modernMatch[1].substring(5));
    }

    const hashMatch = fileName.match(/^([a-f0-9]{32,})(?:[-.]|$)/i);
    if (hashMatch && !legacyMatch) {
        ids.push(hashMatch[1]);
    }

    const baseName = fileName.replace(/\.(dat|png|jpg|jpeg|gif|webp|pdf|txt|md)$/i, "");
    if (baseName) ids.push(baseName);

    return Array.from(new Set(ids.filter(Boolean)));
}

export function buildAttachmentLookupIndex(entries: ZipEntryMeta[]): AttachmentLookupIndex {
    const index: AttachmentLookupIndex = {
        byExactPath: new Map(),
        byBaseName: new Map(),
        byFileId: new Map(),
        byDalleId: new Map(),
    };

    for (const entry of entries) {
        index.byExactPath.set(entry.path, entry.path);

        const baseName = entry.path.split("/").pop() || entry.path;
        push(index.byBaseName, baseName, entry.path);

        for (const fileId of extractFileIds(entry.path)) {
            push(index.byFileId, fileId, entry.path);
        }

        if (entry.path.toLowerCase().includes("dalle")) {
            for (const fileId of extractFileIds(entry.path)) {
                push(index.byDalleId, fileId, entry.path);
            }
        }
    }

    return index;
}
