import { ZipArchiveReader, ZipEntryHandle, ZipEntryMeta } from "./types";

declare const require: (name: string) => any;

interface DesktopZipEntryRecord extends ZipEntryMeta {
    compressedSize: number;
}

function openYauzl(filePath: string): Promise<any> {
    return new Promise((resolve, reject) => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const yauzl = require("yauzl");
        yauzl.open(filePath, { lazyEntries: true, autoClose: true }, (err: Error | null, zipfile: any) => {
            if (err) reject(err);
            else resolve(zipfile);
        });
    });
}

function normalizeChunk(chunk: Uint8Array | Buffer | string): Uint8Array {
    if (typeof chunk === "string") {
        return new TextEncoder().encode(chunk);
    }
    return chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);
}

async function* streamToByteChunks(stream: any): AsyncGenerator<Uint8Array> {
    const queue: Uint8Array[] = [];
    let done = false;
    let failure: Error | null = null;
    let resume: (() => void) | null = null;

    const wake = () => {
        if (resume) {
            const resolver = resume;
            resume = null;
            resolver();
        }
    };

    const onData = (chunk: Uint8Array | Buffer | string) => {
        queue.push(normalizeChunk(chunk));
        wake();
    };
    const onEnd = () => {
        done = true;
        wake();
    };
    const onError = (error: Error) => {
        failure = error;
        done = true;
        wake();
    };

    stream.on("data", onData);
    stream.on("end", onEnd);
    stream.on("error", onError);

    try {
        while (!done || queue.length > 0) {
            if (queue.length === 0) {
                await new Promise<void>((resolve) => {
                    resume = resolve;
                });
                continue;
            }

            yield queue.shift()!;
        }
    } finally {
        if (typeof stream.off === "function") {
            stream.off("data", onData);
            stream.off("end", onEnd);
            stream.off("error", onError);
        } else if (typeof stream.removeListener === "function") {
            stream.removeListener("data", onData);
            stream.removeListener("end", onEnd);
            stream.removeListener("error", onError);
        }
    }

    if (failure) {
        throw failure;
    }
}

async function streamToBuffer(stream: any): Promise<Uint8Array> {
    const chunks: Uint8Array[] = [];
    let totalLength = 0;

    for await (const chunk of streamToByteChunks(stream)) {
        chunks.push(chunk);
        totalLength += chunk.byteLength;
    }

    const buffer = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
        buffer.set(chunk, offset);
        offset += chunk.byteLength;
    }

    return buffer;
}

async function openDesktopEntryReadStream(
    filePath: string,
    entryName: string
): Promise<{ zipfile: any; stream: any }> {
    const zipfile = await openYauzl(filePath);

    return await new Promise<{ zipfile: any; stream: any }>((resolve, reject) => {
        let settled = false;

        const fail = (error: Error) => {
            if (settled) return;
            settled = true;
            zipfile.close();
            reject(error);
        };

        zipfile.on("error", fail);
        zipfile.on("end", () => {
            if (!settled) fail(new Error(`Entry not found in ZIP: ${entryName}`));
        });

        zipfile.on("entry", (entry: any) => {
            if (entry.fileName !== entryName) {
                zipfile.readEntry();
                return;
            }

            zipfile.openReadStream(entry, async (err: Error | null, stream: any) => {
                if (err) {
                    fail(err);
                    return;
                }

                if (!settled) {
                    settled = true;
                    resolve({ zipfile, stream });
                }
            });
        });

        zipfile.readEntry();
    });
}

async function readDesktopEntry(filePath: string, entryName: string): Promise<Uint8Array> {
    const { zipfile, stream } = await openDesktopEntryReadStream(filePath, entryName);
    try {
        return await streamToBuffer(stream);
    } finally {
        zipfile.close();
    }
}

class DesktopZipEntryHandle implements ZipEntryHandle {
    readonly name: string;

    constructor(private filePath: string, entryName: string) {
        this.name = entryName;
    }

    async readBytes(): Promise<Uint8Array> {
        return readDesktopEntry(this.filePath, this.name);
    }

    async readText(): Promise<string> {
        const bytes = await this.readBytes();
        return new TextDecoder("utf-8").decode(bytes);
    }

    async *readTextChunks(): AsyncGenerator<string> {
        const { zipfile, stream } = await openDesktopEntryReadStream(this.filePath, this.name);
        const decoder = new TextDecoder("utf-8");

        try {
            for await (const chunk of streamToByteChunks(stream)) {
                const textChunk = decoder.decode(chunk, { stream: true });
                if (textChunk.length > 0) {
                    yield textChunk;
                }
            }

            const finalChunk = decoder.decode();
            if (finalChunk.length > 0) {
                yield finalChunk;
            }
        } finally {
            zipfile.close();
        }
    }
}

export class DesktopZipArchiveReader implements ZipArchiveReader {
    private entryMap = new Map<string, DesktopZipEntryRecord>();

    constructor(private filePath: string, entries: DesktopZipEntryRecord[]) {
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
        if (!this.entryMap.has(name)) return null;
        return new DesktopZipEntryHandle(this.filePath, name);
    }
}

export async function readDesktopZipEntries(
    filePath: string,
    shouldInclude?: (entryName: string, uncompressedSize: number) => boolean
): Promise<DesktopZipEntryRecord[]> {
    const zipfile = await openYauzl(filePath);

    return await new Promise<DesktopZipEntryRecord[]>((resolve, reject) => {
        const entries: DesktopZipEntryRecord[] = [];

        zipfile.on("error", (error: Error) => {
            zipfile.close();
            reject(error);
        });

        zipfile.on("end", () => {
            resolve(entries);
        });

        zipfile.on("entry", (entry: any) => {
            if (!entry.fileName.endsWith("/") && (!shouldInclude || shouldInclude(entry.fileName, entry.uncompressedSize))) {
                entries.push({
                    path: entry.fileName,
                    size: entry.uncompressedSize,
                    compressedSize: entry.compressedSize,
                });
            }

            zipfile.readEntry();
        });

        zipfile.readEntry();
    });
}
