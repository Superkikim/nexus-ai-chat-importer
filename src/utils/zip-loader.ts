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
 * Memory-safe ZIP loading for both desktop and mobile.
 *
 * DESKTOP (Electron — File.path available)
 *   Uses yauzl to open the ZIP by file path. Only the central directory
 *   index is read upfront (~KB). Entries are streamed one by one; a caller-
 *   provided `shouldInclude` predicate can skip entries entirely so that
 *   large unwanted files (voice recordings, videos) never touch the heap.
 *
 * MOBILE / BROWSER (no File.path)
 *   Uses the standard Web File API (File.slice / Blob.arrayBuffer) for
 *   random-access reads. The ZIP central directory is located by scanning
 *   the tail of the file, then individual entries are extracted on demand
 *   using DecompressionStream('deflate-raw'). Large skipped entries are
 *   never read from disk at all — peak RAM is proportional to kept content.
 *
 *   Graceful fallback to JSZip.loadAsync when:
 *     • The archive uses ZIP64 extensions (offsets > 4 GB, >65535 entries)
 *     • DecompressionStream is unavailable (very old WebView)
 *
 * Both paths return a standard JSZip instance so callers are unaffected.
 */

import JSZip from "jszip";

// DecompressionStream is a Web API added to TypeScript lib.dom.d.ts in TS 4.8.
// This project targets TypeScript 4.7.4, so we declare it locally.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare class DecompressionStream {
    readonly readable: ReadableStream<Uint8Array>;
    readonly writable: WritableStream<BufferSource>;
    constructor(format: "deflate" | "deflate-raw" | "gzip");
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared internal types
// ─────────────────────────────────────────────────────────────────────────────

/** Metadata parsed from a ZIP Central Directory entry. */
interface CentralDirEntry {
    name: string;
    compressionMethod: number; // 0 = stored, 8 = deflate
    compressedSize: number;
    uncompressedSize: number;
    localHeaderOffset: number;
}

/**
 * Public alias for CentralDirEntry.
 * Used by LazyZip to hold entry metadata without decompressing content.
 */
export type ZipEntry = CentralDirEntry;

// ─────────────────────────────────────────────────────────────────────────────
// Desktop helpers (yauzl)
// ─────────────────────────────────────────────────────────────────────────────

/** Collect all chunks from a readable stream into a single Buffer. */
function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        stream.on("data", (chunk: Buffer | string) => {
            chunks.push(
                Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string)
            );
        });
        stream.on("end", () =>
            resolve(Buffer.concat(chunks as unknown as Uint8Array[]))
        );
        stream.on("error", reject);
    });
}

/** Open a ZIP file via yauzl using lazy entry enumeration. */
function openYauzl(filePath: string): Promise<any> {
    return new Promise((resolve, reject) => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const yauzl = require("yauzl");
        yauzl.open(
            filePath,
            { lazyEntries: true, autoClose: false },
            (err: Error | null, zipfile: any) => {
                if (err) reject(err);
                else resolve(zipfile);
            }
        );
    });
}

