import { describe, expect, it } from "vitest";
import { readJpegExifArtist } from "./jpeg-exif";
import { jpegWithTag } from "./jpeg-exif.fixture";

const POST_ID = "33333333-cccc-4ccc-8ccc-333333333333";

describe("readJpegExifArtist", () => {
    it("reads the Artist of a little-endian EXIF block", () => {
        expect(readJpegExifArtist(jpegWithTag(POST_ID))).toBe(POST_ID);
    });

    it("reads the Artist of a big-endian EXIF block", () => {
        expect(
            readJpegExifArtist(jpegWithTag(POST_ID, { bigEndian: true }))
        ).toBe(POST_ID);
    });

    it("reads a value short enough to sit inside its entry", () => {
        expect(readJpegExifArtist(jpegWithTag("abc"))).toBe("abc");
    });

    it("returns null when the block has no Artist", () => {
        expect(
            readJpegExifArtist(jpegWithTag("text", { tag: 0x010e }))
        ).toBeNull();
    });

    it("returns null for a JPEG without EXIF", () => {
        expect(
            readJpegExifArtist(
                new Uint8Array([
                    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0, 0, 0xff, 0xd9,
                ])
            )
        ).toBeNull();
    });

    it("returns null for what is not a JPEG", () => {
        expect(
            readJpegExifArtist(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))
        ).toBeNull();
    });

    it("returns null, without throwing, for a truncated block", () => {
        expect(
            readJpegExifArtist(jpegWithTag(POST_ID).slice(0, 30))
        ).toBeNull();
    });
});
