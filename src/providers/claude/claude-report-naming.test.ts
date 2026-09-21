import { describe, expect, it } from "vitest";
import { ClaudeReportNamingStrategy } from "./claude-report-naming";

describe("ClaudeReportNamingStrategy", () => {
    it("says its column counts artifacts, so the completion dialog shows them", () => {
        const column =
            new ClaudeReportNamingStrategy().getProviderSpecificColumn();

        expect(column.header).toBe("Artifacts");
        expect(column.countsArtifacts).toBe(true);
    });
});
