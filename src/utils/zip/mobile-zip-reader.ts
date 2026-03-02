import { ZipArchiveReader, ZipEntryHandle, ZipEntryMeta } from "./types";
import { logger } from "../../logger";

declare class DecompressionStream {
    readonly readable: ReadableStream<Uint8Array>;
    readonly writable: WritableStream<BufferSource>;
    constructor(format: "deflate" | "deflate-raw" | "gzip");
}

interface CentralDirectoryInfo {
    entryCount: number;
    centralDirectoryOffset: number;
    centralDirectorySize: number;
}

interface MobileZipEntryRecord extends ZipEntryMeta {
    compressionMethod: number;
    compressedSize: number;
    localHeaderOffset: number;
    generalPurposeBitFlag: number;
}

const EOCD_SIGNATURE = 0x06054b50;
const ZIP64_EOCD_LOCATOR_SIGNATURE = 0x07064b50;
const ZIP64_EOCD_SIGNATURE = 0x06064b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
const ZIP64_EXTRA_FIELD_ID = 0x0001;
const mobileZipLogger = logger.child("MobileZip");

function readSlice(file: File, start: number, length: number): Promise<ArrayBuffer> {
    if (length <= 0) {
        return Promise.resolve(new ArrayBuffer(0));
    }

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => reject(reader.error ?? new Error("ZIP read failed"));
        reader.readAsArrayBuffer(file.slice(start, start + length));
    });
}

function getUint64(view: DataView, offset: number): number {
    const low = view.getUint32(offset, true);
    const high = view.getUint32(offset + 4, true);
    return high * 0x1_0000_0000 + low;
}

async function findEndOfCentralDirectory(file: File): Promise<{ offset: number; view: DataView }> {
    const searchSize = Math.min(65557, file.size);
    const sliceStart = file.size - searchSize;
    const buffer = await readSlice(file, sliceStart, searchSize);
    const view = new DataView(buffer);

    for (let pos = buffer.byteLength - 22; pos >= 0; pos--) {
        if (view.getUint32(pos, true) === EOCD_SIGNATURE) {
            return { offset: sliceStart + pos, view: new DataView(buffer, pos) };
        }
    }

    throw new Error("ZIP central directory not found");
}

async function readZip64CentralDirectoryInfo(file: File, eocdOffset: number): Promise<CentralDirectoryInfo> {
    const locatorOffset = eocdOffset - 20;
    if (locatorOffset < 0) {
        throw new Error("ZIP64 locator is missing");
    }

    const locatorBuffer = await readSlice(file, locatorOffset, 20);
    const locatorView = new DataView(locatorBuffer);

    if (locatorView.getUint32(0, true) !== ZIP64_EOCD_LOCATOR_SIGNATURE) {
        throw new Error("ZIP64 locator is invalid");
    }

    const zip64EocdOffset = getUint64(locatorView, 8);
    const zip64Buffer = await readSlice(file, zip64EocdOffset, 56);
    const zip64View = new DataView(zip64Buffer);

    if (zip64View.getUint32(0, true) !== ZIP64_EOCD_SIGNATURE) {
        throw new Error("ZIP64 end of central directory record is invalid");
    }

    return {
        entryCount: getUint64(zip64View, 32),
        centralDirectorySize: getUint64(zip64View, 40),
        centralDirectoryOffset: getUint64(zip64View, 48),
    };
}

async function readCentralDirectoryInfo(file: File): Promise<CentralDirectoryInfo> {
    const { offset: eocdOffset, view } = await findEndOfCentralDirectory(file);
    const entryCount = view.getUint16(10, true);
    const centralDirectorySize = view.getUint32(12, true);
    const centralDirectoryOffset = view.getUint32(16, true);

    const usesZip64 =
        entryCount === 0xffff ||
        centralDirectorySize === 0xffffffff ||
        centralDirectoryOffset === 0xffffffff;

    if (usesZip64) {
        mobileZipLogger.info(`ZIP64 central directory detected for ${file.name}`, {
            fileSize: file.size,
            eocdOffset,
        });
        return readZip64CentralDirectoryInfo(file, eocdOffset);
    }

    return {
        entryCount,
        centralDirectorySize,
        centralDirectoryOffset,
    };
}

