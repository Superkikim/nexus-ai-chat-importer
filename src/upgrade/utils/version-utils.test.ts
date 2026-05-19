import { describe, it, expect } from "vitest";
import { VersionUtils } from "./version-utils";

const MIN_SUPPORTED = "1.3.0";

describe("VersionUtils.compareVersions", () => {
    it("returns negative when v1 < v2", () => {
        expect(VersionUtils.compareVersions("1.2.9", "1.3.0")).toBeLessThan(0);
        expect(VersionUtils.compareVersions("1.1.0", "1.3.0")).toBeLessThan(0);
        expect(VersionUtils.compareVersions("1.0.0", "1.3.0")).toBeLessThan(0);
    });

    it("returns 0 when versions are equal", () => {
        expect(VersionUtils.compareVersions("1.3.0", "1.3.0")).toBe(0);
    });

    it("returns positive when v1 > v2", () => {
        expect(VersionUtils.compareVersions("1.3.1", "1.3.0")).toBeGreaterThan(0);
        expect(VersionUtils.compareVersions("1.4.0", "1.3.0")).toBeGreaterThan(0);
        expect(VersionUtils.compareVersions("2.0.0", "1.3.0")).toBeGreaterThan(0);
    });
});

describe("Version guard boundary (MIN_SUPPORTED_VERSION = 1.3.0)", () => {
    it("1.1.0 is below minimum — guard must fire", () => {
        expect(VersionUtils.compareVersions("1.1.0", MIN_SUPPORTED)).toBeLessThan(0);
    });

    it("1.2.9 is below minimum — guard must fire", () => {
        expect(VersionUtils.compareVersions("1.2.9", MIN_SUPPORTED)).toBeLessThan(0);
    });

    it("1.0.5 is below minimum — guard must fire", () => {
        expect(VersionUtils.compareVersions("1.0.5", MIN_SUPPORTED)).toBeLessThan(0);
    });

    it("1.3.0 is at minimum — guard must NOT fire", () => {
        expect(VersionUtils.compareVersions("1.3.0", MIN_SUPPORTED)).toBe(0);
    });

    it("1.4.0 is above minimum — guard must NOT fire", () => {
        expect(VersionUtils.compareVersions("1.4.0", MIN_SUPPORTED)).toBeGreaterThan(0);
    });

    it("1.6.4 is above minimum — guard must NOT fire", () => {
        expect(VersionUtils.compareVersions("1.6.4", MIN_SUPPORTED)).toBeGreaterThan(0);
    });
});

describe("VersionUtils.getVersionsInRange", () => {
    const available = ["1.1.0", "1.2.0", "1.3.0", "1.4.0"];

    it("returns only versions > from and <= to", () => {
        const chain = VersionUtils.getVersionsInRange("1.3.0", "1.6.4", available);
        expect(chain).toEqual(["1.4.0"]);
    });

    it("returns empty when upgrading from current version (no-op)", () => {
        const chain = VersionUtils.getVersionsInRange("1.6.4", "1.6.4", available);
        expect(chain).toHaveLength(0);
    });

    it("with old scripts removed, chain from 1.3.x only returns 1.4.0", () => {
        const withoutOld = ["1.3.0", "1.4.0"];
        const chain = VersionUtils.getVersionsInRange("1.3.0", "1.6.4", withoutOld);
        expect(chain).toEqual(["1.4.0"]);
    });

    it("with old scripts removed, chain from below minimum is handled by guard (empty chain)", () => {
        const withoutOld = ["1.3.0", "1.4.0"];
        const chain = VersionUtils.getVersionsInRange("1.2.9", "1.6.4", withoutOld);
        expect(chain).toContain("1.3.0");
        expect(chain).toContain("1.4.0");
        expect(chain).not.toContain("1.1.0");
        expect(chain).not.toContain("1.2.0");
    });
});

describe("VersionUtils.isInRange", () => {
    it("returns true when version is above minimum", () => {
        expect(VersionUtils.isInRange("1.4.0", MIN_SUPPORTED)).toBe(true);
    });

    it("returns true when version equals minimum", () => {
        expect(VersionUtils.isInRange("1.3.0", MIN_SUPPORTED)).toBe(true);
    });

    it("returns false when version is below minimum", () => {
        expect(VersionUtils.isInRange("1.2.9", MIN_SUPPORTED)).toBe(false);
        expect(VersionUtils.isInRange("1.1.0", MIN_SUPPORTED)).toBe(false);
    });
});
