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
        conversationsIgnored: 5,
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
    report.addFailed("Boom", "p/h.md", 1_700_000_000, 1_700_000_000, 0, "err");

    report.setFileCounters({
        totalConversationsProcessed: 8,
        totalNewConversationsSuccessfullyImported: 3,
        totalConversationsActuallyUpdated: 2,
        totalNonEmptyMessagesAdded: 5,
    });

    return report;
}

/** The `| Skipped | n |` row of the "Conversations" table, as rendered. */
function conversationsSkippedRow(markdown: string): string | undefined {
    const start = markdown.indexOf("### Conversations");
    expect(start).toBeGreaterThan(-1);
    return markdown
        .slice(start)
        .split("\n")
        .find((line) => line.startsWith("| Skipped |"));
}

describe("import report — desktop import-all (analysis available)", () => {
    it("renders conversation counters from the analysis, not from the writes", () => {
        const report = populatedReport();
        report.setAnalysisInfo(analysis());

        const markdown = report.generateSummaryReportContent(
            [fakeFile("export.zip")],
            ["export.zip"],
            [],
            analysis(),
            undefined,
            false,
            undefined,
            LINKS
        );

        expect(markdown).toContain("| Created | 3 |");
        expect(markdown).toContain("| Updated | 2 |");
        expect(markdown).toContain("| Failed | 1 |");
        // 5 unchanged conversations dropped at analysis time — not the single
        // no-op write recorded by addSkipped.
        expect(conversationsSkippedRow(markdown)).toBe("| Skipped | 5 |");
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
            analysis(),
            undefined,
            true,
            undefined,
            LINKS
        );

        expect(markdown).toContain("| Kept (unique) | 10 |");
        expect(conversationsSkippedRow(markdown)).toBe("| Skipped | 5 |");
    });

    it("counts conversations the user left unselected nowhere", () => {
        // Documents today's gap: 10 conversations offered, 5 importable, and
        // nothing in the report says how many the user declined.
        const report = populatedReport();
        report.setAnalysisInfo(analysis());

        const markdown = report.generateSummaryReportContent(
            [fakeFile("export.zip")],
            ["export.zip"],
            [],
            analysis(),
            undefined,
            true,
            undefined,
            LINKS
        );

        expect(markdown).not.toContain("Not selected");
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
            undefined,
            undefined,
            false,
            undefined,
            LINKS
        );

        expect(markdown).toContain("| Created | 3 |");
        expect(markdown).toContain("| Updated | 2 |");
        // The single no-op write, because nothing else is known.
        expect(conversationsSkippedRow(markdown)).toBe("| Skipped | 1 |");
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

describe('import report — the word "Skipped" is overloaded', () => {
    it("uses it for archives and for conversations in the same note", () => {
        const report = populatedReport();
        report.setAnalysisInfo(analysis());

        const markdown = report.generateSummaryReportContent(
            [fakeFile("export.zip"), fakeFile("other.zip")],
            ["export.zip"],
            ["other.zip"],
            analysis(),
            undefined,
            false,
            undefined,
            LINKS
        );

        const filesBlock = markdown.slice(
            markdown.indexOf("### Files"),
            markdown.indexOf("### Conversations")
        );
        // One archive was not processed...
        expect(filesBlock).toContain("| Skipped | 1 |");
        // ...and five conversations were unchanged. Same word, same note.
        expect(conversationsSkippedRow(markdown)).toBe("| Skipped | 5 |");
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