/** Open a read-stream for a single yauzl entry. */
function openEntryStream(
    zipfile: any,
    entry: any
): Promise<NodeJS.ReadableStream> {
    return new Promise((resolve, reject) => {
        zipfile.openReadStream(
            entry,
            (err: Error | null, stream: NodeJS.ReadableStream) => {
                if (err) reject(err);
                else resolve(stream);
            }
        );
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Mobile helpers (File.slice / Web API)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Read a byte range from a File without loading the whole file.
 *
 * Uses FileReader instead of Blob.arrayBuffer() because FileReader is the
 * older, more widely supported API — Blob.arrayBuffer() can silently stall
 * in Obsidian's WKWebView (iOS) context and never resolve its Promise.
 */
function readSlice(
    file: File,
    start: number,
    length: number
): Promise<ArrayBuffer> {
    if (length <= 0) return Promise.resolve(new ArrayBuffer(0));
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () =>
            reject(reader.error ?? new Error("[zip-loader] FileReader error"));
        reader.readAsArrayBuffer(file.slice(start, start + length));
    });
}

/**
 * Locate and parse the ZIP End of Central Directory record.
 *
 * Returns null (triggering JSZip fallback) when:
 *  - The EOCD signature is not found (not a valid ZIP)
 *  - cdOffset === 0xFFFFFFFF — ZIP64 format (files > 4 GB or > 65535 entries)
 */
async function findEOCD(
    file: File
): Promise<{ cdOffset: number; cdSize: number; entryCount: number } | null> {
    // EOCD minimum size is 22 bytes; ZIP comment can be up to 65535 bytes.
    const searchSize = Math.min(65557, file.size);
    const buffer = await readSlice(file, file.size - searchSize, searchSize);
    const view = new DataView(buffer);

    // Scan backward for signature 0x06054b50
    for (let i = buffer.byteLength - 22; i >= 0; i--) {
        if (view.getUint32(i, true) !== 0x06054b50) continue;

        const entryCount = view.getUint16(i + 10, true);
        const cdSize = view.getUint32(i + 12, true);
        const cdOffset = view.getUint32(i + 16, true);

        // ZIP64 sentinel — we don't parse ZIP64 EOCD, fall back to JSZip
        if (
            cdOffset === 0xffffffff ||
            entryCount === 0xffff ||
            cdSize === 0xffffffff
        ) {
            return null;
        }

        return { cdOffset, cdSize, entryCount };
    }

    return null; // Not a ZIP or signature not found
}

/**
 * Parse all entries in the ZIP Central Directory.
 * Each entry header is 46 bytes + variable-length name / extra / comment.
 * ZIP64 extra fields (header ID 0x0001) are handled for large file support.
 */
async function parseCentralDirectory(
    file: File,
    cdOffset: number,
    cdSize: number
): Promise<CentralDirEntry[]> {
    const buffer = await readSlice(file, cdOffset, cdSize);
    const view = new DataView(buffer);
    const decoder = new TextDecoder("utf-8");
    const entries: CentralDirEntry[] = [];
    let pos = 0;

    while (pos + 46 <= buffer.byteLength) {
        if (view.getUint32(pos, true) !== 0x02014b50) break; // Central dir signature

        const compressionMethod = view.getUint16(pos + 10, true);
        const compressedSize32 = view.getUint32(pos + 20, true);
        const uncompressedSize32 = view.getUint32(pos + 24, true);
        const nameLength = view.getUint16(pos + 28, true);
        const extraLength = view.getUint16(pos + 30, true);
        const commentLength = view.getUint16(pos + 32, true);
        const localHeaderOffset32 = view.getUint32(pos + 42, true);

        const nameBytes = new Uint8Array(buffer, pos + 46, nameLength);
        const name = decoder.decode(nameBytes);

        // Resolve ZIP64 extra fields when 32-bit fields contain sentinel 0xFFFFFFFF
        let compressedSize = compressedSize32;
        let uncompressedSize = uncompressedSize32;
        let localHeaderOffset = localHeaderOffset32;

        if (extraLength > 0) {
            const extraStart = pos + 46 + nameLength;
            let extraPos = 0;
            while (extraPos + 4 <= extraLength) {
                const headerId = view.getUint16(extraStart + extraPos, true);
                const dataSize = view.getUint16(
                    extraStart + extraPos + 2,
                    true
                );
                if (headerId === 0x0001 && dataSize >= 8) {
                    // ZIP64 extended information — fields present only when sentinel
                    let z64Pos = extraStart + extraPos + 4;
                    if (
                        uncompressedSize32 === 0xffffffff &&
                        z64Pos + 8 <= extraStart + extraPos + 4 + dataSize
                    ) {
                        uncompressedSize = Number(
                            view.getBigUint64(z64Pos, true)
                        );
                        z64Pos += 8;
                    }
                    if (
                        compressedSize32 === 0xffffffff &&
                        z64Pos + 8 <= extraStart + extraPos + 4 + dataSize
                    ) {
                        compressedSize = Number(
                            view.getBigUint64(z64Pos, true)
                        );
                        z64Pos += 8;
                    }
                    if (
                        localHeaderOffset32 === 0xffffffff &&
                        z64Pos + 8 <= extraStart + extraPos + 4 + dataSize
                    ) {
                        localHeaderOffset = Number(
                            view.getBigUint64(z64Pos, true)
                        );
                    }
                }
                extraPos += 4 + dataSize;
            }
        }

        // Directory entries have no content to extract
        if (!name.endsWith("/")) {
            entries.push({
                name,
                compressionMethod,
                compressedSize,
                uncompressedSize,
                localHeaderOffset,
            });
        }

        pos += 46 + nameLength + extraLength + commentLength;
    }

    return entries;
}

/**
 * Decompress a single ZIP entry using the Web DecompressionStream API.
 * Throws if DecompressionStream is unavailable or compression method is unsupported.
 */
async function decompressEntry(
    file: File,
    entry: CentralDirEntry
): Promise<Uint8Array> {
    if (entry.compressedSize === 0) return new Uint8Array(0);

    // eslint-disable-next-line no-console
    console.log(`[NexusAI][${new Date().toISOString().slice(11,23)}] [decompressEntry] "${entry.name}" compressed=${entry.compressedSize} uncompressed=${entry.uncompressedSize}`);

    // Read local file header to find the exact data start offset.
    // Local header: 30 bytes fixed + nameLen + extraLen (may differ from CD extra).
    const localHeader = await readSlice(file, entry.localHeaderOffset, 30);
    const localView = new DataView(localHeader);

    if (localView.getUint32(0, true) !== 0x04034b50) {
        throw new Error(
            `[zip-loader] Invalid local file header for "${entry.name}"`
        );
    }

    const localNameLen = localView.getUint16(26, true);
    const localExtraLen = localView.getUint16(28, true);
    const dataOffset =
        entry.localHeaderOffset + 30 + localNameLen + localExtraLen;

    const compressedData = await readSlice(
        file,
        dataOffset,
        entry.compressedSize
    );

    // Compression method 0: stored — return as-is
    if (entry.compressionMethod === 0) {
        return new Uint8Array(compressedData);
    }

    // Compression method 8: deflate — requires DecompressionStream
    if (entry.compressionMethod === 8) {
        if (typeof DecompressionStream === "undefined") {
            throw new Error("[zip-loader] DecompressionStream unavailable");
        }

        const ds = new DecompressionStream("deflate-raw");
        const chunks: Uint8Array[] = [];

        // Use pipeTo so write and read happen concurrently.
        // Awaiting writer.write() before reader.read() causes a permanent
        // deadlock on iOS: the stream stalls when its output buffer fills up
        // and the writer never resolves because no one is draining the reader.
        await new ReadableStream<Uint8Array>({
            start(controller) {
                controller.enqueue(new Uint8Array(compressedData));
                controller.close();
            }
        }).pipeThrough(ds as unknown as TransformStream<Uint8Array, Uint8Array>).pipeTo(
            new WritableStream<Uint8Array>({
                write(chunk) {
                    chunks.push(chunk);
                }
            })
        );

        // Assemble into a single Uint8Array
        const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
        const result = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of chunks) {
            result.set(chunk, offset);
            offset += chunk.length;
        }
        // eslint-disable-next-line no-console
        console.log(`[NexusAI][${new Date().toISOString().slice(11,23)}] [decompressEntry] done "${entry.name}" → ${result.byteLength} bytes`);
        return result;
    }

    throw new Error(
        `[zip-loader] Unsupported compression method ${entry.compressionMethod} for "${entry.name}"`
    );
}

