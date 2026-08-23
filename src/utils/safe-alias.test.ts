import { describe, expect, it } from "vitest";
import { generateSafeAlias } from "../utils";

describe("generateSafeAlias unicode handling", () => {
    it("preserves non-ASCII letters at the beginning of titles", () => {
        expect(generateSafeAlias("Ошибка Ambiguous project name")).toBe(
            "Ошибка Ambiguous project name"
        );
    });

    it("preserves CJK titles", () => {
        expect(generateSafeAlias("中文标题 test")).toBe("中文标题 test");
    });

    it("still strips unsafe leading punctuation before a unicode letter", () => {
        expect(generateSafeAlias("<<Ошибка>> test")).toBe("Ошибка test");
    });
});