function parseZip64ExtraField(
    extraFieldBytes: Uint8Array,
    needs: { uncompressedSize?: boolean; compressedSize?: boolean; localHeaderOffset?: boolean }
): {
    uncompressedSize?: number;
    compressedSize?: number;
    localHeaderOffset?: number;
} {
    const view = new DataView(
        extraFieldBytes.buffer,
        extraFieldBytes.byteOffset,
        extraFieldBytes.byteLength
    );

    let pos = 0;
    while (pos + 4 <= extraFieldBytes.byteLength) {
        const headerId = view.getUint16(pos, true);
        const dataSize = view.getUint16(pos + 2, true);
        pos += 4;

        if (pos + dataSize > extraFieldBytes.byteLength) {
            break;
        }

        if (headerId === ZIP64_EXTRA_FIELD_ID) {
            let valueOffset = pos;
            const result: { uncompressedSize?: number; compressedSize?: number; localHeaderOffset?: number } = {};

            if (needs.uncompressedSize) {
                result.uncompressedSize = getUint64(view, valueOffset);
                valueOffset += 8;
            }
            if (needs.compressedSize) {
                result.compressedSize = getUint64(view, valueOffset);
                valueOffset += 8;
            }
            if (needs.localHeaderOffset) {
                result.localHeaderOffset = getUint64(view, valueOffset);
            }

            return result;
        }

        pos += dataSize;
    }

    throw new Error("ZIP64 extra field is missing required values");
}

async function parseCentralDirectory(file: File, info: CentralDirectoryInfo): Promise<MobileZipEntryRecord[]> {
    const buffer = await readSlice(file, info.centralDirectoryOffset, info.centralDirectorySize);
    const view = new DataView(buffer);
    const utf8Decoder = new TextDecoder("utf-8");
    const entries: MobileZipEntryRecord[] = [];

    let pos = 0;
    while (pos + 46 <= buffer.byteLength && entries.length < info.entryCount) {
        if (view.getUint32(pos, true) !== CENTRAL_DIRECTORY_SIGNATURE) {
            throw new Error("ZIP central directory is corrupted");
        }

        const generalPurposeBitFlag = view.getUint16(pos + 8, true);
        const compressionMethod = view.getUint16(pos + 10, true);
        let compressedSize = view.getUint32(pos + 20, true);
        let uncompressedSize = view.getUint32(pos + 24, true);
        const fileNameLength = view.getUint16(pos + 28, true);
        const extraFieldLength = view.getUint16(pos + 30, true);
        const commentLength = view.getUint16(pos + 32, true);
        let localHeaderOffset = view.getUint32(pos + 42, true);

        const headerEnd = pos + 46;
        const fileNameStart = headerEnd;
        const extraFieldStart = fileNameStart + fileNameLength;
        const recordEnd = extraFieldStart + extraFieldLength + commentLength;

        if (recordEnd > buffer.byteLength) {
            throw new Error("ZIP central directory entry is truncated");
        }

        const fileNameBytes = new Uint8Array(buffer, fileNameStart, fileNameLength);
        const extraFieldBytes = new Uint8Array(buffer, extraFieldStart, extraFieldLength);
        const fileName = utf8Decoder.decode(fileNameBytes);

        if (
            compressedSize === 0xffffffff ||
            uncompressedSize === 0xffffffff ||
            localHeaderOffset === 0xffffffff
        ) {
            const zip64Values = parseZip64ExtraField(extraFieldBytes, {
                uncompressedSize: uncompressedSize === 0xffffffff,
                compressedSize: compressedSize === 0xffffffff,
                localHeaderOffset: localHeaderOffset === 0xffffffff,
            });

            compressedSize = zip64Values.compressedSize ?? compressedSize;
            uncompressedSize = zip64Values.uncompressedSize ?? uncompressedSize;
            localHeaderOffset = zip64Values.localHeaderOffset ?? localHeaderOffset;
        }

        if (!fileName.endsWith("/")) {
            entries.push({
                path: fileName,
                size: uncompressedSize,
                compressionMethod,
                compressedSize,
                localHeaderOffset,
                generalPurposeBitFlag,
            });
        }

        pos = recordEnd;
    }

    return entries;
}

