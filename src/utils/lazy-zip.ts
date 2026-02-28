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
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */


// src/utils/lazy-zip.ts

import { ZipEntry, decompressZipEntry } from "./zip-loader";

/**
 * JSZip-compatible object that decompresses its content on demand via File.slice.
 *
 * Mimics the JSZipObject interface used by attachment extractors:
 *   - zipObj.async("uint8array") → Promise<Uint8Array>
 *   - zipObj.async("string")     → Promise<string>
 *   - zipObj.async("base64")     → Promise<string>
 *   - zipObj.name                → string
 *   - zipObj.dir                 → boolean
 *
 * No content is read from disk until `async()` is called.
 * After the returned Promise resolves and the caller drops the reference,
 * the Uint8Array is eligible for GC — keeping peak RAM to ~1 entry at a time.
 */
export class LazyZipObject {
    readonly name: string;
    readonly dir: boolean;
    private readonly _file: File;
    private readonly _entry: ZipEntry;

    constructor(file: File, entry: ZipEntry) {
        this._file = file;
        this._entry = entry;
        this.name = entry.name;
        this.dir = entry.name.endsWith("/");
    }

    /**
     * Decompress the entry and return its content in the requested format.
     * Each call re-decompresses from the source File — no caching.
     */
    async async(type: "uint8array"): Promise<Uint8Array>;
    async async(type: "string"): Promise<string>;
    async async(type: "base64"): Promise<string>;
    async async(type: string): Promise<Uint8Array | string> {
        const data = await decompressZipEntry(this._file, this._entry);

        if (type === "uint8array") return data;

        if (type === "string") {
            return new TextDecoder("utf-8").decode(data);
        }

        if (type === "base64") {
            // Convert Uint8Array → base64 in chunks to avoid call-stack overflow
            // on large files (String.fromCharCode spread on 50MB+ arrays can throw).
            const CHUNK = 8192;
            let binary = "";
            for (let i = 0; i < data.byteLength; i += CHUNK) {
                binary += String.fromCharCode(
                    ...data.subarray(i, Math.min(i + CHUNK, data.byteLength))
                );
            }
            return btoa(binary);
        }

        throw new Error(`[LazyZip] Unsupported output type: "${type}"`);
    }
}

/**
 * JSZip-compatible container backed by a File's Central Directory.
 *
 * Implements the subset of the JSZip API used by attachment extractors:
 *   - lazyZip.files                  → { [name: string]: LazyZipObject }
 *   - lazyZip.file(name)             → LazyZipObject | null
 *
 * Constructing a LazyZip reads ZERO bytes of entry content — only the
 * Central Directory metadata (already parsed by enumerateZipEntriesRaw)
 * is stored. Content is decompressed entry-by-entry on first access.
 *
 * Usage in import-service.ts:
 *   const entries = await enumerateZipEntriesRaw(file, mobileFilter);
 *   const zip = new LazyZip(file, entries) as unknown as JSZip;
 *   // Pass zip to processConversations() — all downstream code is unaffected.
 */
export class LazyZip {
    readonly files: { [name: string]: LazyZipObject } = {};

    constructor(sourceFile: File, entries: ZipEntry[]) {
        for (const entry of entries) {
            this.files[entry.name] = new LazyZipObject(sourceFile, entry);
        }
    }

    /**
     * Look up an entry by name, matching JSZip's `zip.file(name)` API.
     * Returns null (not undefined) when not found, so callers using
     * `if (!zip.file(name))` continue to work correctly.
     */
    file(name: string): LazyZipObject | null {
        return this.files[name] ?? null;
    }
}
