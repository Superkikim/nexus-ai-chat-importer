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

// src/utils/attachment-target.ts

export interface AttachmentFileReader {
    exists(normalizedPath: string): Promise<boolean>;
    readBinary(normalizedPath: string): Promise<ArrayBuffer>;
}

function suffixPath(path: string, counter: number): string {
    const lastDot = path.lastIndexOf(".");
    if (lastDot === -1) return `${path}_${counter}`;
    return `${path.substring(0, lastDot)}_${counter}${path.substring(lastDot)}`;
}

async function holdsTheSameBytes(
    reader: AttachmentFileReader,
    path: string,
    bytes: Uint8Array
): Promise<boolean> {
    let existing: Uint8Array;
    try {
        existing = new Uint8Array(await reader.readBinary(path));
    } catch {
        // Unreadable for any reason: treat it as a different file and let the
        // caller take a free name rather than risk overwriting it.
        return false;
    }

    if (existing.byteLength !== bytes.byteLength) return false;
    for (let i = 0; i < existing.byteLength; i++) {
        if (existing[i] !== bytes[i]) return false;
    }
    return true;
}

/**
 * Where an attachment should be written, given what is already in the vault.
 *
 * A re-import extracts the same bytes again. Suffixing on the mere presence of
 * a file made every rebuild write `name_1.png` beside an identical `name.png`
 * and re-link the note to the copy, so the vault grew a duplicate per rebuild
 * and orphaned the original.
 *
 * The occupant decides instead:
 *   - nothing there — write it
 *   - the same bytes — reuse that path, the write is a no-op
 *   - different bytes — a genuinely different attachment claiming the name, so
 *     take the next free suffix and leave it alone
 *
 * Nothing that differs is ever overwritten, and the comparison is exact rather
 * than a guess from the name or the size.
 */
export async function resolveAttachmentTarget(
    reader: AttachmentFileReader,
    desiredPath: string,
    bytes: Uint8Array
): Promise<string> {
    let candidate = desiredPath;
    let counter = 1;

    while (await reader.exists(candidate)) {
        if (await holdsTheSameBytes(reader, candidate, bytes)) {
            return candidate;
        }
        candidate = suffixPath(desiredPath, counter);
        counter++;
    }

    return candidate;
}
