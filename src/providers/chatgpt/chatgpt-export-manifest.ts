import {
    createZipArchiveReader,
    enumerateZipEntries,
} from "../../utils/zip-loader";

const MANIFEST = "export_manifest.json";

interface ExportManifest {
    export_files?: { path?: unknown }[];
}

/**
 * How many files the export's manifest lists that none of the selected
 * archives holds, or `null` when no archive carries a manifest.
 *
 * A multipart ChatGPT export lists every part's files in the first part's
 * manifest, so a missing part shows up here. Entries are listed unfiltered:
 * the adapter's entry filter drops large files and would report them missing.
 */
export async function countMissingExportFiles(
    files: File[]
): Promise<number | null> {
    const present = new Set<string>();
    let manifestSource: File | null = null;

    for (const file of files) {
        try {
            for (const entry of await enumerateZipEntries(file)) {
                present.add(entry.path);
                if (entry.path === MANIFEST && !manifestSource) {
                    manifestSource = file;
                }
            }
        } catch {
            // An unreadable archive is reported by the analysis.
        }
    }

    if (!manifestSource) return null;

    try {
        const reader = await createZipArchiveReader(manifestSource);
        const text = await reader.get(MANIFEST)?.readText();
        if (!text) return null;
        const listed = (JSON.parse(text) as ExportManifest).export_files ?? [];
        return listed.filter(
            (file) => typeof file.path === "string" && !present.has(file.path)
        ).length;
    } catch {
        return null;
    }
}
