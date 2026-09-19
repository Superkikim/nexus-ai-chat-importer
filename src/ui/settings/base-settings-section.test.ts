import { describe, expect, it, vi } from "vitest";
import { BaseSettingsSection, type SectionRow } from "./base-settings-section";

class TestSection extends BaseSettingsSection {
    readonly title = "Test";
    constructor(private testRows: SectionRow[]) {
        super({} as never);
    }
    protected rows(): SectionRow[] {
        return this.testRows;
    }
}

function fakeSetting() {
    const classes: string[] = [];
    const descEl = { addClass: (c: string) => classes.push(`desc:${c}`) };
    const settingEl = {
        addClass: (c: string) => classes.push(c),
        appendChild: vi.fn(),
    };
    return { setting: { settingEl, descEl } as never, classes, settingEl };
}

describe("BaseSettingsSection.getDefinitions", () => {
    it("carries name, description, search terms and visibility over", () => {
        const visible = () => true;
        const section = new TestSection([
            {
                name: "Custom ID property",
                desc: "Adds a property",
                aliases: ["uid"],
                searchable: false,
                visible,
                render: () => undefined,
            },
        ]);

        const [definition] = section.getDefinitions();
        expect(definition).toMatchObject({
            name: "Custom ID property",
            desc: "Adds a property",
            aliases: ["uid"],
            searchable: false,
            visible,
        });
    });

    it("renders the row into the setting it is given", () => {
        const render = vi.fn();
        const section = new TestSection([
            { name: "Row", cls: "my-row", render },
        ]);
        const [definition] = section.getDefinitions();
        const { setting, classes } = fakeSetting();

        definition.render(setting, {} as never);

        expect(render).toHaveBeenCalledWith(setting);
        expect(classes).toContain("my-row");
    });

    it("moves the description to a full-width row when asked", () => {
        const section = new TestSection([
            { name: "Row", fullWidthDesc: true, render: () => undefined },
        ]);
        const [definition] = section.getDefinitions();
        const { setting, classes, settingEl } = fakeSetting();

        definition.render(setting, {} as never);

        expect(classes).toContain("nexus-setting-full-width-desc");
        expect(classes).toContain("desc:nexus-setting-desc-row");
        expect(settingEl.appendChild).toHaveBeenCalledTimes(1);
    });

    it("defines nothing for a section with no rows", () => {
        expect(new TestSection([]).getDefinitions()).toEqual([]);
    });
});
