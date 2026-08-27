import { describe, expect, it } from "vitest";
import { ImportReport } from "./import-report";
import type { AnalysisInfo } from "../services/conversation-metadata-extractor";

/**
 * Characterization tests for the three report flows that actually run.
 *
 * The counters they render come from two different phases — the archive
 * analysis (`AnalysisInfo`) and the vault writes (the report's own sections) —
 * and the mobile flow has no analysis phase at all. These tests pin what each
 * flow produces today so a refactor of the counters cannot silently zero out
 * one of them.
 *
 * Flows covered:
 *   1. desktop import-all  — analysisInfo present, not selective
 *   2. selective import    — analysisInfo present, selective
 *   3. mobile-direct       — no analysisInfo (handleImportAllMobileSequential)
 */

function fakeFile(name: string, lastModified = 1_700_000_000_000): File {
    return { name, lastModified } as File;
}

const LINKS = {
    summaryFileName: "s.md",
    heavyFileName: "h.md",
    mobileFileName: "m.md",
};

function analysis(overrides: Partial<AnalysisInfo> = {}): AnalysisInfo {
    return {
        totalConversationsFound: 12,
        uniqueConversationsKept: 10,
        duplicatesRemoved: 2,
        hasMultipleFiles: false,
        conversationsNew: 3,
        conversationsUpdated: 2,
        conversationsUnchanged: 5,
        conversationsDroppedUnchanged: 5,
        conversationsReprocessed: 0,
        ...overrides,
    };
}

/**
 * A report with one archive: 3 created, 2 updated, 1 no-op write, 1 empty,
 * 1 failed. The no-op is what `addSkipped` records — a note that was
 * regenerated and came out byte-identical.
 */
function populatedReport(): ImportReport {
    const report = new ImportReport();
    report.startFileSection("export.zip");

    report.addCreated("New A", "p/a.md", 1_700_000_000, 1_700_000_100, 5);
    report.addCreated("New B", "p/b.md", 1_700_000_000, 1_700_000_100, 6);
    report.addCreated("New C", "p/c.md", 1_700_000_000, 1_700_000_100, 7);
    report.addUpdated("Upd A", "p/d.md", 1_700_000_000, 1_700_000_200, 2);
    report.addUpdated("Upd B", "p/e.md", 1_700_000_000, 1_700_000_200, 3);
    report.addSkipped(
        "Same",
        "p/f.md",
        1_700_000_000,
        1_700_000_000,
        4,
        "No changes needed"
    );
    report.addIgnored("Empty", "p/g.md", 1_700_000_000, 1_700_000_000);
    report.addFailed("Boom", "p/h.md", 1_700_000_000, 1_700_000_000, "err");

    report.setFileCounters({
        totalConversationsProcessed: 8,
        totalNewConversationsSuccessfullyImported: 3,
        totalConversationsActuallyUpdated: 2,
        totalNonEmptyMessagesAdded: 5,
    });

    return report;
}

/** A named row of the "Conversations" table, as rendered. */
function conversationsRow(markdown: string, label: string): string | undefined {
    const start = markdown.indexOf("### Conversations");
    expect(start).toBeGreaterThan(-1);
    return markdown
        .slice(start)
        .split("\n")
        .find((line) => line.startsWith(`| ${label} |`));
}

describe("import report — desktop import-all (analysis available)", () => {
    it("renders conversation counters from the analysis, not from the writes", () => {
        const report = populatedReport();
        report.setAnalysisInfo(analysis());

        const markdown = report.generateSummaryReportContent(
            [fakeFile("export.zip")],
            ["export.zip"],
            [],
            false,
            undefined,
            LINKS
        );

        expect(markdown).toContain("| Created | 3 |");
        expect(markdown).toContain("| Updated | 2 |");
        expect(markdown).toContain("| Failed | 1 |");
        // 5 unchanged conversations dropped at analysis time — not the single
        // no-op write recorded by addSkipped.
        expect(conversationsRow(markdown, "Unchanged (not imported)")).toBe(
            "| Unchanged (not imported) | 5 |"
        );
        expect(markdown).toContain("| Found (raw) | 12 |");
        expect(markdown).toContain("| Kept (unique) | 10 |");
        expect(markdown).toContain("| Duplicates removed | 2 |");
    });

    it("feeds the completion dialog from the analysis", () => {
        const report = populatedReport();
        report.setAnalysisInfo(analysis());

        const stats = report.getCompletionStats();

        expect(stats.totalFiles).toBe(1);
        expect(stats.totalConversations).toBe(10);
        expect(stats.duplicates).toBe(2);
        expect(stats.created).toBe(3);
        expect(stats.updated).toBe(2);
        expect(stats.skipped).toBe(5);
        expect(stats.emptyConversations).toBe(1);
        expect(stats.failed).toBe(1);
    });
});

