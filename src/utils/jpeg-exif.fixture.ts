// SPDX-License-Identifier: GPL-3.0-or-later
//
// Test fixture: synthetic JPEG bytes carrying an EXIF tag.

/** A JPEG whose APP1 holds a one-entry IFD0 with the given ASCII tag. */
export function jpegWithTag(
    text: string,
    options: { bigEndian?: boolean; tag?: number } = {}
): Uint8Array {
    const tag = options.tag ?? 0x013b;
    const big = options.bigEndian ?? false;
    const value = [...text].map((c) => c.charCodeAt(0)).concat(0);
    const count = value.length;

    const u16 = (n: number) => (big ? [n >> 8, n & 0xff] : [n & 0xff, n >> 8]);
    const u32 = (n: number) =>
        big
            ? [n >>> 24, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]
            : [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, n >>> 24];

    // TIFF header (8) + entry count (2) + one entry (12) + next IFD (4) = 26
    const valueOffset = 26;
    const inline = count <= 4;
    const tiff = [
        ...(big ? [0x4d, 0x4d] : [0x49, 0x49]),
        ...u16(42),
        ...u32(8),
        ...u16(1),
        ...u16(tag),
        ...u16(2),
        ...u32(count),
        ...(inline ? [...value, 0, 0, 0, 0].slice(0, 4) : u32(valueOffset)),
        ...u32(0),
        ...(inline ? [] : value),
    ];

    const payload = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];
    const length = payload.length + 2;
    return new Uint8Array([
        0xff,
        0xd8,
        0xff,
        0xe1,
        length >> 8,
        length & 0xff,
        ...payload,
        0xff,
        0xda,
        0x00,
        0x02,
    ]);
}
