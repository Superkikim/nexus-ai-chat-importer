/**
 * Nexus AI Chat Importer - Obsidian Plugin
 * Copyright (C) 2024 Akim Sissaoui
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * zip-loader.ts
 *
 * Memory-safe ZIP loading that replaces JSZip.loadAsync() for large archives.
 *
 * On Electron desktop (where File.path is available), yauzl opens the ZIP by
 * file path, reads only the central directory index (~KB), then streams entries
 * one by one. An optional `shouldInclude` predicate (provided by the caller)
 * controls which entries are extracted; entries that don't pass are skipped
 * entirely, keeping heap usage proportional to kept content only.
 *
 * On mobile / browser (no File.path), we fall back silently to JSZip.loadAsync.
 */

import JSZip from "jszip";

// ── yauzl promisification helpers ────────────────────────────────────────────

/**
 * Collect all chunks from a readable stream into a single Buffer.
 */
function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        stream.on("data", (chunk: Buffer | string) => {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string));
        });
        stream.on("end", () => resolve(Buffer.concat(chunks)));
        stream.on("error", reject);
    });
}

/**
 * Open a ZIP file via yauzl using lazy entry enumeration.
 * require() is used because yauzl has no ESM build.
 */
function openYauzl(filePath: string): Promise<any> {
    return new Promise((resolve, reject) => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const yauzl = require("yauzl");
        yauzl.open(filePath, { lazyEntries: true, autoClose: false }, (err: Error | null, zipfile: any) => {
            if (err) reject(err);
            else resolve(zipfile);
        });
    });
}

/**
 * Open a read-stream for a single yauzl entry.
 * yauzl automatically decompresses the entry content.
 */
function openEntryStream(zipfile: any, entry: any): Promise<NodeJS.ReadableStream> {
    return new Promise((resolve, reject) => {
        zipfile.openReadStream(entry, (err: Error | null, stream: NodeJS.ReadableStream) => {
            if (err) reject(err);
            else resolve(stream);
        });
    });
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Load a ZIP file into a JSZip instance, optionally skipping entries via a
 * caller-provided predicate.
 *
 * On Electron desktop (File.path available): uses yauzl streaming — only the
 * central directory and selected entries are read from disk.
 * On mobile/browser (no File.path): falls back to JSZip.loadAsync (unchanged).
 *
 * The returned JSZip instance is API-compatible with what JSZip.loadAsync
 * would have returned. Callers that use zip.files, zip.file(name), and
 * zipFile.async("string"|"uint8array"|"arraybuffer") all continue to work.
 *
 * @param file           The File object selected by the user.
 * @param shouldInclude  Optional predicate — return false to skip an entry.
 *                       If omitted, all entries are extracted.
 * @returns              A populated JSZip instance (partial on Electron when
 *                       shouldInclude skips entries, full on fallback).
 */
export async function loadZipSelective(
    file: File,
    shouldInclude?: (entryName: string, uncompressedSize: number) => boolean
): Promise<JSZip> {
    const filePath: string | undefined = (file as any).path;

    // Fallback: mobile / browser / no path available
    if (!filePath) {
        const zip = new JSZip();
        return zip.loadAsync(file);
    }

    // Desktop: yauzl streaming with optional selective extraction
    const resultZip = new JSZip();

    let zipfile: any;
    try {
        zipfile = await openYauzl(filePath);
    } catch {
        // yauzl failed to open — let JSZip try so caller gets a proper error message
        const zip = new JSZip();
        return zip.loadAsync(file);
    }

    await new Promise<void>((resolve, reject) => {
        zipfile.on("error", (err: Error) => {
            zipfile.close();
            reject(err);
        });

        zipfile.on("end", () => {
            zipfile.close();
            resolve();
        });

        zipfile.on("entry", async (entry: any) => {
            try {
                // Apply caller-provided filter (if any)
                if (shouldInclude && !shouldInclude(entry.fileName, entry.uncompressedSize)) {
                    zipfile.readEntry();
                    return;
                }

                if (entry.fileName.endsWith("/")) {
                    // Directory entry — register folder and continue
                    resultZip.folder(entry.fileName.slice(0, -1));
                    zipfile.readEntry();
                    return;
                }

                const stream = await openEntryStream(zipfile, entry);
                const buffer = await streamToBuffer(stream);

                resultZip.file(entry.fileName, buffer, {
                    date: entry.getLastModDate ? entry.getLastModDate() : new Date(),
                });

                zipfile.readEntry();
            } catch (entryErr) {
                // A single bad entry must not abort the whole import
                console.warn(
                    `[zip-loader] Skipping entry "${entry.fileName}": ${entryErr}`
                );
                zipfile.readEntry();
            }
        });

        // Kick off enumeration
        zipfile.readEntry();
    });

    return resultZip;
}

/**
 * Enumerate all entries in a ZIP file without extracting any content.
 * Returns an array of { path, size } for every non-directory entry.
 *
 * Used by AttachmentMapBuilder which only needs file names and sizes to build
 * the cross-ZIP attachment index — it never reads file content at this stage.
 *
 * On Electron desktop: uses yauzl (reads central directory only, ~zero RAM).
 * On mobile/browser: falls back to JSZip.loadAsync + Object.keys().
 *
 * @param file  The File object selected by the user.
 * @returns     Array of { path: string, size: number } — size is uncompressed bytes.
 */
export async function enumerateZipEntries(
    file: File
): Promise<Array<{ path: string; size: number }>> {
    const filePath: string | undefined = (file as any).path;

    // Fallback: mobile / browser
    if (!filePath) {
        const zip = new JSZip();
        const content = await zip.loadAsync(file);
        return Object.entries(content.files)
            .filter(([, f]) => !f.dir)
            .map(([path, f]) => ({
                path,
                size: (f as any)._data?.uncompressedSize ?? 0,
            }));
    }

    // Desktop: yauzl enumeration — no extraction, no content in RAM
    const entries: Array<{ path: string; size: number }> = [];

    let zipfile: any;
    try {
        zipfile = await openYauzl(filePath);
    } catch {
        // Fallback if yauzl fails
        const zip = new JSZip();
        const content = await zip.loadAsync(file);
        return Object.entries(content.files)
            .filter(([, f]) => !f.dir)
            .map(([path, f]) => ({
                path,
                size: (f as any)._data?.uncompressedSize ?? 0,
            }));
    }

    await new Promise<void>((resolve, reject) => {
        zipfile.on("error", (err: Error) => {
            zipfile.close();
            reject(err);
        });

        zipfile.on("end", () => {
            zipfile.close();
            resolve();
        });

        zipfile.on("entry", (entry: any) => {
            if (!entry.fileName.endsWith("/")) {
                entries.push({
                    path: entry.fileName,
                    size: entry.uncompressedSize,
                });
            }
            // Never open a read stream — just record metadata and move on
            zipfile.readEntry();
        });

        zipfile.readEntry();
    });

    return entries;
}