describe("import report — selective import", () => {
    it("renders the analysis block just like a full import", () => {
        const report = populatedReport();
        report.setAnalysisInfo(analysis());

        const markdown = report.generateSummaryReportContent(
            [fakeFile("export.zip")],
            ["export.zip"],
            [],
            true,
            undefined,
            LINKS
        );

        expect(markdown).toContain("| Kept (unique) | 10 |");
        expect(conversationsRow(markdown, "Unchanged (not imported)")).toBe(
            "| Unchanged (not imported) | 5 |"
        );
    });

    it("reports the conversations the user left unchecked", () => {
        const report = populatedReport();
        report.setAnalysisInfo(analysis());
        report.setSelection(10, 4);

        const markdown = report.generateSummaryReportContent(
            [fakeFile("export.zip")],
            ["export.zip"],
            [],
            true,
            undefined,
            LINKS
        );

        expect(conversationsRow(markdown, "Not selected")).toBe(
            "| Not selected | 6 |"
        );
    });

    it("leaves the row out of a full import, where nothing was offered", () => {
        const report = populatedReport();
        report.setAnalysisInfo(analysis());

        const markdown = report.generateSummaryReportContent(
            [fakeFile("export.zip")],
            ["export.zip"],
            [],
            false,
            undefined,
            LINKS
        );

        expect(conversationsRow(markdown, "Not selected")).toBeUndefined();
    });
});

describe("import report — mobile direct (no analysis phase)", () => {
    /**
     * handleImportAllMobileSequential never calls the metadata extractor, so
     * `analysisInfo` is undefined and the report's own sections are the only
     * source of truth. Zeroing this out is the regression that a counter
     * refactor is most likely to introduce.
     */
    it("falls back to the write counters for the skipped row", () => {
        const report = populatedReport();

        const markdown = report.generateSummaryReportContent(
            [fakeFile("export.zip")],
            ["export.zip"],
            [],
            false,
            undefined,
            LINKS
        );

        expect(markdown).toContain("| Created | 3 |");
        expect(markdown).toContain("| Updated | 2 |");
        // The single no-op write, because nothing else is known.
        expect(conversationsRow(markdown, "Unchanged (not imported)")).toBe(
            "| Unchanged (not imported) | 1 |"
        );
        // Analysis-only rows must stay out rather than render as zero.
        expect(markdown).not.toContain("| Found (raw) |");
        expect(markdown).not.toContain("| Kept (unique) |");
    });

    it("falls back to the write counters for the completion dialog", () => {
        const report = populatedReport();

        const stats = report.getCompletionStats();

        expect(stats.totalConversations).toBe(8); // totalConversationsProcessed
        expect(stats.duplicates).toBe(0);
        expect(stats.created).toBe(3);
        expect(stats.updated).toBe(2);
        expect(stats.skipped).toBe(1); // the no-op write
        expect(stats.emptyConversations).toBe(1);
        expect(stats.failed).toBe(1);
    });
});

describe("import report — every row names its own subject", () => {
    it("never reuses one label for archives and for conversations", () => {
        const report = populatedReport();
        report.setAnalysisInfo(analysis());

        const markdown = report.generateSummaryReportContent(
            [fakeFile("export.zip"), fakeFile("other.zip")],
            ["export.zip"],
            ["other.zip"],
            false,
            undefined,
            LINKS
        );

        const filesBlock = markdown.slice(
            markdown.indexOf("### Files"),
            markdown.indexOf("### Conversations")
        );
        // One archive was not processed...
        expect(filesBlock).toContain("| Not processed | 1 |");
        // ...and five conversations were already up to date. Different words.
        expect(conversationsRow(markdown, "Unchanged (not imported)")).toBe(
            "| Unchanged (not imported) | 5 |"
        );
        // The overloaded label is gone from the note entirely, including the
        // per-archive Status column that used it a third time.
        expect(markdown).not.toContain("| Skipped |");
        expect(markdown).not.toContain("| skipped |");
    });
});

