import { ZipArchiveReader, ZipEntryHandle, ZipEntryMeta } from "./types";

declare class DecompressionStream {
    readonly readable: ReadableStream<Uint8Array>;
    readonly writable: WritableStream<BufferSource>;
    constructor(format: "deflate" | "deflate-raw" | "gzip");
}

interface MobileZipEntryRecord extends ZipEntryMeta {
    compressionMethod: number;
    compressedSize: number;
    localHeaderOffset: number;
}

function readSlice(file: File, start: number, length: number): Promise<ArrayBuffer> {
    if (length <= 0) return Promise.resolve(new ArrayBuffer(0));

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => reject(reader.error ?? new Error("ZIP read failed"));
        reader.readAsArrayBuffer(file.slice(start, start + length));
    });
}

async function findEOCD(file: File): Promise<{ cdOffset: number; cdSize: number; entryCount: number } | null> {
    const searchSize = Math.min(65557, file.size);
    const buffer = await readSlice(file, file.size - searchSize, searchSize);
    const view = new DataView(buffer);

    for (let i = buffer.byteLength - 22; i >= 0; i--) {
        if (view.getUint32(i, true) !== 0x06054b50) continue;

        const entryCount = view.getUint16(i + 10, true);
        const cdSize = view.getUint32(i + 12, true);
        const cdOffset = view.getUint32(i + 16, true);

        if (entryCount === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) {
            return null;
        }

        return { cdOffset, cdSize, entryCount };
    }

    return null;
}

async function parseCentralDirectory(file: File, cdOffset: number, cdSize: number): Promise<MobileZipEntryRecord[]> {
    const buffer = await readSlice(file, cdOffset, cdSize);
    const view = new DataView(buffer);
    const decoder = new TextDecoder("utf-8");
    const entries: MobileZipEntryRecord[] = [];
    let pos = 0;

    while (pos + 46 <= buffer.byteLength) {
        if (view.getUint32(pos, true) !== 0x02014b50) break;

        const compressionMethod = view.getUint16(pos + 10, true);
        const compressedSize = view.getUint32(pos + 20, true);
        const uncompressedSize = view.getUint32(pos + 24, true);
        const nameLength = view.getUint16(pos + 28, true);
        const extraLength = view.getUint16(pos + 30, true);
        const commentLength = view.getUint16(pos + 32, true);
        const localHeaderOffset = view.getUint32(pos + 42, true);

        if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff || localHeaderOffset === 0xffffffff) {
            return [];
        }

        const nameBytes = new Uint8Array(buffer, pos + 46, nameLength);
        const name = decoder.decode(nameBytes);

        if (!name.endsWith("/")) {
            entries.push({
                path: name,
                size: uncompressedSize,
                compressionMethod,
                compressedSize,
                localHeaderOffset,
            });
        }

        pos += 46 + nameLength + extraLength + commentLength;
    }

    return entries;
}

async function readLocalFileData(file: File, entry: MobileZipEntryRecord): Promise<Uint8Array> {
    const localHeader = await readSlice(file, entry.localHeaderOffset, 30);
    const headerView = new DataView(localHeader);

    if (headerView.getUint32(0, true) !== 0x04034b50) {
        throw new Error(`Invalid local header for ${entry.path}`);
    }

    const fileNameLength = headerView.getUint16(26, true);
    const extraFieldLength = headerView.getUint16(28, true);
    const dataStart = entry.localHeaderOffset + 30 + fileNameLength + extraFieldLength;
    const compressed = new Uint8Array(await readSlice(file, dataStart, entry.compressedSize));

    if (entry.compressionMethod === 0) {
        return compressed;
    }

    if (entry.compressionMethod !== 8) {
        throw new Error(`Unsupported ZIP compression method ${entry.compressionMethod} for ${entry.path}`);
    }

    if (typeof DecompressionStream === "undefined") {
        throw new Error("DecompressionStream is unavailable on this device");
    }

    const result = new Uint8Array(entry.size);
    let offset = 0;

    await new Response(
        new Blob([compressed]).stream().pipeThrough(
            new DecompressionStream("deflate-raw") as unknown as TransformStream<Uint8Array, Uint8Array>
        )
    ).body!.pipeTo(new WritableStream<Uint8Array>({
        write(chunk) {
            result.set(chunk, offset);
            offset += chunk.length;
        }
    }));

    return result;
}

class MobileZipEntryHandle implements ZipEntryHandle {
    readonly name: string;

    constructor(private file: File, private entry: MobileZipEntryRecord) {
        this.name = entry.path;
    }

    async readBytes(): Promise<Uint8Array> {
        return readLocalFileData(this.file, this.entry);
    }

    async readText(): Promise<string> {
        const bytes = await this.readBytes();
        return new TextDecoder("utf-8").decode(bytes);
    }
}

export class MobileZipArchiveReader implements ZipArchiveReader {
    private entryMap = new Map<string, MobileZipEntryRecord>();

    constructor(private file: File, entries: MobileZipEntryRecord[]) {
        for (const entry of entries) {
            this.entryMap.set(entry.path, entry);
        }
    }

    async listEntries(): Promise<ZipEntryMeta[]> {
        return Array.from(this.entryMap.values()).map(({ path, size }) => ({ path, size }));
    }

    has(name: string): boolean {
        return this.entryMap.has(name);
    }

    get(name: string): ZipEntryHandle | null {
        const entry = this.entryMap.get(name);
        if (!entry) return null;
        return new MobileZipEntryHandle(this.file, entry);
    }
}

export async function readMobileZipEntries(
    file: File,
    shouldInclude?: (entryName: string, uncompressedSize: number) => boolean
): Promise<MobileZipEntryRecord[]> {
    const eocd = await findEOCD(file);
    if (!eocd) return [];

    const entries = await parseCentralDirectory(file, eocd.cdOffset, eocd.cdSize);
    if (entries.length === 0) return [];

    if (!shouldInclude) return entries;
    return entries.filter(entry => shouldInclude(entry.path, entry.size));
}
