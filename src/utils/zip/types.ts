export interface ZipEntryMeta {
    path: string;
    size: number;
}

export interface ZipEntryHandle {
    readonly name: string;
    readText(): Promise<string>;
    readBytes(): Promise<Uint8Array>;
    readTextChunks?(): AsyncGenerator<string>;
}

export interface ZipArchiveReader {
    listEntries(): Promise<ZipEntryMeta[]>;
    has(name: string): boolean;
    get(name: string): ZipEntryHandle | null;
}

export interface AttachmentLookupIndex {
    byExactPath: Map<string, string>;
    byBaseName: Map<string, string[]>;
    byFileId: Map<string, string[]>;
    byDalleId: Map<string, string[]>;
}

export interface BinaryWriteResult {
    detectedMimeType?: string;
    detectedExtension?: string;
    byteLength: number;
}

export interface BinaryVaultWriter {
    writeBinary(normalizedPath: string, data: ArrayBuffer): Promise<void>;
}

export interface BinaryVaultTarget {
    adapter: BinaryVaultWriter;
}
