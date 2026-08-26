import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Obsidian's `createSpan`/`createDiv`/`createEl` helpers live on Node.prototype
 * and *append* the new element to the node they are called on. Calling them on
 * `activeDocument` therefore appends to the document, which throws
 * "Only one element on document allowed" — the failure that took down the
 * conversation selection dialog on Obsidian 1.13.
 *
 * A detached element must come from `createElement`.
 */
function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) return sourceFiles(full);
        return full.endsWith(".ts") && !full.endsWith(".test.ts") ? [full] : [];
    });
}

describe("detached element creation", () => {
    it("never calls Obsidian's append-helpers on a document", () => {
        const offenders = sourceFiles("src")
            .map((file) => ({ file, text: readFileSync(file, "utf8") }))
            .flatMap(({ file, text }) =>
                text
                    .split("\n")
                    .map((line, index) => ({ line, number: index + 1 }))
                    .filter(({ line }) =>
                        /\b(activeDocument|document)\s*\.\s*create(Span|Div|El)\s*\(/.test(
                            line
                        )
                    )
                    .map(({ number }) => `${file}:${number}`)
            );

        expect(offenders, "use createElement for a detached element").toEqual(
            []
        );
    });
});