/**
 * Mobile-safe selective ZIP loader using File.slice random access.
 *
 * Memory profile: O(kept content) — skipped entries are never read from disk.
 * Throws when ZIP64 is detected or DecompressionStream is unavailable,
 * so the caller can fall back to JSZip.loadAsync.
 */
async function loadZipSelectiveMobile(
    file: File,
    shouldInclude?: (entryName: string, uncompressedSize: number) => boolean
): Promise<JSZip> {
    // eslint-disable-next-line no-console
    console.log(`[NexusAI][${new Date().toISOString().slice(11,23)}] loadZipSelectiveMobile: findEOCD start (${file.size} bytes)`);
    const eocd = await findEOCD(file);
    if (!eocd)
        throw new Error(
            "[zip-loader] ZIP64 or invalid ZIP — using JSZip fallback"
        );
    // eslint-disable-next-line no-console
    console.log(`[NexusAI][${new Date().toISOString().slice(11,23)}] loadZipSelectiveMobile: EOCD found — cdOffset=${eocd.cdOffset} cdSize=${eocd.cdSize} entries=${eocd.entryCount}`);

    const entries = await parseCentralDirectory(
        file,
        eocd.cdOffset,
        eocd.cdSize
    );
    // eslint-disable-next-line no-console
    console.log(`[NexusAI][${new Date().toISOString().slice(11,23)}] loadZipSelectiveMobile: CD parsed — ${entries.length} non-dir entries`);

    const resultZip = new JSZip();
    let included = 0;
    let skipped = 0;

    for (const entry of entries) {
        if (
            shouldInclude &&
            !shouldInclude(entry.name, entry.uncompressedSize)
        ) {
            skipped++;
            continue; // Skip — zero bytes read from disk for this entry
        }
        included++;
        // eslint-disable-next-line no-console
        console.log(`[NexusAI][${new Date().toISOString().slice(11,23)}] decompressEntry: "${entry.name}" compressed=${entry.compressedSize} uncompressed=${entry.uncompressedSize}`);
        const data = await decompressEntry(file, entry);
        // eslint-disable-next-line no-console
        console.log(`[NexusAI][${new Date().toISOString().slice(11,23)}] decompressEntry: "${entry.name}" done — ${data.byteLength} bytes`);
        resultZip.file(entry.name, data);
    }

    // eslint-disable-next-line no-console
    console.log(`[NexusAI][${new Date().toISOString().slice(11,23)}] loadZipSelectiveMobile: done — included=${included} skipped=${skipped}`);
    return resultZip;
}

