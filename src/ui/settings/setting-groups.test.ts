import { describe, expect, it } from "vitest";
import { buildSettingGroups, type DefinableSection } from "./setting-groups";

function section(
    title: string | undefined,
    ...names: string[]
): DefinableSection {
    return {
        title,
        getDefinitions: () =>
            names.map((name) => ({ name, render: () => undefined })),
    };
}

const names = (items: { name?: string }[] | undefined) =>
    items?.map((item) => item.name);

describe("buildSettingGroups", () => {
    it("makes one titled group per titled section", () => {
        const groups = buildSettingGroups([
            section("Support", "Resources"),
            section("Folders", "A", "B"),
        ]);

        expect(groups.map((g) => g.heading)).toEqual(["Support", "Folders"]);
        expect(names(groups[1].items)).toEqual(["A", "B"]);
        expect(groups.every((g) => g.type === "group")).toBe(true);
    });

    it("continues the previous group for a section with no title", () => {
        const groups = buildSettingGroups([
            section("Date Format", "Prefix"),
            section(undefined, "Custom timestamp", "Timestamp format"),
            section("Properties", "Custom ID"),
        ]);

        expect(groups.map((g) => g.heading)).toEqual([
            "Date Format",
            "Properties",
        ]);
        expect(names(groups[0].items)).toEqual([
            "Prefix",
            "Custom timestamp",
            "Timestamp format",
        ]);
    });

    it("keeps a leading untitled section as a group of its own", () => {
        const groups = buildSettingGroups([section(undefined, "Only")]);
        expect(groups).toHaveLength(1);
        expect(groups[0].heading).toBeUndefined();
        expect(names(groups[0].items)).toEqual(["Only"]);
    });

    it("returns nothing for no sections", () => {
        expect(buildSettingGroups([])).toEqual([]);
    });
});
