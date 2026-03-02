export function sortFilesForImport(files: File[]): File[] {
    return [...files].sort((a, b) => {
        const timestampA = extractEmbeddedTimestamp(a.name);
        const timestampB = extractEmbeddedTimestamp(b.name);

        if (timestampA && timestampB) {
            return timestampA.localeCompare(timestampB);
        }

        if (timestampA) return -1;
        if (timestampB) return 1;

        if (a.lastModified !== b.lastModified) {
            return a.lastModified - b.lastModified;
        }

        return a.name.localeCompare(b.name);
    });
}

function extractEmbeddedTimestamp(fileName: string): string | null {
    const match = fileName.match(/(\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2})/);
    return match?.[1] ?? null;
}