async function readCompressedFileData(file: File, entry: MobileZipEntryRecord): Promise<Uint8Array> {
    const localHeader = await readSlice(file, entry.localHeaderOffset, 30);
    const headerView = new DataView(localHeader);

    if (headerView.getUint32(0, true) !== LOCAL_FILE_HEADER_SIGNATURE) {
        throw new Error(`Invalid local header for ${entry.path}`);
    }

    const fileNameLength = headerView.getUint16(26, true);
    const extraFieldLength = headerView.getUint16(28, true);
    const dataStart = entry.localHeaderOffset + 30 + fileNameLength + extraFieldLength;

    return new Uint8Array(await readSlice(file, dataStart, entry.compressedSize));
}

async function inflateRawDeflate(data: Uint8Array, expectedLength: number): Promise<Uint8Array> {
    if (typeof DecompressionStream === "undefined") {
        throw new Error("DecompressionStream is unavailable on this device");
    }

    const chunks: Uint8Array[] = [];
    let totalLength = 0;

    const response = new Response(
        new Blob([data]).stream().pipeThrough(
            new DecompressionStream("deflate-raw") as unknown as TransformStream<Uint8Array, Uint8Array>
        )
    );

    const reader = response.body?.getReader();
    if (!reader) {
        throw new Error("Failed to create decompression stream");
    }

    while (true) {
        const { value, done } = await reader.read();
        if (done) {
            break;
        }
        if (!value) {
            continue;
        }

        chunks.push(value);
        totalLength += value.byteLength;
    }

    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.byteLength;
    }

    if (expectedLength > 0 && totalLength !== expectedLength) {
        return result;
    }

    return result;
}

async function readLocalFileData(file: File, entry: MobileZipEntryRecord): Promise<Uint8Array> {
    const compressed = await readCompressedFileData(file, entry);

    if (entry.compressionMethod === 0) {
        return compressed;
    }

    if (entry.compressionMethod === 8) {
        return inflateRawDeflate(compressed, entry.size);
    }

    throw new Error(`Unsupported ZIP compression method ${entry.compressionMethod} for ${entry.path}`);
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
    private readonly entryMap = new Map<string, MobileZipEntryRecord>();

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
        if (!entry) {
            return null;
        }
        return new MobileZipEntryHandle(this.file, entry);
    }
}

export async function readMobileZipEntries(
    file: File,
    shouldInclude?: (entryName: string, uncompressedSize: number) => boolean
): Promise<MobileZipEntryRecord[]> {
    const startedAt = Date.now();
    mobileZipLogger.info(`Begin ZIP scan for ${file.name}`, {
        fileSize: file.size,
        hasFilter: !!shouldInclude,
    });

    try {
        const centralDirectoryInfo = await readCentralDirectoryInfo(file);
        mobileZipLogger.info(`Central directory located for ${file.name}`, {
            entryCount: centralDirectoryInfo.entryCount,
            centralDirectoryOffset: centralDirectoryInfo.centralDirectoryOffset,
            centralDirectorySize: centralDirectoryInfo.centralDirectorySize,
        });

        const entries = await parseCentralDirectory(file, centralDirectoryInfo);
        const filteredEntries = shouldInclude
            ? entries.filter(entry => shouldInclude(entry.path, entry.size))
            : entries;

        mobileZipLogger.info(`ZIP scan complete for ${file.name}`, {
            totalEntries: entries.length,
            returnedEntries: filteredEntries.length,
            durationMs: Date.now() - startedAt,
        });

        return filteredEntries;
    } catch (error) {
        mobileZipLogger.error(`ZIP scan failed for ${file.name}`, {
            fileSize: file.size,
            durationMs: Date.now() - startedAt,
            message: error instanceof Error ? error.message : String(error),
        });
        throw error;
    }
}
