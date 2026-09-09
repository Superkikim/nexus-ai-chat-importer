import { describe, expect, it } from "vitest";
import { splitLines } from "../utils";

describe("splitLines", () => {
    it("splits on bare CR", () => {
        expect(splitLines("alpha\rbeta\rgamma")).toEqual([
            "alpha",
            "beta",
            "gamma",
        ]);
    });

    it("splits on CRLF without leaving stray CR or blank lines", () => {
        expect(splitLines("one\r\ntwo")).toEqual(["one", "two"]);
    });

    it("splits on LF as before", () => {
        expect(splitLines("one\ntwo")).toEqual(["one", "two"]);
    });

    it("handles mixed endings in one document", () => {
        expect(splitLines("a\nb\rc\r\nd")).toEqual(["a", "b", "c", "d"]);
    });

    it("preserves empty lines", () => {
        expect(splitLines("a\r\rb")).toEqual(["a", "", "b"]);
    });
});
