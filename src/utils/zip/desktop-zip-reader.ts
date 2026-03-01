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

function streamToBuffer(stream: any): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
        const chunks: Uint8Array[] = [];
        stream.on("data", (chunk: Uint8Array | string) => {
            if (typeof chunk === "string") {
                chunks.push(new TextEncoder().encode(chunk));
            } else {
                chunks.push(chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk));
            }
        });
        stream.on("end", () => {
            const totalLength = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
            const buffer = new Uint8Array(totalLength);
            let offset = 0;
            for (const chunk of chunks) {
                buffer.set(chunk, offset);
                offset += chunk.byteLength;
            }
            resolve(buffer);
        });
        stream.on("error", reject);
    });
}

async function readDesktopEntry(filePath: string, entryName: string): Promise<Uint8Array> {
    const zipfile = await openYauzl(filePath);

    return await new Promise<Uint8Array>((resolve, reject) => {
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

                try {
                    const buffer = await streamToBuffer(stream);
                    if (!settled) {
                        settled = true;
                        zipfile.close();
                        resolve(buffer);
                    }
                } catch (error) {
                    fail(error as Error);
                }
            });
        });

        zipfile.readEntry();
    });
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
