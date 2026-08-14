import { describe, expect, it } from "vitest";
import {
    SANITIZED_LIBRARY_FILES_SAMPLE,
    SANITIZED_GENERATED_IMAGE_ENTRY,
    SANITIZED_GENERATED_DOCUMENT_ENTRY,
    SANITIZED_MISSING_CREATED_AT_ENTRY,
} from "./chatgpt-library-index.fixtures";

describe("chatgpt library artifact fixtures", () => {
    it("is a JSON-serializable array matching the observed library_files.json shape", () => {
        const roundTripped = JSON.parse(
            JSON.stringify(SANITIZED_LIBRARY_FILES_SAMPLE)
        );
        expect(Array.isArray(roundTripped)).toBe(true);
        expect(roundTripped).toHaveLength(
            SANITIZED_LIBRARY_FILES_SAMPLE.length
        );
    });

    it("gives the generated image entry a generation id and image artifact type", () => {
        expect(
            SANITIZED_GENERATED_IMAGE_ENTRY.image_gen_generation_id
        ).toBeTruthy();
        expect(SANITIZED_GENERATED_IMAGE_ENTRY.library_artifact_type).toBe(
            "image"
        );
    });

    it("gives the generated document entry a report artifact type and no generation id", () => {
        expect(SANITIZED_GENERATED_DOCUMENT_ENTRY.library_artifact_type).toBe(
            "report"
        );
        expect(
            SANITIZED_GENERATED_DOCUMENT_ENTRY.image_gen_generation_id
        ).toBeNull();
    });

    it("exercises the timestamp fallback chain by omitting created_at", () => {
        expect(SANITIZED_MISSING_CREATED_AT_ENTRY.created_at).toBeNull();
        expect(
            SANITIZED_MISSING_CREATED_AT_ENTRY.record_creation_time
        ).toBeNull();
        expect(
            SANITIZED_MISSING_CREATED_AT_ENTRY.version_created_at
        ).toBeTruthy();
    });
});