/**
 * Mobile-safe ZIP entry enumeration using File.slice random access.
 *
 * Reads only the EOCD record and Central Directory — no entry content is
 * decompressed, making this extremely cheap even for multi-gigabyte archives.
 *
 * Throws when ZIP64 is detected so the caller can fall back to JSZip.loadAsync.
 */
async function enumerateZipEntriesMobile(
    file: File
): Promise<Array<{ path: string; size: number }>> {
    const eocd = await findEOCD(file);
    if (!eocd)
        throw new Error(
            "[zip-loader] ZIP64 or invalid ZIP — using JSZip fallback"
        );

    const entries = await parseCentralDirectory(
        file,
        eocd.cdOffset,
        eocd.cdSize
    );
    return entries.map((e) => ({ path: e.name, size: e.uncompressedSize }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Load a ZIP file into a JSZip instance, optionally skipping entries via a
 * caller-provided predicate.
 *
 * On Electron desktop (File.path available): uses yauzl streaming — only the
 * central directory and selected entries are read from disk.
 *
 * On mobile/browser (no File.path): uses File.slice random access — only the
 * central directory and kept entries are read from disk. The shouldInclude
 * filter is always respected, keeping peak RAM proportional to kept content.
 * Falls back to JSZip.loadAsync when ZIP64 format is detected or
 * DecompressionStream is unavailable (legacy WebView).
 *
 * The returned JSZip instance is API-compatible with what JSZip.loadAsync
 * would have returned. Callers using zip.files, zip.file(name), and
 * file.async("string"|"uint8array"|"arraybuffer") all continue to work.
 *
 * @param file           The File object selected by the user.
 * @param shouldInclude  Optional predicate — return false to skip an entry.
 *                       Receives (entryName, uncompressedSizeBytes).
 *                       If omitted, all entries are extracted.
 * @returns              A populated JSZip instance.
 */
export async function loadZipSelective(
    file: File,
    shouldInclude?: (entryName: string, uncompressedSize: number) => boolean
): Promise<JSZip> {
    const filePath: string | undefined = (file as any).path;

    // Mobile / browser path — always use File.slice selective loader.
    // JSZip.loadAsync(file) ignores the shouldInclude filter and loads all
    // entries into memory, defeating memory-safety regardless of archive size.
    // File.slice respects the filter so peak RAM is proportional to kept content.
    if (!filePath) {
        try {
            return await loadZipSelectiveMobile(file, shouldInclude);
        } catch (mobileErr) {
            // ZIP64 or DecompressionStream unavailable — fall back to JSZip (pre-1.5.6 behaviour)
            // eslint-disable-next-line no-console
            console.error(`[NexusAI] loadZipSelectiveMobile failed, falling back to JSZip:`, mobileErr);
            const zip = new JSZip();
            return zip.loadAsync(file);
        }
    }

    // Desktop path — yauzl streaming with optional selective extraction
    const resultZip = new JSZip();

    let zipfile: any;
    try {
        zipfile = await openYauzl(filePath);
    } catch {
        // yauzl failed — let JSZip try so the caller gets a meaningful error
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
                if (
                    shouldInclude &&
                    !shouldInclude(entry.fileName, entry.uncompressedSize)
                ) {
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

                resultZip.file(entry.fileName, new Uint8Array(buffer), {
                    date: entry.getLastModDate
                        ? entry.getLastModDate()
                        : new Date(),
                });

                zipfile.readEntry();
            } catch (entryErr) {
                // A single bad entry must not abort the whole import
                // eslint-disable-next-line no-console
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
 * On mobile/browser: uses File.slice to read EOCD + Central Directory only
 *   — no decompression, no content loaded, O(CD size) memory usage.
 *   Falls back to JSZip.loadAsync for ZIP64 archives.
 *
 * @param file  The File object selected by the user.
 * @returns     Array of { path: string, size: number } — size is uncompressed bytes.
 */
export async function enumerateZipEntries(
    file: File
): Promise<Array<{ path: string; size: number }>> {
    const filePath: string | undefined = (file as any).path;

    // Mobile / browser path — use File.slice (no extraction, no decompression)
    if (!filePath) {
        try {
            return await enumerateZipEntriesMobile(file);
        } catch {
            // ZIP64 or API unavailable — fall back to JSZip (pre-1.5.6 behaviour)
            const zip = new JSZip();
            const content = await zip.loadAsync(file);
            return Object.entries(content.files)
                .filter(([, f]) => !f.dir)
                .map(([path, f]) => ({
                    path,
                    size: (f as any)._data?.uncompressedSize ?? 0,
                }));
        }
    }

    // Desktop path — yauzl enumeration, no extraction, no content in RAM
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

/**
 * Enumerate ZIP entries with full Central Directory metadata (including offsets).
 *
 * Unlike `enumerateZipEntries` which returns only {path, size}, this function
 * returns the complete ZipEntry records needed by LazyZip to decompress entries
 * on demand via File.slice — without loading any content into memory upfront.
 *
 * Uses the File.slice path (mobile-compatible) regardless of platform.
 * Returns an empty array when ZIP64 format is detected (caller should fall back
 * to `loadZipSelective`).
 *
 * @param file    The File object selected by the user.
 * @param filter  Optional predicate — return false to exclude an entry from the result.
 *                Receives (entryName, uncompressedSizeBytes).
 * @returns       Array of ZipEntry (with localHeaderOffset) for non-directory entries
 *                matching the filter, or [] on ZIP64/parse failure.
 */
export async function enumerateZipEntriesRaw(
    file: File,
    filter?: (name: string, size: number) => boolean
): Promise<ZipEntry[]> {
    let eocd: { cdOffset: number; cdSize: number; entryCount: number } | null;
    try {
        eocd = await findEOCD(file);
    } catch {
        return [];
    }
    if (!eocd) return []; // ZIP64 sentinel or not a ZIP

    let all: CentralDirEntry[];
    try {
        all = await parseCentralDirectory(file, eocd.cdOffset, eocd.cdSize);
    } catch {
        return [];
    }

    const files = all.filter(e => !e.name.endsWith("/"));
    return filter ? files.filter(e => filter(e.name, e.uncompressedSize)) : files;
}

/**
 * Decompress a single ZIP entry from a File using File.slice random-access reads.
 *
 * This is the public counterpart of the private `decompressEntry` function.
 * Called by LazyZip when an entry's content is needed for the first time,
 * enabling on-demand decompression instead of loading all entries upfront.
 *
 * @param file   The original ZIP File object.
 * @param entry  The ZipEntry metadata (from enumerateZipEntriesRaw).
 * @returns      The decompressed entry content as a Uint8Array.
 */
export async function decompressZipEntry(
    file: File,
    entry: ZipEntry
): Promise<Uint8Array> {
    return decompressEntry(file, entry);
}
