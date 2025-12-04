import { describe, it, expect } from "vitest";
import {
    decideArchiveMode,
    ZIP_LARGE_ARCHIVE_THRESHOLD_BYTES,
    UNCOMPRESSED_LARGE_ARCHIVE_THRESHOLD_BYTES,
} from "./archive-mode-decider";

/**
 * Tests for the archive mode decision helper.
 */

describe("decideArchiveMode", () => {
    it("returns normal for small archives", () => {
        const decision = decideArchiveMode({
            zipSizeBytes: 10 * 1024 * 1024, // 10 MB
            conversationsUncompressedBytes: 20 * 1024 * 1024, // 20 MB
        });

        expect(decision.mode).toBe("normal");
        expect(decision.reason).toBe("within-threshold");
    });

    it("switches to large-archive when ZIP is huge", () => {
        const decision = decideArchiveMode({
            zipSizeBytes: ZIP_LARGE_ARCHIVE_THRESHOLD_BYTES + 1,
        });

        expect(decision.mode).toBe("large-archive");
        expect(decision.reason).toBe("zip-too-large");
    });

    it("prefers uncompressed size when available", () => {
        const decision = decideArchiveMode({
            zipSizeBytes: ZIP_LARGE_ARCHIVE_THRESHOLD_BYTES / 2,
            conversationsUncompressedBytes:
                UNCOMPRESSED_LARGE_ARCHIVE_THRESHOLD_BYTES + 1,
        });

        expect(decision.mode).toBe("large-archive");
        expect(decision.reason).toBe("uncompressed-too-large");
    });

    it("treats missing uncompressed size as unknown and falls back to ZIP", () => {
        const decision = decideArchiveMode({
            zipSizeBytes: ZIP_LARGE_ARCHIVE_THRESHOLD_BYTES + 10,
        });

        expect(decision.mode).toBe("large-archive");
        expect(decision.reason).toBe("zip-too-large");
    });
});

