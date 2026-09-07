/**
 * Builders for real ZIP archives, so ZIP tests exercise the production reader
 * instead of a stand-in. Test-only: excluded from coverage, never imported by
 * plugin code.
 */

const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
        let c = i;
        for (let k = 0; k < 8; k++) {
            c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        }
        table[i] = c >>> 0;
    }
    return table;
})();

function crc32(bytes: Uint8Array): number {
    let crc = 0xffffffff;
    for (const byte of bytes) {
        crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
}

async function deflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
    const compressed = new Blob([bytes as unknown as BlobPart])
        .stream()
        .pipeThrough(new CompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(compressed).arrayBuffer());
}

export interface ZipInput {
    name: string;
    data: Uint8Array;
    /** Store DEFLATE-compressed rather than stored. */
    compress?: boolean;
    /**
     * Extra-field bytes written to the *local* header only. Valid ZIPs may
     * declare different extra-field lengths locally and centrally, which is why
     * a data offset must be taken from the local header.
     */
    localExtra?: Uint8Array;
}

export async function buildZip(entries: ZipInput[]): Promise<Uint8Array> {
    const encoder = new TextEncoder();
    const chunks: Uint8Array[] = [];
    const central: Uint8Array[] = [];
    let offset = 0;

    for (const entry of entries) {
        const nameBytes = encoder.encode(entry.name);
        const stored = entry.compress
            ? await deflateRaw(entry.data)
            : entry.data;
        const localExtra = entry.localExtra ?? new Uint8Array(0);

        const local = new Uint8Array(30 + nameBytes.length + localExtra.length);
        const localView = new DataView(local.buffer);
        localView.setUint32(0, 0x04034b50, true);
        localView.setUint16(4, 20, true);
        localView.setUint16(8, entry.compress ? 8 : 0, true);
        localView.setUint32(14, crc32(entry.data), true);
        localView.setUint32(18, stored.length, true);
        localView.setUint32(22, entry.data.length, true);
        localView.setUint16(26, nameBytes.length, true);
        localView.setUint16(28, localExtra.length, true);
        local.set(nameBytes, 30);
        local.set(localExtra, 30 + nameBytes.length);

        const record = new Uint8Array(46 + nameBytes.length);
        const recordView = new DataView(record.buffer);
        recordView.setUint32(0, 0x02014b50, true);
        recordView.setUint16(4, 20, true);
        recordView.setUint16(6, 20, true);
        recordView.setUint16(10, entry.compress ? 8 : 0, true);
        recordView.setUint32(16, crc32(entry.data), true);
        recordView.setUint32(20, stored.length, true);
        recordView.setUint32(24, entry.data.length, true);
        recordView.setUint16(28, nameBytes.length, true);
        recordView.setUint32(42, offset, true);
        record.set(nameBytes, 46);

        chunks.push(local, stored);
        central.push(record);
        offset += local.length + stored.length;
    }

    const centralSize = central.reduce((sum, part) => sum + part.length, 0);
    const eocd = new Uint8Array(22);
    const eocdView = new DataView(eocd.buffer);
    eocdView.setUint32(0, 0x06054b50, true);
    eocdView.setUint16(8, entries.length, true);
    eocdView.setUint16(10, entries.length, true);
    eocdView.setUint32(12, centralSize, true);
    eocdView.setUint32(16, offset, true);

    const result = new Uint8Array(offset + centralSize + eocd.length);
    let position = 0;
    for (const part of [...chunks, ...central, eocd]) {
        result.set(part, position);
        position += part.length;
    }
    return result;
}

export function toFile(bytes: Uint8Array, name: string): File {
    return new File([bytes as unknown as BlobPart], name, {
        type: "application/zip",
    });
}

/** A minimal but genuinely supported ChatGPT export. */
export async function buildInnerExport(): Promise<Uint8Array> {
    return buildZip([
        {
            name: "conversations.json",
            data: new TextEncoder().encode(
                JSON.stringify([{ id: "abc", title: "Hello" }])
            ),
            compress: true,
        },
        {
            name: "file_00000000abcd.dat",
            data: new Uint8Array([1, 2, 3, 4, 5]),
        },
    ]);
}