describe("import report — heavy and mobile indexes", () => {
    it("lists created and updated notes in both indexes", () => {
        const report = populatedReport();
        const files = [fakeFile("export.zip")];

        const heavy = report.generateHeavyIndexContent(files, LINKS);
        const mobile = report.generateMobileIndexContent(files, LINKS);

        for (const markdown of [heavy, mobile]) {
            expect(markdown).toContain("New A");
            expect(markdown).toContain("Upd A");
        }
        // Neither index surfaces no-op writes or empty conversations.
        expect(heavy).not.toContain("Same");
        expect(mobile).not.toContain("Same");
    });
});

describe("conversation ledger", () => {
    it("resolves from the analysis when one ran", () => {
        const report = populatedReport();
        report.setAnalysisInfo(analysis());

        const ledger = report.getConversationLedger();

        expect(ledger.analysisAvailable).toBe(true);
        expect(ledger.totalFound).toBe(12);
        expect(ledger.uniqueKept).toBe(10);
        expect(ledger.unchanged).toBe(5);
        expect(ledger.unchangedSkipped).toBe(5);
        expect(ledger.totalConversations).toBe(10);
        expect(ledger.duplicates).toBe(2);
        // Write counters stay themselves — the no-op is not the skip count.
        expect(ledger.noChange).toBe(1);
        expect(ledger.created).toBe(3);
        expect(ledger.updated).toBe(2);
        expect(ledger.empty).toBe(1);
        expect(ledger.failed).toBe(1);
    });

    it("falls back to the writes when no analysis ran", () => {
        const ledger = populatedReport().getConversationLedger();

        expect(ledger.analysisAvailable).toBe(false);
        // On the mobile flow an unchanged conversation reaches the processor
        // and is recorded by addSkipped, so the no-op counter carries the
        // meaning the analysis would otherwise have supplied.
        expect(ledger.unchangedSkipped).toBe(1);
        expect(ledger.totalConversations).toBe(8);
        expect(ledger.duplicates).toBe(0);
        // Archive-side numbers stay at zero and must never be rendered.
        expect(ledger.totalFound).toBe(0);
        expect(ledger.uniqueKept).toBe(0);
        expect(ledger.unchanged).toBe(0);
    });

    it("keeps the unchanged count whole when a rebuild pulls them back in", () => {
        const report = populatedReport();
        report.setAnalysisInfo(
            analysis({
                conversationsUnchanged: 5,
                conversationsDroppedUnchanged: 0,
                conversationsReprocessed: 5,
            })
        );

        const ledger = report.getConversationLedger();

        // What the vault holds, versus what we did about it.
        expect(ledger.unchanged).toBe(5);
        expect(ledger.reprocessed).toBe(5);
        expect(ledger.unchangedSkipped).toBe(0);
    });

    it("splits unchanged into dropped and reprocessed without losing any", () => {
        const report = populatedReport();
        report.setAnalysisInfo(
            analysis({
                conversationsUnchanged: 7,
                conversationsDroppedUnchanged: 4,
                conversationsReprocessed: 3,
            })
        );

        const ledger = report.getConversationLedger();

        expect(ledger.unchangedSkipped + ledger.reprocessed).toBe(
            ledger.unchanged
        );
    });
});

describe("import report — a rebuild is a request, not an outcome", () => {
    it("does not claim conversations were rebuilt when they were unchecked", () => {
        // The analysis pulled 7 unchanged conversations back in, then the user
        // kept 3 of 10. Saying "7 rebuilt" would contradict "7 not selected".
        const report = populatedReport();
        report.setAnalysisInfo(
            analysis({
                conversationsUnchanged: 7,
                conversationsDroppedUnchanged: 0,
                conversationsReprocessed: 7,
            })
        );
        report.setSelection(10, 3);

        const markdown = report.generateSummaryReportContent(
            [fakeFile("export.zip")],
            ["export.zip"],
            [],
            true,
            undefined,
            LINKS
        );

        expect(
            conversationsRow(markdown, "Unchanged (rebuild requested)")
        ).toBe("| Unchanged (rebuild requested) | 7 |");
        expect(conversationsRow(markdown, "Not selected")).toBe(
            "| Not selected | 7 |"
        );
        expect(markdown).not.toContain("Unchanged (rebuilt)");
    });
});
