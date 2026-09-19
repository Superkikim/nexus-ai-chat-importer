// SPDX-License-Identifier: GPL-3.0-or-later
//
// Minimal EXIF reader: the `Artist` tag of a JPEG, nothing else. Grok signs
// the images it generates and records there the id of the Imagine post an
// image belongs to — the only link an export keeps between a post and its
// extra variants.

const ARTIST_TAG = 0x013b;
const ASCII_TYPE = 2;

/** The EXIF Artist of a JPEG, or null when absent or unreadable. */
export function readJpegExifArtist(bytes: Uint8Array): string | null {
    if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
        return null;
    }

    let offset = 2;
    while (offset + 4 <= bytes.length && bytes[offset] === 0xff) {
        const marker = bytes[offset + 1];
        // Start of scan or end of image: the metadata segments are behind us.
        if (marker === 0xda || marker === 0xd9) return null;

        const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
        if (length < 2) return null;
        const start = offset + 4;
        const end = offset + 2 + length;
        if (end > bytes.length) return null;

        if (marker === 0xe1 && isExifHeader(bytes, start)) {
            return readArtistFromTiff(bytes.subarray(start + 6, end));
        }
        offset = end;
    }
    return null;
}

function isExifHeader(bytes: Uint8Array, at: number): boolean {
    return (
        bytes[at] === 0x45 && // E
        bytes[at + 1] === 0x78 && // x
        bytes[at + 2] === 0x69 && // i
        bytes[at + 3] === 0x66 && // f
        bytes[at + 4] === 0 &&
        bytes[at + 5] === 0
    );
}

function readArtistFromTiff(tiff: Uint8Array): string | null {
    if (tiff.length < 8) return null;
    const little = tiff[0] === 0x49 && tiff[1] === 0x49; // "II"
    const big = tiff[0] === 0x4d && tiff[1] === 0x4d; // "MM"
    if (!little && !big) return null;

    const u16 = (at: number) =>
        little
            ? tiff[at] | (tiff[at + 1] << 8)
            : (tiff[at] << 8) | tiff[at + 1];
    const u32 = (at: number) =>
        little
            ? (tiff[at] | (tiff[at + 1] << 8) | (tiff[at + 2] << 16)) +
              tiff[at + 3] * 0x1000000
            : tiff[at] * 0x1000000 +
              ((tiff[at + 1] << 16) | (tiff[at + 2] << 8) | tiff[at + 3]);

    const ifd = u32(4);
    if (ifd + 2 > tiff.length) return null;
    const entries = u16(ifd);

    for (let i = 0; i < entries; i++) {
        const entry = ifd + 2 + i * 12;
        if (entry + 12 > tiff.length) return null;
        if (u16(entry) !== ARTIST_TAG || u16(entry + 2) !== ASCII_TYPE) {
            continue;
        }
        const count = u32(entry + 4);
        const valueAt = count <= 4 ? entry + 8 : u32(entry + 8);
        if (valueAt + count > tiff.length) return null;

        let text = "";
        for (let j = 0; j < count; j++) {
            const code = tiff[valueAt + j];
            if (code === 0) break;
            text += String.fromCharCode(code);
        }
        return text.trim() || null;
    }
    return null;
}
